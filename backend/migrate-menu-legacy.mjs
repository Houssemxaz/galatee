#!/usr/bin/env node
/**
 * One-off: applies the legacy menu items migration on the running DB.
 * Run: node backend/migrate-menu-legacy.mjs
 * Safe: no-op if legacy IDs are absent.
 */
import { SqliteReservationStore } from "./reservationSystem.js";
import { MenuSystem } from "./menuSystem.js";

const store = new SqliteReservationStore();
const menu = new MenuSystem({ db: store.db, uploadRoot: "backend/data/uploads/menu" });

console.log("─ Menu items after migration ─");
const items = store.db
  .prepare(
    `SELECT mi.id, mi.category, mi.sort_order, mir.title
       FROM menu_items mi
       LEFT JOIN menu_item_revisions mir ON mir.id = mi.published_revision_id
       ORDER BY mi.sort_order ASC`
  )
  .all();
for (const row of items) {
  console.log(`  ${row.sort_order}. ${row.id.padEnd(24)} ${row.category.padEnd(10)} — ${row.title}`);
}

store.close();
console.log("\n✔ Migration finished. Restart the backend to pick up the code changes.");
