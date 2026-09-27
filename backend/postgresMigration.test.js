import test from "node:test";
import assert from "node:assert/strict";
import { MIGRATION_TABLES, assertCounts, buildInsertStatement } from "./postgres/migrate.mjs";

test("PostgreSQL migration manifest contains every current application table once", () => {
  assert.equal(new Set(MIGRATION_TABLES).size, MIGRATION_TABLES.length);
  assert.ok(MIGRATION_TABLES.includes("orders"));
  assert.ok(MIGRATION_TABLES.includes("customer_accounts"));
  assert.ok(MIGRATION_TABLES.includes("menu_item_revisions"));
  assert.ok(MIGRATION_TABLES.includes("reservations"));
  assert.ok(!MIGRATION_TABLES.includes("sqlite_sequence"));
});

test("PostgreSQL insert statements quote fixed identifiers and remain idempotent", () => {
  const sql = buildInsertStatement("orders", ["id", "order_number", "total_cents"]);
  assert.equal(
    sql,
    'INSERT INTO "orders" ("id", "order_number", "total_cents") VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
  );
  assert.throws(() => buildInsertStatement("orders;DROP", ["id"]), /Unsafe SQL identifier/);
});

test("PostgreSQL migration count verification detects missing rows", () => {
  const snapshot = {
    tables: new Map(MIGRATION_TABLES.map((table) => [table, { rows: table === "orders" ? [{ id: "one" }] : [] }])),
  };
  const complete = Object.fromEntries(MIGRATION_TABLES.map((table) => [table, table === "orders" ? 1 : 0]));
  assert.doesNotThrow(() => assertCounts(snapshot, complete));
  assert.throws(() => assertCounts(snapshot, { ...complete, orders: 0 }), /orders/);
  assert.doesNotThrow(() => assertCounts(snapshot, { ...complete, orders: 2 }, { allowExisting: true }));
});
