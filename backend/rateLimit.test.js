import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryRateLimiter } from "./rateLimit.js";

test("InMemoryRateLimiter returns a retry window after the limit", () => {
  const limiter = new InMemoryRateLimiter({ windowMs: 1000, max: 1, name: "test" });
  assert.equal(limiter.hit("client", 0).allowed, true);
  const blocked = limiter.hit("client", 100);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 1);
  assert.equal(limiter.hit("client", 1001).allowed, true);
});
