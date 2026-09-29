import { randomUUID, timingSafeEqual } from "node:crypto";

export const NODE_ENV = process.env.NODE_ENV || "development";
export const IS_PRODUCTION = NODE_ENV === "production";
export const TRUST_PROXY = Number.parseInt(process.env.TRUST_PROXY || "0", 10) || 0;

export function isSecureRequest(request) {
  if (request?.socket?.encrypted) return true;
  if (TRUST_PROXY > 0) {
    const proto = request?.headers?.["x-forwarded-proto"];
    return typeof proto === "string" && proto.split(",")[0].trim().toLowerCase() === "https";
  }
  return false;
}

export function safeTokenCompare(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string" || !expected) return false;
  const actual = Buffer.from(provided);
  const target = Buffer.from(expected);
  if (actual.length !== target.length) {
    timingSafeEqual(target, target);
    return false;
  }
  return timingSafeEqual(actual, target);
}

export function resolveClientIp(request) {
  if (TRUST_PROXY > 0) {
    const forwarded = request?.headers?.["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
      const chain = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
      const candidate = chain[Math.max(0, chain.length - TRUST_PROXY)];
      if (candidate) return candidate;
    }
  }
  return request?.socket?.remoteAddress || "unknown";
}

export function ensureRequestId(request) {
  const incoming = request?.headers?.["x-request-id"];
  const requestId = typeof incoming === "string" && /^[A-Za-z0-9._-]{4,64}$/.test(incoming)
    ? incoming
    : randomUUID();
  request.requestId = requestId;
  return requestId;
}

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const REDACTED_KEYS = new Set([
  "password", "newpassword", "currentpassword", "pin", "token", "authorization",
  "cookie", "cookies", "otp", "code", "resetcode", "verificationcode", "apikey",
  "brevoapikey", "email", "phone",
]);
const LOG_LEVEL = normalizeLogLevel(process.env.LOG_LEVEL || (IS_PRODUCTION ? "info" : "debug"));

function normalizeLogLevel(value) {
  const level = String(value || "").toLowerCase();
  return LEVELS[level] === undefined ? "info" : level;
}

function redact(payload) {
  if (!payload || typeof payload !== "object") return payload;
  if (Array.isArray(payload)) return payload.map(redact);
  return Object.fromEntries(Object.entries(payload).map(([key, value]) => [
    key,
    REDACTED_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : redact(value),
  ]));
}

function logAt(level, message, context = {}) {
  if (LEVELS[level] < LEVELS[LOG_LEVEL]) return;
  const record = { ts: new Date().toISOString(), level, msg: message, ...redact(context) };
  const line = JSON.stringify(record);
  if (level === "warn" || level === "error") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (message, context) => logAt("debug", message, context),
  info: (message, context) => logAt("info", message, context),
  warn: (message, context) => logAt("warn", message, context),
  error: (message, context) => logAt("error", message, context),
};

export function applySecurityHeaders(response, { isSecure = false } = {}) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Permissions-Policy", "geolocation=(self), camera=(), microphone=(), payment=()");
  if (IS_PRODUCTION && isSecure) {
    response.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
}

export function resolveCorsOrigin(configuredOrigin) {
  const origin = String(configuredOrigin || "").trim();
  if (IS_PRODUCTION && (!origin || origin === "*")) {
    throw new Error("GALATEE_ALLOWED_ORIGIN must be a specific origin in production.");
  }
  return origin || "*";
}

export function applyCorsHeaders(response, configuredOrigin) {
  const origin = resolveCorsOrigin(configuredOrigin);
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key");
  response.setHeader("Access-Control-Expose-Headers", "X-Request-Id, Idempotent-Replay");
  if (origin !== "*") {
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Vary", "Origin");
  }
}
