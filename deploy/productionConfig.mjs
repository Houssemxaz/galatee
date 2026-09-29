const PLACEHOLDER_MARKERS = [
  "CHANGE_ME",
  "REPLACE_ME",
  "example.com",
  "your-domain",
];

export function parseEnvText(text) {
  const values = {};
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export function validateProductionConfig(values) {
  const env = values || {};
  const errors = [];
  const warnings = [];
  const requireValue = (key, label = key) => {
    const value = String(env[key] || "").trim();
    if (!value || isPlaceholder(value)) errors.push(`${label} doit être renseigné avec une vraie valeur.`);
    return value;
  };

  if (env.NODE_ENV !== "production") errors.push("NODE_ENV doit être exactement production.");
  if (env.GALATEE_DATABASE !== "postgres") errors.push("GALATEE_DATABASE doit être exactement postgres.");

  const databaseUrl = requireValue("DATABASE_URL", "DATABASE_URL");
  const postgresUser = requireValue("POSTGRES_USER", "POSTGRES_USER");
  const postgresPassword = requireValue("POSTGRES_PASSWORD", "POSTGRES_PASSWORD");
  const postgresDb = requireValue("POSTGRES_DB", "POSTGRES_DB");

  if (databaseUrl) {
    try {
      const parsed = new URL(databaseUrl);
      if (!/^postgres(?:ql)?$/.test(parsed.protocol.replace(":", ""))) {
        errors.push("DATABASE_URL doit utiliser le protocole postgresql://.");
      }
      if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
        errors.push("DATABASE_URL ne doit pas utiliser localhost depuis le conteneur app; utilisez le service postgres.");
      }
      if (postgresUser && decodeURIComponent(parsed.username) !== postgresUser) {
        errors.push("DATABASE_URL et POSTGRES_USER ne correspondent pas.");
      }
      if (postgresDb && decodeURIComponent(parsed.pathname.replace(/^\//, "")) !== postgresDb) {
        errors.push("DATABASE_URL et POSTGRES_DB ne correspondent pas.");
      }
      if (postgresPassword && decodeURIComponent(parsed.password) !== postgresPassword) {
        errors.push("DATABASE_URL et POSTGRES_PASSWORD ne correspondent pas.");
      }
    } catch {
      errors.push("DATABASE_URL doit être une URL PostgreSQL valide.");
    }
  }

  const adminToken = requireValue("GALATEE_ADMIN_TOKEN", "GALATEE_ADMIN_TOKEN");
  if (adminToken && adminToken.length < 32) {
    errors.push("GALATEE_ADMIN_TOKEN doit contenir au moins 32 caractères.");
  }

  const allowedOrigin = requireValue("GALATEE_ALLOWED_ORIGIN", "GALATEE_ALLOWED_ORIGIN");
  if (allowedOrigin) {
    try {
      const origin = new URL(allowedOrigin);
      if (origin.protocol !== "https:") errors.push("GALATEE_ALLOWED_ORIGIN doit utiliser HTTPS en production.");
      if (origin.pathname !== "/" || origin.search || origin.hash) {
        errors.push("GALATEE_ALLOWED_ORIGIN doit être une origine seule, sans chemin ni paramètres.");
      }
    } catch {
      errors.push("GALATEE_ALLOWED_ORIGIN doit être une URL HTTPS valide.");
    }
  }

  const uploadDir = requireValue("GALATEE_UPLOAD_DIR", "GALATEE_UPLOAD_DIR");
  if (uploadDir && !uploadDir.startsWith("/")) {
    errors.push("GALATEE_UPLOAD_DIR doit être un chemin absolu Linux.");
  }

  const trustProxy = String(env.TRUST_PROXY || "").trim();
  if (!/^\d+$/.test(trustProxy)) errors.push("TRUST_PROXY doit être un entier supérieur ou égal à 0.");

  const redisUrl = String(env.REDIS_URL || "").trim();
  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);
      if (!/^rediss?:$/.test(parsed.protocol)) errors.push("REDIS_URL doit utiliser redis:// ou rediss://.");
    } catch {
      errors.push("REDIS_URL doit être une URL Redis valide.");
    }
    const redisPassword = requireValue("REDIS_PASSWORD", "REDIS_PASSWORD");
    if (redisPassword && redisPassword.length < 16) {
      errors.push("REDIS_PASSWORD doit contenir au moins 16 caractères.");
    }
  } else {
    warnings.push("REDIS_URL est vide : le rate limiting et l'idempotence resteront en mémoire pour une instance unique.");
  }

  if (!env.BREVO_API_KEY || !env.MAIL_FROM_EMAIL) {
    warnings.push("Les variables Brevo sont incomplètes : les emails transactionnels ne seront pas disponibles.");
  }

  return { errors, warnings };
}

function isPlaceholder(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return !normalized || PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker.toLowerCase()));
}
