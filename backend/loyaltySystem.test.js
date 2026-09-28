import assert from "node:assert/strict";
import test from "node:test";
import { CustomerAuthSystem } from "./customerAuthSystem.js";
import { calculateRewardDiscountCents, LoyaltyError, LoyaltySystem } from "./loyaltySystem.js";
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
  assert.throws(
    () => loyalty.updateSettings({ rewardScope: "pack", eligibleDishIds: ["only-one"] }),
    (error) => error instanceof LoyaltyError && error.code === "LOYALTY_PACK_DISHES_REQUIRED",
  );
});

test("calculates percentage rewards from the initial eligible price", () => {
  assert.equal(calculateRewardDiscountCents(70000, "percentage", 20), 14000);
  assert.equal(70000 - calculateRewardDiscountCents(70000, "percentage", 20), 56000);
});

test("calculates fixed rewards from the initial eligible price and caps them", () => {
  assert.equal(calculateRewardDiscountCents(70000, "fixed", 200), 20000);
  assert.equal(70000 - calculateRewardDiscountCents(70000, "fixed", 200), 50000);
  assert.equal(calculateRewardDiscountCents(70000, "fixed", 1000), 70000);
});

test("persists a fixed reward as a subtraction from the order subtotal", (t) => {
  const { menu, orders, loyalty, customerId } = createSystems(t);
  const item = menu.listPublished()[0];
  loyalty.updateSettings({ threshold: 1, rewardType: "fixed", rewardValue: 10, title: "-10 DA", description: "Merci", active: true });

  const qualifyingOrder = orders.createOrder(orderBody(item.id), { customerId });
  completeOrder(orders, qualifyingOrder.id);
  const reward = loyalty.getCustomerProgress(customerId).rewardAvailable;
  const discounted = orders.createOrder({ ...orderBody(item.id), loyaltyRewardId: reward.id }, { customerId });

  assert.equal(discounted.discountCents, Math.min(discounted.subtotalCents, 1000));
  assert.equal(discounted.totalCents, discounted.subtotalCents - discounted.discountCents);
});

test("pack rewards require every selected dish and discount only their combined subtotal", (t) => {
  const { menu, orders, loyalty, customerId } = createSystems(t);
  const [first, second, other] = menu.listPublished();
  loyalty.updateSettings({
    threshold: 1,
    rewardType: "percentage",
    rewardValue: 20,
    rewardScope: "pack",
    eligibleDishIds: [first.id, second.id],
    title: "Pack -20 %",
    description: "Merci",
    active: true,
  });

  const qualifyingOrder = orders.createOrder(orderBody(other.id), { customerId });
  completeOrder(orders, qualifyingOrder.id);
  const reward = loyalty.getCustomerProgress(customerId).rewardAvailable;
  assert.ok(reward);

  assert.throws(
    () => orders.createOrder({ ...orderBody(first.id), loyaltyRewardId: reward.id }, { customerId }),
    (error) => error.code === "LOYALTY_REWARD_UNAVAILABLE",
  );

  const packOrder = orders.createOrder({
    ...orderBody(first.id),
    loyaltyRewardId: reward.id,
    items: [first, second, other].map((item) => ({ productId: item.id, quantity: 1 })),
  }, { customerId });
  const eligibleSubtotal = first.priceCents + second.priceCents;
  assert.equal(packOrder.discountCents, Math.floor(eligibleSubtotal * 20 / 100));
  assert.equal(packOrder.totalCents, packOrder.subtotalCents - packOrder.discountCents);
  assert.ok(packOrder.subtotalCents > eligibleSubtotal);
});

test("fixed pack rewards subtract the fixed amount from the pack subtotal only", (t) => {
  const { menu, orders, loyalty, customerId } = createSystems(t);
  const [first, second, other] = menu.listPublished();
  loyalty.updateSettings({
    threshold: 1,
    rewardType: "fixed",
    rewardValue: 100,
    rewardScope: "pack",
    eligibleDishIds: [first.id, second.id],
    title: "Pack -100 DA",
    description: "Merci",
    active: true,
  });

  const qualifyingOrder = orders.createOrder(orderBody(other.id), { customerId });
  completeOrder(orders, qualifyingOrder.id);
  const reward = loyalty.getCustomerProgress(customerId).rewardAvailable;
  assert.ok(reward);

  const packOrder = orders.createOrder({
    ...orderBody(first.id),
    loyaltyRewardId: reward.id,
    items: [first, second, other].map((item) => ({ productId: item.id, quantity: 1 })),
  }, { customerId });
  const eligibleSubtotal = first.priceCents + second.priceCents;
  const expectedDiscount = Math.min(eligibleSubtotal, 10000);
  assert.equal(packOrder.discountCents, expectedDiscount);
  assert.equal(packOrder.totalCents, other.priceCents + eligibleSubtotal - expectedDiscount);
});
