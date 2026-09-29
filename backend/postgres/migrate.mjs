import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";

const { Pool } = pg;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "../..");
const defaultSqlitePath = join(rootDir, "backend", "data", "galatee.sqlite");
const schemaPath = join(scriptDir, "schema.sql");

// Keep this order: every table appears after the tables referenced by its
// foreign keys. It also makes the import output deterministic and reviewable.
export const MIGRATION_TABLES = [
  "customer_accounts",
  "delivery_communes",
  "drivers",
  "menu_items",
  "menu_item_revisions",
  "services",
  "restaurant_tables",
  "reservations",
  "blocked_time_slots",
  "reservation_table_assignments",
  "availability_settings",
  "availability_settings_history",
  "availability_events",
  "orders",
  "order_items",
  "order_status_history",
  "loyalty_settings",
  "loyalty_rewards",
  "promotions",
  "analytics_events",
  "daily_revenues",
  "pasta_club_settings",
  "pasta_club_events",
  "customer_login_codes",
  "customer_sessions",
  "customer_password_resets",
  "driver_sessions",
  "driver_push_subscriptions",
];

// These reservation tables are kept in the PostgreSQL schema for historical
// compatibility, but the current SQLite application no longer creates them.
// An absent table in the source must be skipped, never fabricated or deleted.
export const OPTIONAL_LEGACY_TABLES = new Set([
  "services",
  "restaurant_tables",
  "reservations",
  "blocked_time_slots",
  "reservation_table_assignments",
  "availability_settings",
  "availability_settings_history",
  "availability_events",
]);

const VERSION = "001_sqlite_baseline";

/**
 * Read the SQLite database without modifying it. The result is deliberately a
 * plain snapshot so it can be validated before a PostgreSQL connection is
 * opened or any target data is written.
 */
export function readSqliteSnapshot(sqlitePath = defaultSqlitePath) {
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const integrity = db.prepare("PRAGMA integrity_check").get()?.integrity_check;
    if (integrity !== "ok") {
      throw new Error(`SQLite integrity check failed: ${integrity || "unknown result"}`);
    }

    const foreignKeyErrors = db.prepare("PRAGMA foreign_key_check").all();
    if (foreignKeyErrors.length > 0) {
      throw new Error(`SQLite foreign key check failed (${foreignKeyErrors.length} row(s)).`);
    }

    const tables = new Map();
    let rowCount = 0;
    for (const table of MIGRATION_TABLES) {
      const columns = db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all();
      if (columns.length === 0) {
        if (!OPTIONAL_LEGACY_TABLES.has(table)) {
          throw new Error(`SQLite table is missing: ${table}`);
        }
        tables.set(table, { columns: [], rows: [], sourcePresent: false });
        continue;
      }
      const columnNames = columns.map((column) => column.name);
      const selectList = columnNames.map(quoteIdentifier).join(", ");
      const rows = db.prepare(`SELECT ${selectList} FROM ${quoteIdentifier(table)}`).all();
      tables.set(table, { columns: columnNames, rows, sourcePresent: true });
      rowCount += rows.length;
    }

    const serialized = JSON.stringify(
      MIGRATION_TABLES.map((table) => [table, tables.get(table).columns, tables.get(table).rows]),
    );
    const sourceSha256 = createHash("sha256").update(serialized).digest("hex");
    return { sqlitePath: resolve(sqlitePath), sourceSha256, rowCount, tables };
  } finally {
    db.close();
  }
}

export function buildInsertStatement(table, columns) {
  const safeTable = quoteIdentifier(table);
  const safeColumns = columns.map(quoteIdentifier).join(", ");
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  return `INSERT INTO ${safeTable} (${safeColumns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
}

export async function applyMigration({
  databaseUrl,
  sqlitePath = defaultSqlitePath,
  allowExisting = false,
  logger = console,
} = {}) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required for a PostgreSQL import.");
  const snapshot = readSqliteSnapshot(sqlitePath);
  const schema = await readFile(schemaPath, "utf8");
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();

  try {
    await client.query(schema);
    await assertTargetColumns(client, snapshot);

    const existingRows = await countTargetRows(client);
    if (existingRows > 0 && !allowExisting) {
      throw new Error(
        `Target PostgreSQL database is not empty (${existingRows} application row(s)). ` +
        "Use a fresh database, or explicitly set POSTGRES_MIGRATION_ALLOW_EXISTING=YES.",
      );
    }

    const startedAt = new Date().toISOString();
    const runId = randomUUID();
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO galatee_migration_runs
        (id, source_path, source_sha256, imported_rows, started_at, status)
       VALUES ($1, $2, $3, $4, $5, 'running')`,
      [runId, snapshot.sqlitePath, snapshot.sourceSha256, snapshot.rowCount, startedAt],
    );

    let insertedRows = 0;
    for (const table of MIGRATION_TABLES) {
      const tableSnapshot = snapshot.tables.get(table);
      if (tableSnapshot.sourcePresent === false) {
        logger.info?.(`[postgres] ${table}: skipped (not present in SQLite source)`);
        continue;
      }
      const insert = buildInsertStatement(table, tableSnapshot.columns);
      for (const row of tableSnapshot.rows) {
        const values = tableSnapshot.columns.map((column) => row[column] ?? null);
        const result = await client.query(insert, values);
        insertedRows += result.rowCount || 0;
      }
      logger.info?.(`[postgres] ${table}: ${tableSnapshot.rows.length} source row(s)`);
    }

    await client.query(
      `UPDATE galatee_migration_runs
       SET imported_rows = $1, completed_at = $2, status = 'completed'
       WHERE id = $3`,
      [insertedRows, new Date().toISOString(), runId],
    );
    await client.query(
      `INSERT INTO galatee_schema_migrations (version, applied_at)
       VALUES ($1, $2)
       ON CONFLICT (version) DO UPDATE SET applied_at = EXCLUDED.applied_at`,
      [VERSION, new Date().toISOString()],
    );
    await client.query("COMMIT");

    const targetCounts = await countTargetTables(client);
    assertCounts(snapshot, targetCounts, { allowExisting });
    return { ...snapshot, insertedRows, targetCounts };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

export function assertCounts(snapshot, targetCounts, { allowExisting = false } = {}) {
  for (const table of MIGRATION_TABLES) {
    const tableSnapshot = snapshot.tables.get(table);
    if (tableSnapshot.sourcePresent === false) continue;
    const expected = tableSnapshot.rows.length;
    const actual = Number(targetCounts[table] || 0);
    if (allowExisting ? actual < expected : actual !== expected) {
      throw new Error(
        `PostgreSQL row count mismatch for ${table}: expected at least ${expected}, received ${actual}.`,
      );
    }
  }
}

async function assertTargetColumns(client, snapshot) {
  for (const table of MIGRATION_TABLES) {
    if (snapshot.tables.get(table).sourcePresent === false) continue;
    const result = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    const targetColumns = new Set(result.rows.map((row) => row.column_name));
    const missing = snapshot.tables.get(table).columns.filter((column) => !targetColumns.has(column));
    if (missing.length > 0) {
      throw new Error(`PostgreSQL table ${table} is missing columns: ${missing.join(", ")}`);
    }
  }
}

async function countTargetRows(client) {
  const counts = await countTargetTables(client);
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

async function countTargetTables(client) {
  const counts = {};
  for (const table of MIGRATION_TABLES) {
    const result = await client.query(`SELECT COUNT(*)::bigint AS count FROM ${quoteIdentifier(table)}`);
    counts[table] = Number(result.rows[0].count);
  }
  return counts;
}

function quoteIdentifier(identifier) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) throw new Error(`Unsafe SQL identifier: ${identifier}`);
  return `"${identifier}"`;
}

function printSnapshot(snapshot) {
  console.log(`SQLite source: ${snapshot.sqlitePath}`);
  console.log(`Snapshot SHA-256: ${snapshot.sourceSha256}`);
  console.log(`Total rows: ${snapshot.rowCount}`);
  for (const table of MIGRATION_TABLES) {
    console.log(`  ${table}: ${snapshot.tables.get(table).rows.length}`);
  }
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(`Usage:
  npm run db:postgres:verify
  POSTGRES_MIGRATION_CONFIRM=YES DATABASE_URL=... npm run db:postgres:import

Optional variables:
  SQLITE_DATABASE_PATH=...                       SQLite source path
  POSTGRES_MIGRATION_ALLOW_EXISTING=YES         allow idempotent merge into a non-empty target
`);
    return;
  }

  const sqlitePath = process.env.SQLITE_DATABASE_PATH || defaultSqlitePath;
  const snapshot = readSqliteSnapshot(sqlitePath);
  printSnapshot(snapshot);

  if (!argv.includes("--apply")) {
    console.log("Verification only: no PostgreSQL connection was opened.");
    return;
  }

  if (process.env.POSTGRES_MIGRATION_CONFIRM !== "YES") {
    throw new Error("Import refused. Set POSTGRES_MIGRATION_CONFIRM=YES explicitly.");
  }

  const result = await applyMigration({
    databaseUrl: process.env.DATABASE_URL,
    sqlitePath,
    allowExisting: process.env.POSTGRES_MIGRATION_ALLOW_EXISTING === "YES",
  });
  console.log(`PostgreSQL import completed: ${result.insertedRows} row(s) inserted.`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(`[postgres migration] ${error.message}`);
    process.exitCode = 1;
  });
}
