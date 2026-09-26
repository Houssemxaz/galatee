import assert from "node:assert/strict";
import test from "node:test";
import { CustomerAuthSystem } from "./customerAuthSystem.js";
import { LoyaltyError, LoyaltySystem } from "./loyaltySystem.js";
import { MenuSystem } from "./menuSystem.js";
import { OrderSystem } from "./orderSystem.js";
import { SqliteReservationStore } from "./reservationSystem.js";

const fixedNow = () => new Date("2026-09-14T18:00:00.000Z");

function createSystems(t) {
  const store = new SqliteReservationStore();
  t.after(() => store.close());
  const menu = new MenuSystem({ db: store.db, uploadRoot: "backend/data/uploads/menu", now: fixedNow });
  const loyalty = new LoyaltySystem({ db: store.db, now: fixedNow });
  const orders = new OrderSystem({ db: store.db, menu, loyalty, now: fixedNow });
  new CustomerAuthSystem({ db: store.db, now: fixedNow });
  const customerId = "customer-loyalty-1";
  store.db.prepare(`
    INSERT INTO customer_accounts (id, email, first_name, last_name, phone, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(customerId, "lina@example.com", "Lina", "Martin", "+213555123456", fixedNow().toISOString(), fixedNow().toISOString());
  return { store, menu, orders, loyalty, customerId };
}

function orderBody(itemId) {
  return {
    firstName: "Lina",
    lastName: "Martin",
    phone: "+213 555 123 456",
    email: "lina@example.com",
    deliveryMode: "pickup",
    items: [{ productId: itemId, quantity: 1 }],
  };
}

function completeOrder(orders, orderId) {
  orders.updateStatus(orderId, "confirmed");
  orders.updateStatus(orderId, "ready");
  return orders.updateStatus(orderId, "delivered");
}

test("counts completed purchases and creates one reward at the configured threshold", (t) => {
  const { menu, orders, loyalty, customerId } = createSystems(t);
  const item = menu.listPublished()[0];
  loyalty.updateSettings({ threshold: 2, rewardType: "percentage", rewardValue: 10, title: "-10 %", description: "Merci", active: true });

  const first = orders.createOrder(orderBody(item.id), { customerId });
  completeOrder(orders, first.id);
  assert.equal(loyalty.getCustomerProgress(customerId).qualifyingOrders, 1);
  assert.equal(loyalty.getCustomerProgress(customerId).rewardAvailable, null);

  const cancelled = orders.createOrder(orderBody(item.id), { customerId });
  orders.updateStatus(cancelled.id, "cancelled");
  assert.equal(loyalty.getCustomerProgress(customerId).qualifyingOrders, 1);

  const second = orders.createOrder(orderBody(item.id), { customerId });
  completeOrder(orders, second.id);
  const progress = loyalty.getCustomerProgress(customerId);
  assert.equal(progress.qualifyingOrders, 2);
  assert.equal(progress.rewardAvailable.title, "-10 %");
  assert.equal(progress.ordersToNextReward, 2);

  loyalty.syncCustomerRewards(customerId);
  assert.equal(loyalty.listCustomerProgress()[0].rewardAvailable.title, "-10 %");
  assert.equal(loyalty.listCustomerProgress()[0].qualifyingOrders, 2);
  assert.match(loyalty.listCustomerProgress()[0].rewardAvailable.id, /^[a-f0-9-]{36}$/);

  const rewardId = progress.rewardAvailable.id;
  const rewarded = orders.createOrder({ ...orderBody(item.id), loyaltyRewardId: rewardId }, { customerId });
  assert.equal(rewarded.discountCents, Math.floor(rewarded.subtotalCents * 10 / 100));
  assert.equal(rewarded.totalCents, rewarded.subtotalCents - rewarded.discountCents);
  assert.equal(loyalty.getCustomerProgress(customerId).rewardAvailable, null);
  assert.throws(
    () => orders.createOrder({ ...orderBody(item.id), loyaltyRewardId: rewardId }, { customerId }),
    (error) => error.code === "LOYALTY_REWARD_UNAVAILABLE",
  );
});

test("validates loyalty settings before saving them", (t) => {
  const { loyalty } = createSystems(t);
  assert.throws(
    () => loyalty.updateSettings({ threshold: 0 }),
    (error) => error instanceof LoyaltyError && error.code === "LOYALTY_THRESHOLD_INVALID",
  );
  assert.throws(
    () => loyalty.updateSettings({ rewardType: "percentage", rewardValue: 101 }),
    (error) => error instanceof LoyaltyError && error.code === "LOYALTY_REWARD_VALUE_INVALID",
  );
});
