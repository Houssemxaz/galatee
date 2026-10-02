import test from "node:test";
import assert from "node:assert/strict";
import { MenuSystem } from "./menuSystem.js";
import { OrderSystem } from "./orderSystem.js";
import { PromotionError, PromotionSystem } from "./promotionsSystem.js";
import { SqliteReservationStore } from "./reservationSystem.js";

const fixedNow = () => new Date("2026-09-29T18:00:00.000Z");

function createSystems(t) {
  const store = new SqliteReservationStore();
  t.after(() => store.close());
  const menu = new MenuSystem({ db: store.db, uploadRoot: "backend/data/uploads/menu", now: fixedNow });
  const promotions = new PromotionSystem({ db: store.db, now: fixedNow });
  const orders = new OrderSystem({ db: store.db, menu, promotions, now: fixedNow });
  return { store, menu, promotions, orders };
}

function orderBody(items) {
  return {
    firstName: "Lina",
    lastName: "Martin",
    phone: "+213 555 123 456",
    email: "lina@example.com",
    deliveryMode: "pickup",
    items,
  };
}

test("direct item promotions can have different values per dish", (t) => {
  const { menu, promotions } = createSystems(t);
  const [first, second] = menu.listPublished();
  const firstPromotion = promotions.create({
    title: "Pomodoro du jour",
    rewardType: "percentage",
    rewardValue: 10,
    scope: "items",
    targetIds: [first.id],
  });
  const secondPromotion = promotions.create({
    title: "Carbonara du jour",
    rewardType: "percentage",
    rewardValue: 20,
    scope: "items",
    targetIds: [second.id],
  });

  const preview = promotions.previewBest([
    { productId: first.id, quantity: 1, lineTotalCents: first.priceCents },
    { productId: second.id, quantity: 1, lineTotalCents: second.priceCents },
  ]);
  assert.equal(preview.id, secondPromotion.id);
  assert.equal(preview.discountCents, Math.floor(second.priceCents * 20 / 100));
  assert.notEqual(firstPromotion.id, secondPromotion.id);
});

test("one individual promotion can target several dishes and calculate each line", (t) => {
  const { menu, promotions } = createSystems(t);
  const [first, second] = menu.listPublished();
  const promotion = promotions.create({
    title: "Pasta du jour",
    rewardType: "fixed",
    rewardValue: 10,
    scope: "items",
    targetIds: [first.id, second.id],
  });

  const preview = promotions.preview(promotion, [
    { productId: first.id, quantity: 2, lineTotalCents: first.priceCents * 2 },
    { productId: second.id, quantity: 1, lineTotalCents: second.priceCents },
  ]);
  assert.equal(preview.discountCents, 3000);
});

test("pack promotions apply only when every target dish is present", (t) => {
  const { menu, promotions } = createSystems(t);
  const [first, second, other] = menu.listPublished();
  const pack = promotions.create({
    title: "Duo Pasta",
    rewardType: "fixed",
    rewardValue: 100,
    scope: "pack",
    targetIds: [first.id, second.id],
  });
  assert.equal(promotions.preview(pack, [
    { productId: first.id, quantity: 1, lineTotalCents: first.priceCents },
  ]), null);

  const preview = promotions.preview(pack, [
    { productId: first.id, quantity: 1, lineTotalCents: first.priceCents },
    { productId: second.id, quantity: 1, lineTotalCents: second.priceCents },
    { productId: other.id, quantity: 1, lineTotalCents: other.priceCents },
  ]);
  assert.equal(
    preview.discountCents,
    Math.min(first.priceCents + second.priceCents, 10000),
  );
  assert.equal(preview.eligibleAmountCents, first.priceCents + second.priceCents);
});

test("direct promotions are applied to an order without a loyalty account", (t) => {
  const { menu, promotions, orders } = createSystems(t);
  const [first] = menu.listPublished();
  const promotion = promotions.create({
    title: "Remise déjeuner",
    rewardType: "percentage",
    rewardValue: 15,
    scope: "items",
    targetIds: [first.id],
  });
  const order = orders.createOrder(orderBody([{ productId: first.id, quantity: 1 }]));
  assert.equal(order.promotionId, promotion.id);
  assert.equal(order.discountCents, Math.floor(first.priceCents * 15 / 100));
  assert.equal(order.totalCents, first.priceCents - order.discountCents);
});

test("promotion validation keeps item and pack targets unambiguous", (t) => {
  const { promotions } = createSystems(t);
  assert.throws(
    () => promotions.create({ title: "Promo", rewardType: "percentage", rewardValue: 10, scope: "items", targetIds: [] }),
    (error) => error instanceof PromotionError && error.code === "PROMOTION_ITEM_TARGET_REQUIRED",
  );
  assert.throws(
    () => promotions.create({ title: "Pack", rewardType: "percentage", rewardValue: 10, scope: "pack", targetIds: ["one"] }),
    (error) => error instanceof PromotionError && error.code === "PROMOTION_PACK_TARGET_REQUIRED",
  );
  const individual = promotions.create({
    title: "Deux plats",
    rewardType: "percentage",
    rewardValue: 10,
    scope: "items",
    targetIds: ["one", "two"],
  });
  assert.deepEqual(individual.targetIds, ["one", "two"]);
});
