import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryRateLimiter } from "./rateLimit.js";

test("InMemoryRateLimiter counts up to max then blocks with retry-after", () => {
  const limiter = new InMemoryRateLimiter({ windowMs: 60_000, max: 3, name: "test" });
  const now = 1_000_000;
  assert.deepEqual({ ...limiter.hit("k", now), retryAfterSeconds: 0 }, { allowed: true, retryAfterSeconds: 0, remaining: 2 });
  limiter.hit("k", now);
  limiter.hit("k", now);
  const denied = limiter.hit("k", now);
  assert.equal(denied.allowed, false);
  assert.ok(denied.retryAfterSeconds >= 1);
});

test("InMemoryRateLimiter resets the bucket after the window elapses", () => {
  const limiter = new InMemoryRateLimiter({ windowMs: 1_000, max: 1, name: "test" });
  const first = limiter.hit("k", 1_000);
  assert.equal(first.allowed, true);
  const second = limiter.hit("k", 1_500);
  assert.equal(second.allowed, false);
  const third = limiter.hit("k", 2_500);
  assert.equal(third.allowed, true);
});
