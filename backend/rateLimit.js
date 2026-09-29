import { resolveClientIp } from "./security.js";

export class InMemoryRateLimiter {
  constructor({ windowMs, max, name = "default" } = {}) {
    if (!windowMs || !max) throw new Error("InMemoryRateLimiter requires windowMs and max.");
    this.windowMs = Number(windowMs);
    this.max = Number(max);
    this.name = name;
    this.buckets = new Map();
  }

  hit(key, now = Date.now()) {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      this.sweep(now);
      return { allowed: true, remaining: Math.max(0, this.max - 1), retryAfterSeconds: 0 };
    }
    bucket.count += 1;
    if (bucket.count > this.max) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      };
    }
    return { allowed: true, remaining: this.max - bucket.count, retryAfterSeconds: 0 };
  }

  sweep(now = Date.now()) {
    if (this.buckets.size < 512) return;
    let inspected = 0;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
      if (++inspected >= 128) break;
    }
  }
}

export function limiterFromEnv(name, defaults) {
  const prefix = name.toUpperCase();
  const windowMs = Number.parseInt(process.env[`RL_${prefix}_WINDOW_MS`] || "", 10) || defaults.windowMs;
  const max = Number.parseInt(process.env[`RL_${prefix}_MAX`] || "", 10) || defaults.max;
  return new InMemoryRateLimiter({ windowMs, max, name });
}

export function applyRateLimit(limiter, request, response, scope = "default") {
  const outcome = limiter.hit(`${limiter.name}:${scope}:${resolveClientIp(request)}`);
  if (outcome.allowed) return true;
  response.writeHead(429, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Retry-After": String(outcome.retryAfterSeconds),
  });
  response.end(JSON.stringify({
    error: {
      code: "RATE_LIMITED",
      message: "Trop de requêtes. Réessayez plus tard.",
      retryAfterSeconds: outcome.retryAfterSeconds,
    },
  }));
  return false;
}
