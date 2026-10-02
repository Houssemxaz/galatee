import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryRateLimiter, RedisRateLimiter } from "./rateLimit.js";

test("InMemoryRateLimiter returns a retry window after the limit", () => {
  const limiter = new InMemoryRateLimiter({ windowMs: 1000, max: 1, name: "test" });
  assert.equal(limiter.hit("client", 0).allowed, true);
  const blocked = limiter.hit("client", 100);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 1);
  assert.equal(limiter.hit("client", 1001).allowed, true);
});

test("RedisRateLimiter keeps the window and counter in the shared client", async () => {
  const values = new Map();
  const client = {
    async eval(_script, { keys, arguments: args }) {
      const key = keys[0];
      const current = (values.get(key)?.count || 0) + 1;
      values.set(key, { count: current, ttl: Number(args[0]) });
      return [current, values.get(key).ttl];
    },
  };
  const limiter = new RedisRateLimiter({ client, windowMs: 1_000, max: 1, name: "orders" });

  assert.deepEqual(await limiter.hit("orders:ip"), { allowed: true, remaining: 0, retryAfterSeconds: 0 });
  assert.deepEqual(await limiter.hit("orders:ip"), { allowed: false, remaining: 0, retryAfterSeconds: 1 });
});
