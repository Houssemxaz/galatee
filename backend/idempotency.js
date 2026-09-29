const KEY_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;
const DEFAULT_TTL_MS = 10 * 60 * 1000;

export class InMemoryIdempotencyStore {
  constructor({ ttlMs = DEFAULT_TTL_MS } = {}) {
    this.ttlMs = ttlMs;
    this.entries = new Map();
  }

  get(scope, key, now = Date.now()) {
    const entry = this.entries.get(`${scope}:${key}`);
    if (!entry) return null;
    if (entry.expiresAt <= now) {
      this.entries.delete(`${scope}:${key}`);
      return null;
    }
    return entry;
  }

  beginOrGet(scope, key, now = Date.now()) {
    const fullKey = `${scope}:${key}`;
    const existing = this.get(scope, key, now);
    if (existing) return { acquired: false, entry: existing };
    const entry = { status: "in_flight", expiresAt: now + this.ttlMs };
    this.entries.set(fullKey, entry);
    return { acquired: true, entry };
  }

  complete(scope, key, response, now = Date.now()) {
    const entry = { status: "done", response, expiresAt: now + this.ttlMs };
    this.entries.set(`${scope}:${key}`, entry);
    return entry;
  }

  release(scope, key) {
    const fullKey = `${scope}:${key}`;
    if (this.entries.get(fullKey)?.status === "in_flight") this.entries.delete(fullKey);
  }
}

export function readIdempotencyKey(request) {
  const value = String(request?.headers?.["idempotency-key"] || "").trim();
  return KEY_PATTERN.test(value) ? value : null;
}
