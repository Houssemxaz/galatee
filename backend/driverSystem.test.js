import assert from "node:assert/strict";
import test from "node:test";
import { MenuSystem } from "./menuSystem.js";
import { OrderSystem } from "./orderSystem.js";
import { SqliteReservationStore } from "./reservationSystem.js";
import { DriverSystem } from "./driverSystem.js";

const fixedNow = () => new Date("2026-09-13T18:00:00.000Z");

function createSystems(t) {
  const store = new SqliteReservationStore();
  t.after(() => store.close());
  const menu = new MenuSystem({ db: store.db, uploadRoot: "backend/data/uploads/menu", now: fixedNow });
  const orders = new OrderSystem({ db: store.db, menu, now: fixedNow });
  const drivers = new DriverSystem({ db: store.db, now: fixedNow });
  return { store, menu, orders, drivers };
}

function orderBody(itemId, overrides = {}) {
  return {
    firstName: "Lina",
    lastName: "Martin",
    phone: "+213 555 123 456",
    email: "lina@example.com",
    deliveryMode: "delivery",
    communeId: "hydra",
    deliveryAddress: "12 rue des Oliviers, Hydra",
    items: [{ productId: itemId }],
    ...overrides,
  };
}

// Ce test protege un bug reel : les requetes SQL de driverSystem etaient
// independantes de orderSystem.mapOrder() et ne selectionnaient pas les colonnes
// delivery_latitude / delivery_longitude. Resultat, le livreur recevait toujours
// deliveryLatitude/Longitude = undefined meme quand le client avait pose un point
// exact au checkout.
test("driver views expose delivery coordinates so the map link is precise", (t) => {
  const { menu, orders, drivers } = createSystems(t);
  const item = menu.listPublished()[0];

  // Commande avec coordonnees precises (Hydra centre)
  const withCoords = orders.createOrder(orderBody(item.id, {
    deliveryLatitude: 36.75123,
    deliveryLongitude: 3.04567,
  }));
  orders.updateStatus(withCoords.id, "confirmed");

  // Commande sans coordonnees (chemin de fallback pour anciennes commandes)
  const withoutCoords = orders.createOrder(orderBody(item.id));
  orders.updateStatus(withoutCoords.id, "confirmed");

  // Pool livreur : doit exposer les coords quand elles existent, null sinon.
  const pool = drivers.listPool();
  const pooledWith = pool.find((o) => o.id === withCoords.id);
  const pooledWithout = pool.find((o) => o.id === withoutCoords.id);
  assert.ok(pooledWith, "commande avec coords doit apparaitre dans le pool");
  assert.equal(pooledWith.deliveryLatitude, 36.75123);
  assert.equal(pooledWith.deliveryLongitude, 3.04567);
  assert.ok(pooledWithout, "commande sans coords doit aussi apparaitre dans le pool");
  assert.equal(pooledWithout.deliveryLatitude, null);
  assert.equal(pooledWithout.deliveryLongitude, null);

  // Un livreur prend la course avec coords.
  const driver = drivers.create({ firstName: "Yassine", phone: "+213 555 987 654", pin: "1234" });
  drivers.takeOrder(driver.id, withCoords.id);

  // listActiveOrders() doit garder les coords : c'est celle-la que la PWA lit.
  const active = drivers.listActiveOrders(driver.id);
  assert.equal(active.length, 1);
  assert.equal(active[0].id, withCoords.id);
  assert.equal(active[0].deliveryLatitude, 36.75123);
  assert.equal(active[0].deliveryLongitude, 3.04567);

  // Historique : la commande livree conserve aussi les coords (utile pour audit).
  orders.updateStatus(withCoords.id, "ready");
  drivers.markDelivered(driver.id, withCoords.id);
  const history = drivers.listHistory(driver.id);
  assert.equal(history.length, 1);
  assert.equal(history[0].id, withCoords.id);
  assert.equal(history[0].deliveryLatitude, 36.75123);
  assert.equal(history[0].deliveryLongitude, 3.04567);
});
