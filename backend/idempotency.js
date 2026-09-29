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

const REDIS_RELEASE_SCRIPT = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`;

export class RedisIdempotencyStore {
  constructor({ client, ttlMs = DEFAULT_TTL_MS, keyPrefix = "galatee:idempotency:" } = {}) {
    if (!client) throw new Error("RedisIdempotencyStore requires a Redis client.");
    this.client = client;
    this.ttlMs = Number(ttlMs);
    this.keyPrefix = keyPrefix;
  }

  key(scope, key) {
    return `${this.keyPrefix}${scope}:${key}`;
  }

  async get(scope, key, now = Date.now()) {
    const raw = await this.client.get(this.key(scope, key));
    if (!raw) return null;
    try {
      const entry = JSON.parse(raw);
      if (!entry?.expiresAt || entry.expiresAt <= now) return null;
      return entry;
    } catch {
      return null;
    }
  }

  async beginOrGet(scope, key, now = Date.now()) {
    const entry = { status: "in_flight", expiresAt: now + this.ttlMs };
    const serialized = JSON.stringify(entry);
    const acquired = await this.client.set(this.key(scope, key), serialized, {
      NX: true,
      PX: this.ttlMs,
    });
    if (acquired === "OK") return { acquired: true, entry };
    return { acquired: false, entry: await this.get(scope, key, now) };
  }

  async complete(scope, key, response, now = Date.now()) {
    const entry = { status: "done", response, expiresAt: now + this.ttlMs };
    await this.client.set(this.key(scope, key), JSON.stringify(entry), { PX: this.ttlMs });
    return entry;
  }

  async release(scope, key) {
    const entry = await this.get(scope, key);
    if (!entry || entry.status !== "in_flight") return;
    await this.client.eval(REDIS_RELEASE_SCRIPT, {
      keys: [this.key(scope, key)],
      arguments: [JSON.stringify(entry)],
    });
  }
}

export function readIdempotencyKey(request) {
  const value = String(request?.headers?.["idempotency-key"] || "").trim();
  return KEY_PATTERN.test(value) ? value : null;
}
