import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryIdempotencyStore, RedisIdempotencyStore, readIdempotencyKey } from "./idempotency.js";

test("idempotency store replays a completed response and releases failed work", () => {
  const store = new InMemoryIdempotencyStore({ ttlMs: 100 });
  assert.equal(store.beginOrGet("client", "checkout-123").acquired, true);
  assert.equal(store.beginOrGet("client", "checkout-123").acquired, false);
  store.complete("client", "checkout-123", { order: { id: "1" } });
  assert.deepEqual(store.get("client", "checkout-123").response, { order: { id: "1" } });
  store.beginOrGet("client", "failed-123");
  store.release("client", "failed-123");
  assert.equal(store.beginOrGet("client", "failed-123").acquired, true);
});

test("readIdempotencyKey accepts bounded safe keys only", () => {
  assert.equal(readIdempotencyKey({ headers: { "idempotency-key": "checkout-123" } }), "checkout-123");
  assert.equal(readIdempotencyKey({ headers: { "idempotency-key": "short" } }), null);
  assert.equal(readIdempotencyKey({ headers: { "idempotency-key": "bad key 123" } }), null);
});

test("RedisIdempotencyStore acquires once and replays a completed response", async () => {
  const values = new Map();
  const client = {
    async get(key) { return values.get(key)?.value || null; },
    async set(key, value, options = {}) {
      if (options.NX && values.has(key)) return null;
      values.set(key, { value, ttl: options.PX });
      return "OK";
    },
    async eval(_script, { keys, arguments: args }) {
      const current = values.get(keys[0]);
      if (current?.value === args[0]) values.delete(keys[0]);
      return 1;
    },
  };
  const store = new RedisIdempotencyStore({ client, ttlMs: 1_000 });

  const first = await store.beginOrGet("anonymous:test", "checkout-123", 100);
  const second = await store.beginOrGet("anonymous:test", "checkout-123", 100);
  assert.equal(first.acquired, true);
  assert.equal(second.acquired, false);
  assert.equal(second.entry.status, "in_flight");

  await store.complete("anonymous:test", "checkout-123", { order: { id: "1" } }, 100);
  assert.deepEqual(await store.get("anonymous:test", "checkout-123", 100), {
    status: "done",
    response: { order: { id: "1" } },
    expiresAt: 1_100,
  });
});
