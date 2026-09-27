import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "./server.js";
import { AnalyticsSystem } from "./analyticsSystem.js";
import { ClubSystem } from "./clubSystem.js";
import { CustomerAuthSystem } from "./customerAuthSystem.js";
import { DriverSystem } from "./driverSystem.js";
import { LoyaltySystem } from "./loyaltySystem.js";
import { MenuSystem } from "./menuSystem.js";
import { OrderSystem } from "./orderSystem.js";
import { ReservationSystem, SqliteReservationStore } from "./reservationSystem.js";
import { InMemoryRateLimiter } from "./rateLimit.js";
import { InMemoryIdempotencyStore } from "./idempotency.js";

const ORIGIN = "https://galatee.example";

function makeStack(t) {
  const store = new SqliteReservationStore();
  t.after(() => store.close());
  const menu = new MenuSystem({ db: store.db, uploadRoot: "backend/data/uploads/menu" });
  const loyalty = new LoyaltySystem({ db: store.db });
  const orders = new OrderSystem({ db: store.db, menu, loyalty });
  const analytics = new AnalyticsSystem({ db: store.db });
  const customerAuth = new CustomerAuthSystem({ db: store.db, sendEmail: async () => {} });
  const club = new ClubSystem({ db: store.db });
  const drivers = new DriverSystem({ db: store.db });
  const system = new ReservationSystem({ store });
  return { store, menu, loyalty, orders, analytics, customerAuth, club, drivers, system };
}

async function startServer(t, options = {}) {
  const stack = makeStack(t);
  const server = createApp({
    ...stack,
    corsAllowedOrigin: ORIGIN,
    requiredAdminToken: options.requiredAdminToken ?? "admin-secret-value",
    rateLimiters: options.rateLimiters,
    idempotencyStore: options.idempotencyStore,
  });
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return { baseUrl, ...stack };
}

function cookieFrom(response) {
  return response.headers.get("set-cookie")?.split(";")[0] || "";
}

test("admin rejects a wrong token, accepts the right one, and never echoes the token", async (t) => {
  const { baseUrl } = await startServer(t);

  const wrong = await fetch(`${baseUrl}/api/admin/menu`, {
    headers: { Authorization: "Bearer not-the-right-token" },
  });
  assert.equal(wrong.status, 401);
  const wrongText = await wrong.text();
  // Aucune reponse ne doit contenir le token attendu.
  assert.ok(!wrongText.includes("admin-secret-value"));

  const missing = await fetch(`${baseUrl}/api/admin/menu`);
  assert.equal(missing.status, 401);

  const ok = await fetch(`${baseUrl}/api/admin/menu`, {
    headers: { Authorization: "Bearer admin-secret-value" },
  });
  assert.equal(ok.status, 200);
});

test("CORS preflight advertises the configured origin and Idempotency-Key", async (t) => {
  const { baseUrl } = await startServer(t);
  const preflight = await fetch(`${baseUrl}/api/orders`, {
    method: "OPTIONS",
    headers: {
      Origin: ORIGIN,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type, idempotency-key",
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), ORIGIN);
  assert.match(preflight.headers.get("access-control-allow-headers") || "", /Idempotency-Key/);
  assert.equal(preflight.headers.get("access-control-allow-credentials"), "true");
});

test("security headers are set on every response", async (t) => {
  const { baseUrl } = await startServer(t);
  const response = await fetch(`${baseUrl}/health/live`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("permissions-policy") || "", /geolocation=/);
  assert.match(response.headers.get("referrer-policy") || "", /strict-origin/);
  assert.ok(response.headers.get("x-request-id"));
});

test("health live and ready both answer without secrets and with correct statuses", async (t) => {
  const { baseUrl } = await startServer(t);
  const live = await fetch(`${baseUrl}/health/live`);
  assert.equal(live.status, 200);
  assert.deepEqual(await live.json(), { status: "ok" });

  const ready = await fetch(`${baseUrl}/health/ready`);
  assert.equal(ready.status, 200);
  const readyBody = await ready.json();
  assert.equal(readyBody.status, "ok");
  assert.equal(readyBody.database, "ok");
  // Ni le token admin ni les env n apparaissent dans la reponse.
  const text = JSON.stringify(readyBody);
  assert.ok(!text.includes("admin-secret-value"));
});

test("rate limiter returns 429 with a Retry-After after the configured max is exceeded", async (t) => {
  const tinyLimiter = new InMemoryRateLimiter({ windowMs: 60_000, max: 2, name: "order-test" });
  const rateLimiters = {
    auth: new InMemoryRateLimiter({ windowMs: 60_000, max: 999, name: "auth-test" }),
    order: tinyLimiter,
    analytics: new InMemoryRateLimiter({ windowMs: 60_000, max: 999, name: "an-test" }),
    upload: new InMemoryRateLimiter({ windowMs: 60_000, max: 999, name: "up-test" }),
    admin: new InMemoryRateLimiter({ windowMs: 60_000, max: 999, name: "adm-test" }),
  };
  const { baseUrl } = await startServer(t, { rateLimiters });

  const headers = { "Content-Type": "application/json", Origin: ORIGIN };
  // Les 2 premieres passent (elles echoueront avec ORDER_ITEMS_REQUIRED
  // parce que le body est vide, mais elles ne sont PAS 429).
  const first = await fetch(`${baseUrl}/api/orders`, { method: "POST", headers, body: "{}" });
  assert.notEqual(first.status, 429);
  const second = await fetch(`${baseUrl}/api/orders`, { method: "POST", headers, body: "{}" });
  assert.notEqual(second.status, 429);
  const third = await fetch(`${baseUrl}/api/orders`, { method: "POST", headers, body: "{}" });
  assert.equal(third.status, 429);
  assert.ok(Number(third.headers.get("retry-after")) >= 1);
  const body = await third.json();
  assert.equal(body.error?.code, "RATE_LIMITED");
});

async function seedPublishedDish(menu) {
  const item = menu.create({ title: "Pasta test", price: "12", category: "fresca" });
  menu.publish(item.id);
  return item;
}

async function createAccountAndCookie(customerAuth, baseUrl, overrides = {}) {
  const email = overrides.email || `client-${Date.now()}@example.com`;
  customerAuth.createAccount({
    email,
    firstName: overrides.firstName || "Nora",
    lastName: overrides.lastName || "Benali",
    phone: overrides.phone || "+213555111222",
    residenceCommune: "Hydra",
    password: "GoodPassword!1",
  });
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ email, password: "GoodPassword!1" }),
  });
  assert.equal(login.status, 200);
  return { email, cookie: cookieFrom(login) };
}

test("POST /api/orders forces authenticated identity to the session, never the body", async (t) => {
  const { baseUrl, customerAuth, menu } = await startServer(t);
  const item = await seedPublishedDish(menu);
  const { cookie } = await createAccountAndCookie(customerAuth, baseUrl);

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, Cookie: cookie },
    body: JSON.stringify({
      // Tentative de spoofing : le body prétend etre un autre client.
      firstName: "Impersonated",
      lastName: "Attacker",
      phone: "+213111111111",
      email: "attacker@example.com",
      deliveryMode: "delivery",
      communeId: "hydra",
      deliveryAddress: "42 rue Test",
      items: [{ productId: item.id, quantity: 1 }],
    }),
  });
  assert.equal(response.status, 201);
  const payload = await response.json();
  // Le serveur a bien ignore les champs du body et pris ceux de la session.
  assert.equal(payload.order.firstName, "Nora");
  assert.equal(payload.order.lastName, "Benali");
  assert.equal(payload.order.phone, "+213555111222");
  assert.notEqual(payload.order.email, "attacker@example.com");
});

test("Idempotency-Key replays the same order response and does not create duplicates", async (t) => {
  const { baseUrl, customerAuth, menu, orders } = await startServer(t);
  const item = await seedPublishedDish(menu);
  const { cookie } = await createAccountAndCookie(customerAuth, baseUrl, { email: `idem-${Date.now()}@example.com` });

  const headers = {
    "Content-Type": "application/json",
    Origin: ORIGIN,
    Cookie: cookie,
    "Idempotency-Key": "test-idempotency-key-abc-1234",
  };
  const body = JSON.stringify({
    deliveryMode: "delivery",
    communeId: "hydra",
    deliveryAddress: "12 rue des Oliviers",
    items: [{ productId: item.id, quantity: 1 }],
  });

  const first = await fetch(`${baseUrl}/api/orders`, { method: "POST", headers, body });
  assert.equal(first.status, 201);
  const firstBody = await first.json();

  const second = await fetch(`${baseUrl}/api/orders`, { method: "POST", headers, body });
  assert.equal(second.status, 201);
  const secondBody = await second.json();

  // Meme id renvoye = pas de duplicata en base.
  assert.equal(firstBody.order.id, secondBody.order.id);
  const allOrders = orders.listOrders({});
  assert.equal(allOrders.length, 1);
});

test("readMultipartFormData rejects payloads above the configured maximum with 413", async (t) => {
  const { baseUrl } = await startServer(t);
  // Le lecteur multipart rejette >5 MB + 128 kB (voir server.js). On envoie
  // un content-length qui excede clairement la limite : le serveur doit refuser.
  const oversized = "x".repeat(6 * 1024 * 1024); // 6 MB de charge
  const boundary = "----test-boundary";
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="image"; filename="bomb.bin"\r\n` +
    `Content-Type: application/octet-stream\r\n\r\n` +
    `${oversized}\r\n` +
    `--${boundary}--\r\n`;
  const response = await fetch(`${baseUrl}/api/admin/menu/nonexistent-item/image`, {
    method: "POST",
    headers: {
      Authorization: "Bearer admin-secret-value",
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      Origin: ORIGIN,
    },
    body,
  });
  assert.equal(response.status, 413);
});
