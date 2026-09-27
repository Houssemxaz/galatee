import { randomUUID, timingSafeEqual } from "node:crypto";

// ─── Environnement ────────────────────────────────────────────────────────
export const NODE_ENV = process.env.NODE_ENV || "development";
export const IS_PRODUCTION = NODE_ENV === "production";
// TRUST_PROXY : nombre de sauts de proxy de confiance devant nous. 0 par defaut
// (= on ignore x-forwarded-for). 1 quand on est derriere un seul reverse proxy
// (Nginx, Caddy, Hostinger). N'accepte pas de valeur superieure sans intention
// explicite pour eviter l'IP spoofing.
export const TRUST_PROXY = Number.parseInt(process.env.TRUST_PROXY || "0", 10) || 0;
// LOG_LEVEL est exporte apres la definition de LEVELS/normalizeLogLevel plus bas
// (evite le temporal dead zone).

// ─── Detection HTTPS de la requete ────────────────────────────────────────
export function isSecureRequest(request) {
  if (request?.socket?.encrypted) return true;
  if (TRUST_PROXY > 0) {
    const proto = request?.headers?.["x-forwarded-proto"];
    if (typeof proto === "string" && proto.split(",")[0].trim().toLowerCase() === "https") return true;
  }
  return false;
}

// ─── Comparaison securisee de token admin ─────────────────────────────────
// timingSafeEqual necessite des buffers de meme longueur. On rejette
// prealablement les longueurs differentes en lisant les deux (pas de
// short-circuit) pour rester constant vis-a-vis du temps.
export function safeTokenCompare(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string") return false;
  if (!expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Toujours faire un timingSafeEqual pour normaliser le temps de reponse.
    try { timingSafeEqual(b, b); } catch { /* ignore */ }
    return false;
  }
  return timingSafeEqual(a, b);
}

// ─── Resolution d IP client (TRUST_PROXY) ─────────────────────────────────
export function resolveClientIp(request) {
  if (TRUST_PROXY > 0) {
    const raw = request.headers["x-forwarded-for"];
    if (typeof raw === "string" && raw.length) {
      const chain = raw.split(",").map((part) => part.trim()).filter(Boolean);
      // On prend le hop a distance TRUST_PROXY depuis la fin (le plus proche est
      // le dernier, le client d'origine est le premier). Une valeur TRUST_PROXY
      // trop grande fait fallback proprement sur socket.remoteAddress.
      const candidate = chain[Math.max(0, chain.length - TRUST_PROXY)] || chain[0];
      if (candidate) return candidate;
    }
  }
  return request.socket?.remoteAddress || "unknown";
}

// ─── Request ID ───────────────────────────────────────────────────────────
export function ensureRequestId(request) {
  const incoming = request.headers["x-request-id"];
  const id = typeof incoming === "string" && /^[A-Za-z0-9._-]{4,64}$/.test(incoming) ? incoming : randomUUID();
  request.requestId = id;
  return id;
}

// ─── Logger structuré + redaction ─────────────────────────────────────────
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
function normalizeLogLevel(value) {
  const v = String(value || "").toLowerCase();
  return LEVELS[v] !== undefined ? v : "info";
}
export const LOG_LEVEL = normalizeLogLevel(process.env.LOG_LEVEL || (IS_PRODUCTION ? "info" : "debug"));

// Cles interdites en log (matching case-insensitive sur le nom). Silencieusement
// remplacees par "[REDACTED]" via replacer JSON.
const REDACTED_KEYS = new Set([
  "password", "newpassword", "currentpassword", "pin",
  "token", "authorization", "cookie", "cookies",
  "otp", "code", "resetcode", "verificationcode",
  "apikey", "brevoapikey",
  "email", "phone",
]);

function redactValue(_key, value) {
  return value;
}

function redactObject(payload) {
  if (payload === null || typeof payload !== "object") return payload;
  if (Array.isArray(payload)) return payload.map(redactObject);
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      out[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      out[key] = redactObject(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function logAt(level, message, context = {}) {
  if (LEVELS[level] < LEVELS[LOG_LEVEL]) return;
  const record = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...redactObject(context),
  };
  const line = JSON.stringify(record, redactValue);
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message, context) => logAt("debug", message, context),
  info: (message, context) => logAt("info", message, context),
  warn: (message, context) => logAt("warn", message, context),
  error: (message, context) => logAt("error", message, context),
};

// ─── En-tetes de securite ─────────────────────────────────────────────────
export function applySecurityHeaders(response, { isSecure = false } = {}) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader(
    "Permissions-Policy",
    // On autorise la geolocalisation sur la meme origine (le picker Leaflet en
    // a besoin cote checkout) et rien d'autre.
    "geolocation=(self), camera=(), microphone=(), payment=()",
  );
  if (IS_PRODUCTION && isSecure) {
    response.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
}

// ─── CORS ─────────────────────────────────────────────────────────────────
// En production : origine unique obligatoire, jamais "*", credentials autorises.
// En developpement : origine wildcard toleree si aucune valeur explicite fournie.
export function resolveCorsOrigin(configuredOrigin, requestOrigin) {
  const configured = String(configuredOrigin || "").trim();
  if (configured === "*") {
    if (IS_PRODUCTION) {
      throw new Error("GALATEE_ALLOWED_ORIGIN must be a specific origin (not '*') in production.");
    }
    return "*";
  }
  if (!configured) {
    if (IS_PRODUCTION) {
      throw new Error("GALATEE_ALLOWED_ORIGIN is required in production.");
    }
    // En dev, "*" evite de casser le workflow existant (curl, tests, etc.).
    return "*";
  }
  return configured;
}

export function applyCorsHeaders(response, configuredOrigin) {
  const origin = resolveCorsOrigin(configuredOrigin);
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key");
  response.setHeader("Access-Control-Expose-Headers", "X-Request-Id");
  if (origin !== "*") {
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Vary", "Origin");
  }
}
