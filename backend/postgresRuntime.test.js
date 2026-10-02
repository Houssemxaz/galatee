import test from "node:test";
import assert from "node:assert/strict";
import { splitSqlStatements, translateSql } from "./postgres/syncDatabase.js";

test("PostgreSQL adapter translates SQLite placeholders and transactions", () => {
  assert.equal(
    translateSql("UPDATE orders SET status = ? WHERE id = ?"),
    "UPDATE orders SET status = $1 WHERE id = $2",
  );
  assert.equal(translateSql("BEGIN IMMEDIATE"), "BEGIN");
  assert.equal(
    translateSql("INSERT OR IGNORE INTO pasta_club_events (id) VALUES (?)"),
    "INSERT INTO pasta_club_events (id) VALUES ($1) ON CONFLICT DO NOTHING",
  );
});

test("PostgreSQL adapter keeps question marks inside SQL strings untouched", () => {
  assert.equal(
    translateSql("SELECT '?' AS literal, email FROM customer_accounts WHERE id = ?"),
    "SELECT '?' AS literal, email FROM customer_accounts WHERE id = $1",
  );
});

test("SQL statement splitter respects quoted semicolons", () => {
  assert.deepEqual(
    splitSqlStatements("INSERT INTO demo (note) VALUES ('a;b'); UPDATE demo SET note = 'c';"),
    [
      "INSERT INTO demo (note) VALUES ('a;b')",
      " UPDATE demo SET note = 'c'",
      "",
    ],
  );
});
