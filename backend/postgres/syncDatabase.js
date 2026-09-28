import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const defaultSchemaPath = join(moduleDir, "schema.sql");
const RESPONSE_TIMEOUT_MS = 30_000;

/**
 * Temporary compatibility adapter for the current synchronous domain modules.
 * PostgreSQL work runs in a dedicated worker while the existing modules keep
 * the DatabaseSync-shaped prepare/exec contract during this migration step.
 */
export class PostgresSyncDatabase {
  constructor({ connectionString, schemaPath = defaultSchemaPath } = {}) {
    if (!connectionString) throw new Error("A PostgreSQL connection string is required.");

    this.worker = new Worker(new URL("./syncWorker.mjs", import.meta.url), {
      workerData: { connectionString },
    });
    this.closed = false;
    this.applyVersionedSchema(readFileSync(schemaPath, "utf8"));
  }

  prepare(sql) {
    return new PostgresStatement(this, sql);
  }

  exec(sql) {
    for (const statement of splitSqlStatements(sql)) {
      const normalized = stripLeadingComments(statement).trim();
      if (!normalized) continue;
      if (/^PRAGMA\b/i.test(normalized)) continue;
      if (/^CREATE\s+(?:TABLE|INDEX)\b/i.test(normalized)) continue;
      if (/^ALTER\s+TABLE\b/i.test(normalized)) continue;
      this.execute(normalized);
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.worker.postMessage({ type: "shutdown" });
    void this.worker.terminate();
  }

  execute(sql, params = []) {
    if (this.closed) throw new Error("PostgreSQL database is closed.");

    const translated = translateSql(sql);
    const pragmaMatch = translated.match(/^PRAGMA\s+table_info\(([^)]+)\)$/i);
    if (pragmaMatch) return this.readTableInfo(pragmaMatch[1].replace(/["']/g, ""));
    if (/^PRAGMA\b/i.test(translated)) return { rows: [], rowCount: 0 };

    const sab = new SharedArrayBuffer(16 * 1024 * 1024);
    const control = new Int32Array(sab, 0, 2);
    this.worker.postMessage({ type: "query", sql: translated, params, sab });
    const waitResult = Atomics.wait(control, 0, 0, RESPONSE_TIMEOUT_MS);
    if (waitResult === "timed-out") {
      throw new Error(`PostgreSQL query timed out after ${RESPONSE_TIMEOUT_MS}ms.`);
    }

    const length = Atomics.load(control, 1);
    const payload = JSON.parse(new TextDecoder().decode(new Uint8Array(sab, 8, length)));
    if (!payload.ok) {
      const error = new Error(payload.error?.message || "PostgreSQL query failed");
      error.code = payload.error?.code || "POSTGRES_QUERY_FAILED";
      throw error;
    }
    return payload;
  }

  applyVersionedSchema(schema) {
    for (const statement of splitSqlStatements(schema)) {
      const normalized = stripLeadingComments(statement).trim();
      if (normalized) this.execute(normalized);
    }
  }

  readTableInfo(tableName) {
    if (!/^[a-z_][a-z0-9_]*$/i.test(tableName)) throw new Error(`Unsafe table name: ${tableName}`);
    return this.execute(
      `SELECT ordinal_position - 1 AS cid, column_name AS name, data_type AS type
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [tableName],
    );
  }
}

class PostgresStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
  }

  get(...params) {
    return this.db.execute(this.sql, params).rows[0];
  }

  all(...params) {
    return this.db.execute(this.sql, params).rows;
  }

  run(...params) {
    const result = this.db.execute(this.sql, params);
    return { changes: result.rowCount, lastInsertRowid: undefined };
  }
}

export function translateSql(sql) {
  let translated = sql.trim().replace(/;\s*$/, "");
  translated = replaceQuestionMarks(translated);
  translated = translated.replace(/\bBEGIN\s+IMMEDIATE\b/gi, "BEGIN");
  translated = translated.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, "INSERT INTO");
  if (/^INSERT\s+INTO\b/i.test(translated) && !/\bON\s+CONFLICT\b/i.test(translated)) {
    translated += " ON CONFLICT DO NOTHING";
  }
  return translateStrftime(translated);
}

export function splitSqlStatements(sql) {
  const statements = [];
  let start = 0;
  let quote = null;
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    if (quote) {
      if (char === quote && sql[index + 1] === quote) index += 1;
      else if (char === quote) quote = null;
    } else if (char === "'" || char === '"') {
      quote = char;
    } else if (char === ";") {
      statements.push(sql.slice(start, index));
      start = index + 1;
    }
  }
  statements.push(sql.slice(start));
  return statements;
}

function replaceQuestionMarks(sql) {
  let result = "";
  let quote = null;
  let parameterIndex = 0;
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    if (quote) {
      result += char;
      if (char === quote && sql[index + 1] === quote) result += sql[++index];
      else if (char === quote) quote = null;
    } else if (char === "'" || char === '"') {
      quote = char;
      result += char;
    } else if (char === "?") {
      result += `$${++parameterIndex}`;
    } else {
      result += char;
    }
  }
  return result;
}

function translateStrftime(sql) {
  const formats = [
    ["%Y-W%W", 'IYYY-"W"IW'],
    ["%Y-%m", "YYYY-MM"],
    ["%Y-%m-%d", "YYYY-MM-DD"],
    ["%Y", "YYYY"],
  ];
  let translated = sql;
  for (const [sqliteFormat, postgresFormat] of formats) {
    const pattern = new RegExp(`strftime\\('${sqliteFormat}',\\s*([a-z_][a-z0-9_.]*)\\)`, "gi");
    translated = translated.replace(pattern, `to_char(CAST($1 AS date), '${postgresFormat}')`);
  }
  translated = translated.replace(
    /strftime\('%Y-W%W',\s*substr\(occurred_at,\s*1,\s*10\)\)/gi,
    `to_char(CAST(substr(occurred_at, 1, 10) AS date), 'IYYY-"W"IW')`,
  );
  translated = translated.replace(
    /strftime\('%Y-%m',\s*substr\(occurred_at,\s*1,\s*10\)\)/gi,
    `to_char(CAST(substr(occurred_at, 1, 10) AS date), 'YYYY-MM')`,
  );
  translated = translated.replace(
    /strftime\('%Y',\s*substr\(occurred_at,\s*1,\s*10\)\)/gi,
    `to_char(CAST(substr(occurred_at, 1, 10) AS date), 'YYYY')`,
  );
  return translated;
}

function stripLeadingComments(sql) {
  return sql.replace(/^(?:\s*--[^\n]*(?:\n|$))*\s*/, "");
}

export function defaultPostgresSchemaPath() {
  return resolve(defaultSchemaPath);
}
