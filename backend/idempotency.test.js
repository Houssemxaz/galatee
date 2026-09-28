import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryIdempotencyStore, readIdempotencyKey } from "./idempotency.js";

test("readIdempotencyKey validates format and rejects noise", () => {
  assert.equal(readIdempotencyKey({ headers: {} }), null);
  assert.equal(readIdempotencyKey({ headers: { "idempotency-key": "" } }), null);
  assert.equal(readIdempotencyKey({ headers: { "idempotency-key": "short" } }), null);
  assert.equal(readIdempotencyKey({ headers: { "idempotency-key": "bad space in key" } }), null);
  assert.equal(readIdempotencyKey({ headers: { "idempotency-key": "abc123-DEF_.abc123" } }), "abc123-DEF_.abc123");
});

test("InMemoryIdempotencyStore locks in-flight and returns a completed response", () => {
  const store = new InMemoryIdempotencyStore({ ttlMs: 60_000 });
  const first = store.beginOrGet("cust:1", "key-XYZ-1234");
  assert.equal(first.acquired, true);

  // Une deuxieme requete concurrente voit le verrou.
  const second = store.beginOrGet("cust:1", "key-XYZ-1234");
  assert.equal(second.acquired, false);
  assert.equal(second.entry.status, "in_flight");

  // Une fois complete, la meme cle rejoue la reponse memorisee.
  store.complete("cust:1", "key-XYZ-1234", { orderId: "abc" });
  const done = store.get("cust:1", "key-XYZ-1234");
  assert.equal(done.status, "done");
  assert.deepEqual(done.response, { orderId: "abc" });

  // Scope different = clef differente.
  assert.equal(store.get("cust:2", "key-XYZ-1234"), null);
});

test("InMemoryIdempotencyStore release() lets a failed request retry", () => {
  const store = new InMemoryIdempotencyStore({ ttlMs: 60_000 });
  const first = store.beginOrGet("cust:9", "key-XYZ-9999");
  assert.equal(first.acquired, true);
  store.release("cust:9", "key-XYZ-9999");
  const retry = store.beginOrGet("cust:9", "key-XYZ-9999");
  assert.equal(retry.acquired, true);
});
