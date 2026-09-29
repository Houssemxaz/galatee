import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AnalyticsSystem } from "./analyticsSystem.js";
import { MenuSystem } from "./menuSystem.js";
import { OrderSystem } from "./orderSystem.js";
import { createApp } from "./server.js";
import { ReservationSystem, SqliteReservationStore } from "./reservationSystem.js";

const fixedNow = () => new Date("2026-09-03T12:00:00.000Z");

async function createSystems(t) {
  const uploadRoot = await mkdtemp(join(tmpdir(), "galatee-menu-upload-"));
  const store = new SqliteReservationStore();
  const menu = new MenuSystem({ db: store.db, uploadRoot, now: fixedNow });
  const analytics = new AnalyticsSystem({ db: store.db, now: fixedNow });
  const orders = new OrderSystem({ db: store.db, menu, now: fixedNow });
  t.after(() => store.close());
  t.after(() => rm(uploadRoot, { recursive: true, force: true }));
  return { store, menu, analytics, orders, uploadRoot };
}

test("menu starts with published demo items and keeps draft changes private", async (t) => {
  const { menu } = await createSystems(t);
  assert.equal(menu.listPublished().length, 3);

  const created = menu.create({
    title: "Pappardelle du marché",
    shortDescription: "Sauce tomate fumée",
    longDescription: "Une assiette de saison.",
    price: "32",
    category: "fresca",
    sortOrder: 4,
  });
  assert.equal(created.status, "draft");
  assert.equal(menu.listPublished().length, 3);

  const updated = menu.update(created.id, { title: "Pappardelle du soir" });
  assert.equal(updated.current.title, "Pappardelle du soir");
  assert.equal(menu.publish(created.id).status, "published");
  assert.equal(menu.listPublished().length, 4);
  assert.equal(menu.listPublished().at(-1).price, "32.00");
});

test("menu edits update the price entered by the admin", async (t) => {
  const { menu } = await createSystems(t);
  const created = menu.create({ title: "Prix modifiable", price: "32", category: "fresca" });
  menu.setAvailability(created.id, false);

  const updated = menu.update(created.id, { price: "35.50" });
  assert.equal(updated.current.price, "35.50");
  assert.equal(updated.draft.priceCents, 3_550);
  assert.equal(updated.available, false);

  const published = menu.publish(created.id);
  assert.equal(published.current.price, "35.50");
  assert.equal(menu.listPublished().find((item) => item.id === created.id)?.price, "35.50");

  const restored = menu.update(created.id, { available: true });
  assert.equal(restored.available, true);
});

test("menu items can be archived and restored, but not edited while archived", async (t) => {
  const { menu } = await createSystems(t);
  const created = menu.create({
    title: "Pappardelle du marché",
    shortDescription: "Sauce tomate fumée",
    longDescription: "Une assiette de saison.",
    price: "32",
    category: "fresca",
    sortOrder: 4,
  });
  menu.publish(created.id);

  const archived = menu.archive(created.id);
  assert.equal(archived.status, "archived");
  assert.ok(archived.archivedAt);
  assert.equal(menu.listPublished().some((item) => item.id === created.id), false);
  assert.equal(menu.listAdmin({}).some((item) => item.id === created.id), false);
  assert.equal(menu.listAdmin({ includeArchived: true }).some((item) => item.id === created.id), true);

  assert.throws(() => menu.update(created.id, { title: "Nouveau nom" }), (error) => error.code === "MENU_ITEM_ARCHIVED");
  assert.throws(() => menu.publish(created.id), (error) => error.code === "MENU_ITEM_ARCHIVED");

  const restored = menu.restore(created.id);
  assert.equal(restored.status, "draft");
  assert.equal(restored.archivedAt, null);
  assert.equal(menu.listAdmin({}).some((item) => item.id === created.id), true);
  // Restoring must never re-publish it automatically - a customer shouldn't
  // suddenly see something staff only meant to bring back for review.
  assert.equal(menu.listPublished().some((item) => item.id === created.id), false);

  assert.throws(() => menu.restore(created.id), (error) => error.code === "MENU_ITEM_NOT_ARCHIVED");
});


test("menu image upload validates bytes and creates a local generated asset path", async (t) => {
  const { menu, uploadRoot } = await createSystems(t);
  const item = menu.create({ title: "Image test", price: 1800, category: "fresca" });
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

  const updated = await menu.uploadImage(item.id, {
    filename: "unsafe../../dish.exe",
    contentType: "image/png",
    data: png,
  });
  assert.match(updated.current.imageUrl, /^\/uploads\/menu\/[0-9a-f-]+\.png$/);
  const files = await (await import("node:fs/promises")).readdir(uploadRoot);
  assert.equal(files.length, 1);
  assert.match(files[0], /^[0-9a-f-]+\.png$/);
});

test("site stats stores menu visits and order funnel events", async (t) => {
  const { analytics } = await createSystems(t);
  const sessionId = "1234567890abcdef";
  analytics.upsertRevenue({ date: "2026-09-03", amount: "12500", note: "Clôture" });
  analytics.recordEvent({ eventName: "menu_viewed", sessionId, pagePath: "/menu" });
  analytics.recordEvent({ eventName: "order_cta_clicked", sessionId, pagePath: "/" });
  analytics.recordEvent({ eventName: "order_submitted", sessionId, pagePath: "/commande" });

  const dashboard = analytics.getDashboard({ from: "2026-09-03", to: "2026-09-03", groupBy: "day" });
  assert.equal(dashboard.currency, "DZD");
  assert.equal(dashboard.totals.revenue, "12500.00");
  assert.equal(dashboard.totals.events.orderCtaClicked, 1);
  assert.equal(dashboard.totals.events.orderSubmitted, 1);
  assert.equal(dashboard.series[0].period, "2026-09-03");

  const siteStats = analytics.getSiteStats({ from: "2026-09-03", to: "2026-09-03", groupBy: "day" });
  assert.equal(siteStats.totals.menuViews, 1);
  assert.equal(siteStats.series[0].menuViews, 1);
  assert.equal(Object.hasOwn(siteStats.totals, "revenue"), false);
});

test("site stats reports traffic, confirmed order revenue and product performance", async (t) => {
  const { menu, analytics, orders } = await createSystems(t);
  const [bestItem, otherItem] = menu.listPublished();
  const orderBody = (itemId, quantity = 1) => ({
    firstName: "Lina",
    lastName: "Martin",
    phone: "+213 555 123 456",
    deliveryMode: "pickup",
    items: [{ productId: itemId, quantity }],
  });
  const first = orders.createOrder(orderBody(bestItem.id, 2));
  orders.updateStatus(first.id, "confirmed");
  const second = orders.createOrder(orderBody(otherItem.id));
  orders.updateStatus(second.id, "confirmed");
  const cancelled = orders.createOrder(orderBody(otherItem.id));
  orders.updateStatus(cancelled.id, "cancelled");

  analytics.recordEvent({ eventName: "page_viewed", sessionId: "1234567890abcdef", pagePath: "/" });
  analytics.recordEvent({ eventName: "page_viewed", sessionId: "fedcba0987654321", pagePath: "/menu" });
  analytics.recordEvent({ eventName: "menu_viewed", sessionId: "1234567890abcdef", pagePath: "/menu" });
  analytics.recordEvent({ eventName: "order_submitted", sessionId: "1234567890abcdef", pagePath: "/commande" });

  const stats = analytics.getSiteStats({ from: "2026-09-03", to: "2026-09-03", groupBy: "day" });
  assert.equal(stats.database, "sqlite");
  assert.equal(stats.totals.siteViews, 2);
  assert.equal(stats.totals.uniqueVisitors, 2);
  assert.equal(stats.totals.orders.received, 3);
  assert.equal(stats.totals.orders.confirmed, 2);
  assert.equal(stats.totals.orders.cancelled, 1);
  assert.equal(stats.totals.orders.revenue, ((bestItem.priceCents * 2 + otherItem.priceCents) / 100).toFixed(2));
  assert.deepEqual(stats.previousPeriod.totals.orders, {
    received: 0,
    confirmed: 0,
    cancelled: 0,
    revenueCents: 0,
    revenue: "0.00",
    confirmationRate: 0,
  });
  assert.equal(stats.products.bestSelling[0].productId, bestItem.id);
  assert.equal(stats.products.leastSelling[0].productId, otherItem.id);
});

test("HTTP menu, upload, revenue and analytics routes preserve admin protection", async (t) => {
  const { store, menu, analytics } = await createSystems(t);
  const system = new ReservationSystem({ store, now: fixedNow });
  const server = createApp({ system, menu, analytics, requiredAdminToken: "admin-secret" });
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const publicMenu = await fetch(`${baseUrl}/api/menu`);
  assert.equal(publicMenu.status, 200);
  assert.equal((await publicMenu.json()).menu.length, 3);

  const unauthorized = await fetch(`${baseUrl}/api/admin/menu`);
  assert.equal(unauthorized.status, 401);

  const headers = { "Content-Type": "application/json", Authorization: "Bearer admin-secret" };
  const createResponse = await fetch(`${baseUrl}/api/admin/menu`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title: "Test HTTP", price: "21", category: "fresca" }),
  });
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();

  const publishResponse = await fetch(`${baseUrl}/api/admin/menu/${created.menuItem.id}/publish`, {
    method: "POST",
    headers,
  });
  assert.equal(publishResponse.status, 200);

  const revenueResponse = await fetch(`${baseUrl}/api/admin/revenue`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ date: "2026-09-03", amount: "12500" }),
  });
  assert.equal(revenueResponse.status, 200);

  const eventResponse = await fetch(`${baseUrl}/api/analytics/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventName: "order_started", sessionId: "1234567890abcdef", pagePath: "/commande" }),
  });
  assert.equal(eventResponse.status, 202);

  const menuViewResponse = await fetch(`${baseUrl}/api/analytics/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventName: "menu_viewed", sessionId: "1234567890abcdef", pagePath: "/menu" }),
  });
  assert.equal(menuViewResponse.status, 202);

  const dashboardResponse = await fetch(`${baseUrl}/api/admin/analytics?from=2026-09-03&to=2026-09-03&groupBy=day`, { headers: { Authorization: "Bearer admin-secret" } });
  assert.equal(dashboardResponse.status, 200);
  const dashboard = await dashboardResponse.json();
  assert.equal(dashboard.totals.revenue, "12500.00");
  assert.equal(dashboard.totals.events.orderStarted, 1);

  const siteStatsResponse = await fetch(`${baseUrl}/api/admin/site-stats?from=2026-09-03&to=2026-09-03&groupBy=day`, { headers: { Authorization: "Bearer admin-secret" } });
  assert.equal(siteStatsResponse.status, 200);
  const siteStats = await siteStatsResponse.json();
  assert.equal(Object.hasOwn(siteStats.totals, "revenue"), false);
  assert.equal(siteStats.totals.menuViews, 1);
});
