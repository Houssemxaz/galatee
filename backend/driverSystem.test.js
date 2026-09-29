import assert from "node:assert/strict";
import test from "node:test";
import { DriverError, DriverSystem } from "./driverSystem.js";
import { MenuSystem } from "./menuSystem.js";
import { OrderSystem } from "./orderSystem.js";
import { SqliteReservationStore } from "./reservationSystem.js";

const fixedNow = () => new Date("2026-09-28T19:00:00.000Z");

function createSystems(t) {
  const store = new SqliteReservationStore();
  t.after(() => store.close());
  const menu = new MenuSystem({ db: store.db, uploadRoot: "backend/data/uploads/menu", now: fixedNow });
  const orders = new OrderSystem({ db: store.db, menu, now: fixedNow });
  const drivers = new DriverSystem({ db: store.db, now: fixedNow });
  return { store, menu, orders, drivers };
}

function deliveryBody(itemId) {
  return {
    firstName: "Lina",
    lastName: "Martin",
    phone: "+213555123456",
    email: "lina@example.com",
    deliveryMode: "delivery",
    communeId: "hydra",
    deliveryAddress: "12 rue des Oliviers, Hydra",
    items: [{ productId: itemId, quantity: 1 }],
  };
}

function prepareDelivery({ menu, orders, drivers }) {
  const item = menu.listPublished()[0];
  const order = orders.createOrder(deliveryBody(item.id));
  orders.updateStatus(order.id, "confirmed");
  orders.updateStatus(order.id, "ready");
  const driver = drivers.create({ firstName: "Nora", phone: "+213555987654", pin: "1234" });
  drivers.assignOrder(order.id, driver.id);
  return { order, driver };
}

test("delivery cancellation after departure is audited and excluded from delivered revenue", (t) => {
  const { store, menu, orders, drivers } = createSystems(t);
  const { order, driver } = prepareDelivery({ menu, orders, drivers });

  drivers.markInTransit(driver.id, order.id);
  const result = drivers.markDeliveryCancelledByDriver(driver.id, order.id, "Client n'a pas récupéré la commande.");

  const saved = orders.getOrder(order.id);
  assert.equal(result.orderId, order.id);
  assert.equal(saved.status, "cancelled");
  assert.equal(saved.deliveredAt, null);
  assert.equal(drivers.listActiveOrders(driver.id).length, 0);
  assert.equal(drivers.getById(driver.id).currentStatus, "available");
  assert.deepEqual(drivers.getStats(driver.id).today, { delivered: 0, cancelled: 1 });
  assert.equal(drivers.listHistory(driver.id)[0].status, "cancelled");

  const history = store.db.prepare(`
    SELECT status, note FROM order_status_history
    WHERE order_id = ? ORDER BY changed_at DESC, id DESC LIMIT 1
  `).get(order.id);
  assert.equal(history.status, "cancelled");
  assert.match(history.note, /Client n'a pas récupéré/);
});

test("delivery cancellation is only available after the driver starts the route", (t) => {
  const { menu, orders, drivers } = createSystems(t);
  const { order, driver } = prepareDelivery({ menu, orders, drivers });

  assert.throws(
    () => drivers.markDeliveryCancelledByDriver(driver.id, order.id, "Client injoignable"),
    (error) => error instanceof DriverError && error.code === "ORDER_NOT_DELIVERY_CANCELLABLE",
  );
});

test("driver login locks after five failed PIN attempts and unlocks after five minutes", (t) => {
  let nowMs = Date.parse("2026-09-28T19:00:00.000Z");
  const store = new SqliteReservationStore();
  t.after(() => store.close());
  const drivers = new DriverSystem({ db: store.db, now: () => new Date(nowMs) });
  drivers.create({ firstName: "Nora", phone: "+213555987654", pin: "1234" });

  for (let attempt = 1; attempt < 5; attempt += 1) {
    assert.throws(
      () => drivers.loginWithPin({ phone: "+213555987654", pin: "0000" }),
      (error) => error instanceof DriverError && error.code === "DRIVER_INVALID_CREDENTIALS" && error.status === 401,
    );
  }
  assert.throws(
    () => drivers.loginWithPin({ phone: "+213555987654", pin: "0000" }),
    (error) => error instanceof DriverError
      && error.code === "DRIVER_LOGIN_LOCKED"
      && error.status === 429
      && error.details.retryAfterSeconds === 300,
  );
  assert.throws(
    () => drivers.loginWithPin({ phone: "+213555987654", pin: "1234" }),
    (error) => error instanceof DriverError && error.code === "DRIVER_LOGIN_LOCKED",
  );

  nowMs += 5 * 60 * 1000 + 1;
  const login = drivers.loginWithPin({ phone: "+213555987654", pin: "1234" });
  assert.equal(login.driver.phone, "+213555987654");
});
