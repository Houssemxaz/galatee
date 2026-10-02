import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

export const RESERVATION_TABLES = [
  "reservation_table_assignments",
  "blocked_time_slots",
  "reservations",
  "availability_events",
  "availability_settings_history",
  "availability_settings",
  "restaurant_tables",
  "services",
];

export const RESERVATION_ANALYTICS_EVENTS = [
  "reservation_cta_clicked",
  "reservation_started",
  "reservation_submitted",
];

export function defaultArchivePath(now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return join(process.env.USERPROFILE || homedir(), "Downloads", `galatee-reservations-archive-${stamp}.json`);
}

export function archiveDigest(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function readReservationSnapshot(client) {
  const tables = {};
  for (const table of RESERVATION_TABLES) {
    const columnsResult = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [table],
    );
    const columns = columnsResult.rows.map((row) => row.column_name);
    const rows = columns.length
      ? (await client.query(`SELECT * FROM ${quoteIdentifier(table)}`)).rows
      : [];
    tables[table] = { columns, rows };
  }

  const analyticsRows = (await client.query(
    `SELECT * FROM analytics_events
     WHERE event_name = ANY($1::text[])
     ORDER BY occurred_at, id`,
    [RESERVATION_ANALYTICS_EVENTS],
  )).rows;

  return { tables, analyticsEvents: analyticsRows };
}

export async function writeReservationArchive(snapshot, archivePath, generatedAt = new Date()) {
  const payload = {
    formatVersion: 1,
    generatedAt: generatedAt.toISOString(),
    tables: snapshot.tables,
    analyticsEvents: snapshot.analyticsEvents,
  };
  const archive = { ...payload, sha256: archiveDigest(payload) };
  await mkdir(dirname(archivePath), { recursive: true });
  await writeFile(archivePath, `${JSON.stringify(archive, null, 2)}\n`, "utf8");

  const written = JSON.parse(await readFile(archivePath, "utf8"));
  const { sha256, ...writtenPayload } = written;
  if (sha256 !== archive.sha256 || archiveDigest(writtenPayload) !== sha256) {
    throw new Error("Reservation archive verification failed after writing the file.");
  }
  return {
    path: resolve(archivePath),
    sha256,
    tableCounts: Object.fromEntries(Object.entries(snapshot.tables).map(([table, value]) => [table, value.rows.length])),
    analyticsEventCount: snapshot.analyticsEvents.length,
  };
}

export async function removeReservations({ databaseUrl, archivePath = defaultArchivePath(), confirm = false, logger = console } = {}) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  if (!confirm) throw new Error("Destructive cleanup requires RESERVATION_ARCHIVE_CONFIRM=YES.");

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  try {
    const snapshot = await readReservationSnapshot(client);
    const archive = await writeReservationArchive(snapshot, archivePath);

    await client.query("BEGIN");
    await client.query(
      `DELETE FROM analytics_events
       WHERE event_name = ANY($1::text[])`,
      [RESERVATION_ANALYTICS_EVENTS],
    );
    for (const table of RESERVATION_TABLES) {
      await client.query(`DROP TABLE IF EXISTS ${quoteIdentifier(table)}`);
    }
    await assertRetiredObjectsAbsent(client);
    const analyticsRemaining = await client.query(
      `SELECT COUNT(*)::int AS count FROM analytics_events WHERE event_name = ANY($1::text[])`,
      [RESERVATION_ANALYTICS_EVENTS],
    );
    if (Number(analyticsRemaining.rows[0].count) !== 0) {
      throw new Error("Reservation analytics events remain after cleanup.");
    }
    await client.query("COMMIT");

    logger.info?.(`[postgres] reservation archive: ${archive.path}`);
    logger.info?.(`[postgres] reservation tables removed: ${RESERVATION_TABLES.length}`);
    return { archive, removedTables: [...RESERVATION_TABLES], analyticsEventsRemoved: snapshot.analyticsEvents.length };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

export async function inspectReservationObjects(databaseUrl) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  try {
    const objects = {};
    for (const table of RESERVATION_TABLES) {
      const result = await client.query("SELECT to_regclass($1) AS name", [`public.${table}`]);
      objects[table] = result.rows[0].name;
    }
    const analytics = await client.query(
      `SELECT COUNT(*)::int AS count FROM analytics_events WHERE event_name = ANY($1::text[])`,
      [RESERVATION_ANALYTICS_EVENTS],
    );
    return { objects, analyticsEvents: Number(analytics.rows[0].count) };
  } finally {
    client.release();
    await pool.end();
  }
}

async function assertRetiredObjectsAbsent(client) {
  const state = {};
  for (const table of RESERVATION_TABLES) {
    const result = await client.query("SELECT to_regclass($1) AS name", [`public.${table}`]);
    state[table] = result.rows[0].name;
  }
  const remaining = Object.entries(state).filter(([, value]) => value);
  if (remaining.length) throw new Error(`Reservation tables still exist: ${remaining.map(([table]) => table).join(", ")}`);
}

function quoteIdentifier(identifier) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) throw new Error(`Unsafe SQL identifier: ${identifier}`);
  return `"${identifier}"`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const databaseUrl = process.env.DATABASE_URL;
  const archivePath = process.env.RESERVATION_ARCHIVE_PATH || defaultArchivePath();
  const apply = process.argv.includes("--apply");
  if (!apply) {
    console.error("Preview only. Add --apply and set RESERVATION_ARCHIVE_CONFIRM=YES to archive and remove reservations.");
    const state = await inspectReservationObjects(databaseUrl);
    console.log(JSON.stringify(state, null, 2));
  } else {
    const result = await removeReservations({
      databaseUrl,
      archivePath,
      confirm: process.env.RESERVATION_ARCHIVE_CONFIRM === "YES",
    });
    console.log(JSON.stringify(result, null, 2));
  }
}
