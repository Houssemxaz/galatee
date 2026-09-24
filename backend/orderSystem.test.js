import assert from "node:assert/strict";
import test from "node:test";
import { MenuSystem } from "./menuSystem.js";
import { OrderError, OrderSystem } from "./orderSystem.js";
import { SqliteReservationStore } from "./reservationSystem.js";

const fixedNow = () => new Date("2026-09-13T18:00:00.000Z");

function createSystems(t) {
  const store = new SqliteReservationStore();
  t.after(() => store.close());
  const menu = new MenuSystem({ db: store.db, uploadRoot: "backend/data/uploads/menu", now: fixedNow });
  const orders = new OrderSystem({ db: store.db, menu, now: fixedNow });
  return { store, menu, orders };
}

function body(items, overrides = {}) {
  return {
    firstName: "Lina",
    lastName: "Martin",
    phone: "+213 555 123 456",
    email: "lina@example.com",
    deliveryMode: "delivery",
    communeId: "hydra",
    deliveryAddress: "12 rue des Oliviers, Hydra",
    items,
    ...overrides,
  };
}

test("creates a delivery order with commune fee and immutable item prices", (t) => {
  const { menu, orders } = createSystems(t);
  const item = menu.listPublished()[0];
  const order = orders.createOrder(body([{ productId: item.id, quantity: 2 }])).id;
  const saved = orders.getOrder(order);

  assert.equal(saved.status, "pending");
  assert.equal(saved.deliveryMode, "delivery");
  assert.equal(saved.deliveryFeeCents, 50_000);
  assert.equal(saved.subtotalCents, item.priceCents * 2);
  assert.equal(saved.totalCents, item.priceCents * 2 + 50_000);
  assert.equal(saved.items[0].title, item.title);
  assert.equal(saved.paymentMethod, "cash_on_delivery");
});

test("allows pickup without a commune and rejects unavailable dishes", (t) => {
  const { menu, orders } = createSystems(t);
  const item = menu.listPublished()[0];
  const pickup = orders.createOrder(body([{ productId: item.id }], { deliveryMode: "pickup", communeId: "hydra", deliveryAddress: "" }));
  assert.equal(pickup.deliveryFeeCents, 0);
  assert.equal(pickup.communeId, null);

  menu.setAvailability(item.id, false);
  assert.throws(() => orders.createOrder(body([{ productId: item.id }])), (error) => error instanceof OrderError && error.code === "PRODUCT_UNAVAILABLE");
});

test("enforces the operational order status flow", (t) => {
  const { menu, orders } = createSystems(t);
  const item = menu.listPublished()[0];
  const order = orders.createOrder(body([{ productId: item.id }])).id;
  assert.equal(orders.updateStatus(order, "confirmed").status, "confirmed");
  assert.equal(orders.updateStatus(order, "preparing").status, "preparing");
  assert.equal(orders.updateStatus(order, "ready").status, "ready");
  assert.equal(orders.updateStatus(order, "delivered").status, "delivered");
  assert.equal(orders.updateStatus(order, "completed").status, "completed");
  assert.throws(() => orders.updateStatus(order, "cancelled"), (error) => error.code === "ORDER_STATUS_TRANSITION_INVALID");
});

test("keeps commune fees editable and can deactivate a commune", (t) => {
  const { orders } = createSystems(t);
  const updated = orders.updateCommune("hydra", { fee: 750, active: false });
  assert.equal(updated.feeCents, 75_000);
  assert.equal(updated.active, false);
  assert.throws(() => orders.createOrder(body([{ productId: "spaghetti-pomodoro" }])), (error) => error.code === "COMMUNE_UNAVAILABLE");
});

test("orders published menus and offers with their catalogue type", (t) => {
  const { menu, orders } = createSystems(t);
  const menuItem = menu.create({ itemType: "menu", title: "Menu duo", price: "48", category: "fresca" });
  menu.publish(menuItem.id);
  const offerItem = menu.create({ itemType: "offer", title: "Offre du soir", price: "22", category: "fresca" });
  menu.publish(offerItem.id);
  const order = orders.createOrder(body([
    { productId: menuItem.id, productType: "menu", quantity: 1 },
    { productId: offerItem.id, productType: "offer", quantity: 1 },
  ]));
  assert.deepEqual(order.items.map((item) => item.productType), ["menu", "offer"]);
  assert.throws(() => orders.createOrder(body([{ productId: menuItem.id, productType: "dish", quantity: 1 }])), (error) => error.code === "PRODUCT_TYPE_MISMATCH");
});
