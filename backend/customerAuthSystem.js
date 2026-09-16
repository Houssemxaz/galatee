import {
  createHash,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;
export const CUSTOMER_SESSION_COOKIE = "galatee_customer_session";

export class CustomerAuthError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = "CustomerAuthError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class CustomerAuthSystem {
  constructor({
    db,
    now = () => new Date(),
    sendEmail = null,
    brevoApiKey = process.env.BREVO_API_KEY || "",
    mailFromEmail = process.env.MAIL_FROM_EMAIL || "",
    mailFromName = process.env.MAIL_FROM_NAME || "Galatee",
    fetchImpl = (...args) => fetch(...args),
    logger = console,
  } = {}) {
    if (!db) throw new Error("CustomerAuthSystem requires a database.");
    this.db = db;
    this.now = now;
    this.sendEmail = sendEmail;
    this.brevoApiKey = brevoApiKey;
    this.mailFromEmail = mailFromEmail;
    this.mailFromName = mailFromName;
    this.fetchImpl = fetchImpl;
    this.logger = logger;
    this.initializeSchema();
  }

  initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS customer_accounts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        password_hash TEXT,
        password_salt TEXT,
        residence_commune TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login_at TEXT
      );

      CREATE TABLE IF NOT EXISTS customer_login_codes (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        mode TEXT NOT NULL CHECK (mode IN ('signup', 'login')),
        code_hash TEXT NOT NULL,
        first_name TEXT NOT NULL DEFAULT '',
        last_name TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        attempts INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT NOT NULL,
        consumed_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS customer_sessions (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_customer_login_codes_email_created
        ON customer_login_codes (email, created_at);
      CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer_expiry
        ON customer_sessions (customer_id, expires_at);
    `);
    const accountColumns = this.db.prepare("PRAGMA table_info(customer_accounts)").all();
    if (!accountColumns.some((column) => column.name === "password_hash")) this.db.exec("ALTER TABLE customer_accounts ADD COLUMN password_hash TEXT");
    if (!accountColumns.some((column) => column.name === "password_salt")) this.db.exec("ALTER TABLE customer_accounts ADD COLUMN password_salt TEXT");
    if (!accountColumns.some((column) => column.name === "residence_commune")) this.db.exec("ALTER TABLE customer_accounts ADD COLUMN residence_commune TEXT NOT NULL DEFAULT ''");
  }

  async requestCode(input = {}) {
    const mode = normalizeMode(input.mode);
    const email = normalizeEmail(input.email);
    const firstName = normalizeProfileText(input.firstName, "firstName");
    const lastName = normalizeProfileText(input.lastName, "lastName");
    const phone = normalizePhone(input.phone);
    const now = this.now();
    const nowIso = now.toISOString();

    if (mode === "signup" && (!firstName || !lastName || !phone)) {
      throw new CustomerAuthError(
        "AUTH_PROFILE_REQUIRED",
        "First name, last name and phone are required to create an account.",
        400,
      );
    }

    const existingAccount = this.db.prepare(
      "SELECT id FROM customer_accounts WHERE email = ?",
    ).get(email);
    if (mode === "signup" && existingAccount) {
      throw new CustomerAuthError(
        "AUTH_ACCOUNT_EXISTS",
        "An account already exists for this email.",
        409,
      );
    }

    if (mode === "login" && !existingAccount) {
      return {
        accepted: true,
        message: "Si un compte correspond à cette adresse, un code a été envoyé.",
      };
    }

    const recentCode = this.db.prepare(`
      SELECT id FROM customer_login_codes
      WHERE email = ? AND created_at >= ?
      ORDER BY created_at DESC LIMIT 1
    `).get(email, new Date(now.getTime() - CODE_RESEND_COOLDOWN_MS).toISOString());
    if (recentCode) {
      throw new CustomerAuthError(
        "AUTH_CODE_TOO_SOON",
        "Please wait before requesting another code.",
        429,
        { retryAfterSeconds: Math.ceil(CODE_RESEND_COOLDOWN_MS / 1000) },
      );
    }

    this.db.prepare(
      "UPDATE customer_login_codes SET consumed_at = ? WHERE email = ? AND consumed_at IS NULL",
    ).run(nowIso, email);

    const code = String(randomInt(100000, 1000000));
    const codeId = randomBytes(16).toString("hex");
    this.db.prepare(`
      INSERT INTO customer_login_codes (
        id, email, mode, code_hash, first_name, last_name, phone,
        attempts, expires_at, consumed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, ?)
    `).run(
      codeId,
      email,
      mode,
      hashValue(code),
      firstName,
      lastName,
      phone,
      new Date(now.getTime() + CODE_TTL_MS).toISOString(),
      nowIso,
    );

    try {
      await (this.sendEmail
        ? this.sendEmail({ to: email, code, mode, firstName })
        : this.sendViaBrevo({ to: email, code, firstName }));
    } catch (error) {
      this.db.prepare("DELETE FROM customer_login_codes WHERE id = ?").run(codeId);
      if (error instanceof CustomerAuthError) throw error;
      throw new CustomerAuthError(
        "AUTH_EMAIL_SEND_FAILED",
        "The login email could not be sent.",
        503,
      );
    }

    return {
      accepted: true,
      message: "Un code de connexion a été envoyé par email.",
      expiresInSeconds: CODE_TTL_MS / 1000,
    };
  }

  async verifyCode(input = {}) {
    const email = normalizeEmail(input.email);
    const code = String(input.code || "").trim();
    if (!/^\d{6}$/.test(code)) {
      throw new CustomerAuthError("AUTH_CODE_INVALID", "The login code is invalid.", 400);
    }

    const now = this.now();
    const row = this.db.prepare(`
      SELECT * FROM customer_login_codes
      WHERE email = ? AND consumed_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `).get(email);
    if (!row || row.expires_at <= now.toISOString()) {
      throw new CustomerAuthError("AUTH_CODE_INVALID", "The login code is invalid or expired.", 400);
    }
    if (row.attempts >= MAX_CODE_ATTEMPTS) {
      this.consumeCode(row.id, now.toISOString());
      throw new CustomerAuthError("AUTH_CODE_LOCKED", "Too many invalid code attempts.", 429);
    }

    const matches = timingSafeEqual(
      Buffer.from(row.code_hash, "hex"),
      Buffer.from(hashValue(code), "hex"),
    );
    if (!matches) {
      const attempts = row.attempts + 1;
      this.db.prepare(`
        UPDATE customer_login_codes
        SET attempts = ?, consumed_at = CASE WHEN ? >= ? THEN ? ELSE consumed_at END
        WHERE id = ?
      `).run(attempts, attempts, MAX_CODE_ATTEMPTS, now.toISOString(), row.id);
      throw new CustomerAuthError(
        attempts >= MAX_CODE_ATTEMPTS ? "AUTH_CODE_LOCKED" : "AUTH_CODE_INVALID",
        attempts >= MAX_CODE_ATTEMPTS ? "Too many invalid code attempts." : "The login code is invalid.",
        attempts >= MAX_CODE_ATTEMPTS ? 429 : 400,
      );
    }

    this.consumeCode(row.id, now.toISOString());
    const account = this.upsertAccount(row, now);
    return this.createSession(account, now);
  }

  createAccount(input = {}) {
    const profile = normalizeAccountProfile(input, { requireResidence: true });
    const password = normalizePassword(input.password);
    const existing = this.db.prepare("SELECT id FROM customer_accounts WHERE email = ?").get(profile.email);
    if (existing) throw new CustomerAuthError("AUTH_ACCOUNT_EXISTS", "An account already exists for this email.", 409);
    const now = this.now();
    const nowIso = now.toISOString();
    const salt = randomBytes(16).toString("hex");
    const hash = hashPassword(password, salt);
    const id = randomBytes(16).toString("hex");
    this.db.prepare(`
      INSERT INTO customer_accounts (
        id, email, first_name, last_name, phone, password_hash, password_salt,
        residence_commune, created_at, updated_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, profile.email, profile.firstName, profile.lastName, profile.phone, hash, salt, profile.residenceCommune, nowIso, nowIso, nowIso);
    return this.createSession(mapAccountRow(this.db.prepare("SELECT * FROM customer_accounts WHERE id = ?").get(id)), now);
  }

  loginWithPassword(input = {}) {
    const email = normalizeEmail(input.email);
    const password = normalizePassword(input.password);
    const row = this.db.prepare("SELECT * FROM customer_accounts WHERE email = ?").get(email);
    if (!row?.password_hash || !row.password_salt || !verifyPassword(password, row.password_hash, row.password_salt)) {
      throw new CustomerAuthError("AUTH_INVALID_CREDENTIALS", "Email or password is incorrect.", 401);
    }
    const now = this.now();
    const nowIso = now.toISOString();
    this.db.prepare("UPDATE customer_accounts SET last_login_at = ?, updated_at = ? WHERE id = ?").run(nowIso, nowIso, row.id);
    return this.createSession(mapAccountRow(this.db.prepare("SELECT * FROM customer_accounts WHERE id = ?").get(row.id)), now);
  }

  createSession(account, now = this.now()) {
    const sessionToken = randomBytes(32).toString("hex");
    const sessionId = randomBytes(16).toString("hex");
    const nowIso = now.toISOString();
    this.db.prepare("DELETE FROM customer_sessions WHERE customer_id = ? OR expires_at <= ?").run(account.id, nowIso);
    this.db.prepare(`
      INSERT INTO customer_sessions (id, customer_id, token_hash, expires_at, created_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, account.id, hashValue(sessionToken), new Date(now.getTime() + SESSION_TTL_MS).toISOString(), nowIso, nowIso);
    return { account, sessionToken };
  }

  getSession(request) {
    const token = getCookie(request, CUSTOMER_SESSION_COOKIE);
    if (!token) return null;
    const nowIso = this.now().toISOString();
    const row = this.db.prepare(`
      SELECT s.id AS session_id, s.customer_id, s.expires_at,
        a.id, a.email, a.first_name, a.last_name, a.phone, a.residence_commune,
        a.created_at, a.updated_at, a.last_login_at
      FROM customer_sessions s
      JOIN customer_accounts a ON a.id = s.customer_id
      WHERE s.token_hash = ? AND s.expires_at > ?
    `).get(hashValue(token), nowIso);
    if (!row) return null;

    this.db.prepare("UPDATE customer_sessions SET last_seen_at = ? WHERE id = ?").run(nowIso, row.session_id);
    return { sessionId: row.session_id, account: mapAccountRow(row) };
  }

  destroySession(request) {
    const token = getCookie(request, CUSTOMER_SESSION_COOKIE);
    if (!token) return;
    this.db.prepare("DELETE FROM customer_sessions WHERE token_hash = ?").run(hashValue(token));
  }

  async sendViaBrevo({ to, code, firstName }) {
    if (!this.brevoApiKey || !this.mailFromEmail) {
      throw new CustomerAuthError(
        "AUTH_EMAIL_NOT_CONFIGURED",
        "Email delivery is not configured on the backend.",
        503,
      );
    }

    const response = await this.fetchImpl("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": this.brevoApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: this.mailFromEmail, name: this.mailFromName },
        to: [{ email: to, name: firstName || undefined }],
        subject: "Votre code de connexion Galatee",
        textContent: `Votre code Galatee est ${code}. Il est valable 10 minutes.`,
        htmlContent: `<p>Votre code Galatee est <strong>${code}</strong>.</p><p>Il est valable 10 minutes.</p>`,
      }),
    });
    if (!response.ok) {
      const rawBody = await response.text().catch(() => "");
      let providerPayload = null;
      try {
        providerPayload = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        providerPayload = null;
      }
      const providerCode = typeof providerPayload?.code === "string" ? providerPayload.code : "unknown_code";
      const providerMessage = typeof providerPayload?.message === "string"
        ? providerPayload.message.replace(/[\r\n]+/g, " ").slice(0, 240)
        : "No provider message returned";
      this.logger.error(`[Brevo] SMTP API ${response.status} (${providerCode}): ${providerMessage}`);
      throw new CustomerAuthError(
        "AUTH_EMAIL_SEND_FAILED",
        "The email provider rejected the message.",
        503,
        { providerStatus: response.status },
      );
    }
  }

  consumeCode(id, consumedAt) {
    this.db.prepare("UPDATE customer_login_codes SET consumed_at = ? WHERE id = ?").run(consumedAt, id);
  }

  upsertAccount(codeRow, now) {
    const existing = this.db.prepare("SELECT * FROM customer_accounts WHERE email = ?").get(codeRow.email);
    const nowIso = now.toISOString();
    if (existing) {
      this.db.prepare(`
        UPDATE customer_accounts
        SET first_name = CASE WHEN ? <> '' THEN ? ELSE first_name END,
            last_name = CASE WHEN ? <> '' THEN ? ELSE last_name END,
            phone = CASE WHEN ? <> '' THEN ? ELSE phone END,
            residence_commune = CASE WHEN ? <> '' THEN ? ELSE residence_commune END,
            updated_at = ?, last_login_at = ?
        WHERE id = ?
      `).run(
        codeRow.first_name, codeRow.first_name,
        codeRow.last_name, codeRow.last_name,
        codeRow.phone, codeRow.phone,
        codeRow.residence_commune, codeRow.residence_commune,
        nowIso, nowIso, existing.id,
      );
    } else {
      this.db.prepare(`
        INSERT INTO customer_accounts (id, email, first_name, last_name, phone, residence_commune, created_at, updated_at, last_login_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomBytes(16).toString("hex"),
        codeRow.email,
        codeRow.first_name,
        codeRow.last_name,
        codeRow.phone,
        codeRow.residence_commune || "",
        nowIso,
        nowIso,
        nowIso,
      );
    }
    return mapAccountRow(this.db.prepare("SELECT * FROM customer_accounts WHERE email = ?").get(codeRow.email));
  }
}

export function buildSessionCookie(token, request, maxAgeSeconds = SESSION_TTL_MS / 1000) {
  const forwardedProto = String(request?.headers?.["x-forwarded-proto"] || "").split(",")[0].trim();
  const isHttps = forwardedProto === "https" || String(request?.headers?.origin || "").startsWith("https://");
  const attributes = [
    `${CUSTOMER_SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${isHttps ? "None" : "Lax"}`,
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];
  if (isHttps) attributes.push("Secure");
  if (maxAgeSeconds <= 0) attributes.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  return attributes.join("; ");
}

export function mapAccountRow(row) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    residenceCommune: row.residence_commune || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at || null,
  };
}

function normalizeMode(mode) {
  if (mode !== "signup" && mode !== "login") {
    throw new CustomerAuthError("AUTH_MODE_INVALID", "Authentication mode is invalid.", 400);
  }
  return mode;
}

function normalizeEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254) {
    throw new CustomerAuthError("AUTH_EMAIL_INVALID", "A valid email is required.", 400);
  }
  return value;
}

function normalizeProfileText(value, field) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (normalized.length > 80) {
    throw new CustomerAuthError("AUTH_PROFILE_INVALID", `${field} is too long.`, 400);
  }
  return normalized;
}

function normalizeAccountProfile(input, { requireResidence = false } = {}) {
  const firstName = normalizeProfileText(input.firstName, "firstName");
  const lastName = normalizeProfileText(input.lastName, "lastName");
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  const residenceCommune = normalizeProfileText(input.residenceCommune ?? input.residence, "residenceCommune");
  if (!firstName || !lastName || !phone) {
    throw new CustomerAuthError("AUTH_PROFILE_REQUIRED", "First name, last name and phone are required to create an account.", 400);
  }
  if (requireResidence && !residenceCommune) {
    throw new CustomerAuthError("AUTH_RESIDENCE_REQUIRED", "A residence commune is required to create an account.", 400);
  }
  return { firstName, lastName, phone, email, residenceCommune };
}

function normalizePassword(value) {
  const password = String(value || "");
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 128) {
    throw new CustomerAuthError("AUTH_PASSWORD_INVALID", `Password must contain between ${MIN_PASSWORD_LENGTH} and 128 characters.`, 400);
  }
  return password;
}

function normalizePhone(value) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15 || !/^[+()\d. -]+$/.test(normalized)) {
    if (!normalized) return "";
    throw new CustomerAuthError("AUTH_PHONE_INVALID", "A valid phone number is required.", 400);
  }
  return normalized;
}

function hashValue(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password, expectedHash, salt) {
  const actual = Buffer.from(hashPassword(password, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function getCookie(request, name) {
  const cookieHeader = String(request?.headers?.cookie || "");
  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}
