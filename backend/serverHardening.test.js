import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "./server.js";
import { InMemoryRateLimiter } from "./rateLimit.js";
import { InMemoryIdempotencyStore } from "./idempotency.js";

async function startTestServer(t, options = {}) {
  const calls = [];
  const server = createApp({
    requiredAdminToken: "test-admin-token",
    database: { prepare: () => ({ get: () => ({ ok: 1 }) }) },
    menu: { listAdmin: () => [] },
    customerAuth: { getSession: () => null },
    orders: {
      createOrder: (body) => {
        calls.push(body);
        return { id: "order-1", status: "pending" };
      },
    },
    rateLimiters: options.rateLimiters,
    idempotencyStore: options.idempotencyStore,
  });
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, calls };
}

test("health endpoints and security headers are available without credentials", async (t) => {
  const { baseUrl } = await startTestServer(t);
  const live = await fetch(`${baseUrl}/health/live`);
  assert.equal(live.status, 200);
  assert.equal((await live.json()).status, "ok");
  assert.equal(live.headers.get("x-content-type-options"), "nosniff");
  assert.match(live.headers.get("x-request-id") || "", /^[a-f0-9-]{20,}$/);

  const ready = await fetch(`${baseUrl}/health/ready`);
  assert.equal(ready.status, 200);
  assert.equal((await ready.json()).database, "ok");
});

test("admin rate limiting returns 429 and Retry-After", async (t) => {
  const limiter = new InMemoryRateLimiter({ windowMs: 60_000, max: 1, name: "admin-test" });
  const rateLimiters = {
    auth: limiter,
    order: limiter,
    analytics: limiter,
    upload: limiter,
    admin: limiter,
  };
  const { baseUrl } = await startTestServer(t, { rateLimiters });
  const headers = { Authorization: "Bearer test-admin-token" };
  assert.equal((await fetch(`${baseUrl}/api/admin/menu`, { headers })).status, 200);
  const blocked = await fetch(`${baseUrl}/api/admin/menu`, { headers });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("retry-after"), "60");
});

test("Idempotency-Key prevents duplicate orders", async (t) => {
  const { baseUrl, calls } = await startTestServer(t, { idempotencyStore: new InMemoryIdempotencyStore() });
  const headers = { "Content-Type": "application/json", "Idempotency-Key": "checkout-123" };
  const first = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify({ phone: "+213555123456", items: [] }),
  });
  const second = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify({ phone: "+213555123456", items: [] }),
  });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(second.headers.get("idempotent-replay"), "true");
  assert.equal(calls.length, 1);
});
