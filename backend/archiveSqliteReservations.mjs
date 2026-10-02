import { DatabaseSync } from "node:sqlite";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RESERVATION_ANALYTICS_EVENTS, RESERVATION_TABLES, writeReservationArchive } from "./postgres/archiveReservations.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultDatabasePath = join(rootDir, "backend", "data", "galatee.sqlite");

export function readSqliteReservationSnapshot(db) {
  const tables = {};
  for (const table of RESERVATION_TABLES) {
    const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
    if (!exists) {
      tables[table] = { columns: [], rows: [] };
      continue;
    }
    const columns = db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all().map((column) => column.name);
    tables[table] = {
      columns,
      rows: db.prepare(`SELECT * FROM ${quoteIdentifier(table)}`).all(),
    };
  }
  const analyticsEvents = db.prepare(
    `SELECT * FROM analytics_events WHERE event_name IN (${RESERVATION_ANALYTICS_EVENTS.map(() => "?").join(", ")}) ORDER BY occurred_at, id`,
  ).all(...RESERVATION_ANALYTICS_EVENTS);
  return { tables, analyticsEvents };
}

export async function removeSqliteReservations({ databasePath = defaultDatabasePath, archivePath, confirm = false } = {}) {
  if (!confirm) throw new Error("Destructive cleanup requires RESERVATION_ARCHIVE_CONFIRM=YES.");
  const db = new DatabaseSync(databasePath);
  try {
    const snapshot = readSqliteReservationSnapshot(db);
    const archive = await writeReservationArchive(snapshot, archivePath);
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(
        `DELETE FROM analytics_events WHERE event_name IN (${RESERVATION_ANALYTICS_EVENTS.map(() => "?").join(", ")})`,
      ).run(...RESERVATION_ANALYTICS_EVENTS);
      for (const table of RESERVATION_TABLES) db.exec(`DROP TABLE IF EXISTS ${quoteIdentifier(table)}`);
      const remaining = db.prepare(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN (" + RESERVATION_TABLES.map(() => "?").join(", ") + ")",
      ).get(...RESERVATION_TABLES).count;
      if (Number(remaining) !== 0) throw new Error("SQLite reservation tables remain after cleanup.");
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return archive;
  } finally {
    db.close();
  }
}

function quoteIdentifier(identifier) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) throw new Error(`Unsafe SQL identifier: ${identifier}`);
  return `"${identifier}"`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const archivePath = process.env.RESERVATION_ARCHIVE_PATH || join(rootDir, "backend", "data", "galatee-reservations-sqlite-archive.json");
  if (process.env.RESERVATION_ARCHIVE_CONFIRM !== "YES") {
    console.error("Preview only. Set RESERVATION_ARCHIVE_CONFIRM=YES to archive and remove SQLite reservations.");
    const db = new DatabaseSync(process.env.SQLITE_DATABASE_PATH || defaultDatabasePath, { readOnly: true });
    try {
      const snapshot = readSqliteReservationSnapshot(db);
      console.log(JSON.stringify({ tableCounts: Object.fromEntries(Object.entries(snapshot.tables).map(([table, value]) => [table, value.rows.length])), analyticsEventCount: snapshot.analyticsEvents.length }, null, 2));
    } finally {
      db.close();
    }
  } else {
    const archive = await removeSqliteReservations({
      databasePath: process.env.SQLITE_DATABASE_PATH || defaultDatabasePath,
      archivePath,
      confirm: true,
    });
    console.log(JSON.stringify(archive, null, 2));
  }
}
