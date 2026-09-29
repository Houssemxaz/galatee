import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryIdempotencyStore, readIdempotencyKey } from "./idempotency.js";

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
