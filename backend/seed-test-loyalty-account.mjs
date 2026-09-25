// Cree un compte de test avec 10 commandes livrees pour que la recompense
// fidelite soit disponible immediatement cote client. Idempotent : peut etre
// relance sans casser l'etat.
//
// Usage : node backend/seed-test-loyalty-account.mjs
//
// Credentials :
//   Email    : test-fidelite@galatee.local
//   Password : test123456

import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { LoyaltySystem } from "./loyaltySystem.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "data", "galatee.sqlite");

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");

const loyalty = new LoyaltySystem({ db });

const EMAIL = "test-fidelite@galatee.local";
const PASSWORD = "test123456";
const FIRST_NAME = "Test";
const LAST_NAME = "Fidélité";
const PHONE = "+213555000000";
const RESIDENCE = "Hydra";

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString("hex");
}

function makeOrderNumber(date, index) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}-${String(index).padStart(4, "0")}`;
}

// 1. Compte : cree ou reutilise
let customer = db.prepare("SELECT * FROM customer_accounts WHERE email = ?").get(EMAIL);
if (!customer) {
  const id = randomBytes(16).toString("hex");
  const salt = randomBytes(16).toString("hex");
  const hash = hashPassword(PASSWORD, salt);
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO customer_accounts (
      id, email, first_name, last_name, phone, password_hash, password_salt,
      residence_commune, created_at, updated_at, last_login_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, EMAIL, FIRST_NAME, LAST_NAME, PHONE, hash, salt, RESIDENCE, now, now, now);
  customer = db.prepare("SELECT * FROM customer_accounts WHERE email = ?").get(EMAIL);
  console.log(`Compte cree : ${EMAIL} (id ${customer.id})`);
} else {
  console.log(`Compte existant : ${EMAIL} (id ${customer.id})`);
}

// 2. Compte les commandes livrees deja presentes
const existingOrders = db.prepare(
  "SELECT COUNT(*) AS n FROM orders WHERE customer_id = ? AND status IN ('delivered', 'withdrawn', 'completed')"
).get(customer.id).n;
console.log(`Commandes qualifiantes existantes : ${existingOrders}`);

const TARGET = 10;
const toCreate = Math.max(0, TARGET - existingOrders);

if (toCreate === 0) {
  console.log("Deja au moins 10 commandes livrees. Aucune commande ajoutee.");
} else {
  // 3. Recupere un plat publie pour peupler les commandes
  const dish = db.prepare(`
    SELECT item.id, revision.title, revision.price_cents
    FROM menu_items item
    JOIN menu_item_revisions revision ON revision.id = item.published_revision_id
    WHERE item.status = 'published' AND item.available = 1
    LIMIT 1
  `).get();
  if (!dish) {
    console.error("Aucun plat publie trouve. Impossible de creer des commandes.");
    process.exit(1);
  }
  console.log(`Plat utilise : ${dish.title} (${dish.price_cents / 100} DA)`);

  for (let i = 0; i < toCreate; i++) {
    const daysAgo = (existingOrders + i + 1) * 3;
    const created = new Date(Date.now() - daysAgo * 86400000);
    const iso = created.toISOString();
    const orderId = randomUUID();
    const qty = 1 + (i % 2);
    const lineTotal = dish.price_cents * qty;
    const orderNumber = makeOrderNumber(created, existingOrders + i + 1);

    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(`
        INSERT INTO orders (
          id, order_number, customer_id, first_name, last_name, phone, email,
          delivery_mode, commune_id, commune_name, delivery_address, payment_method,
          status, note, subtotal_cents, delivery_fee_cents, discount_cents, loyalty_reward_id, total_cents, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pickup', NULL, '', '', 'cash_on_delivery', 'delivered', '', ?, 0, 0, NULL, ?, ?, ?)
      `).run(orderId, orderNumber, customer.id, FIRST_NAME, LAST_NAME, PHONE, EMAIL, lineTotal, lineTotal, iso, iso);

      db.prepare(`
        INSERT INTO order_items (id, order_id, product_type, product_id, title, unit_price_cents, quantity, line_total_cents)
        VALUES (?, ?, 'dish', ?, ?, ?, ?, ?)
      `).run(randomUUID(), orderId, dish.id, dish.title, dish.price_cents, qty, lineTotal);

      db.prepare("INSERT INTO order_status_history (order_id, status, changed_at) VALUES (?, 'pending', ?)").run(orderId, iso);
      db.prepare("INSERT INTO order_status_history (order_id, status, changed_at) VALUES (?, 'delivered', ?)").run(orderId, iso);
      db.exec("COMMIT");
      console.log(`  Commande ${i + 1}/${toCreate} creee (${orderNumber})`);
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}

// 4. Synchronise les rewards
const progress = loyalty.syncCustomerRewards(customer.id);
console.log(`\nProgression fidelite :`);
console.log(`  Commandes qualifiantes : ${progress.qualifyingOrders}`);
console.log(`  Recompense disponible  : ${progress.rewardAvailable ? progress.rewardAvailable.title : "aucune"}`);
console.log(`  Type/valeur            : ${progress.settings.rewardType} / ${progress.settings.rewardValue}`);
console.log(`\n=== Comptes test ===`);
console.log(`  Email    : ${EMAIL}`);
console.log(`  Password : ${PASSWORD}`);
console.log("\nConnecte-toi sur /compte puis va sur /commande pour voir la remise appliquee.");

db.close();
