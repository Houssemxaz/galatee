import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

const DRIVER_STATUSES = new Set(["offline", "available", "busy"]);
const SESSION_COOKIE = "galatee_driver_session";
const SESSION_TTL_DAYS = 30;

export class DriverError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = "DriverError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class DriverSystem {
  constructor({ db, now = () => new Date() } = {}) {
    if (!db) throw new Error("DriverSystem requires a SQLite database.");
    this.db = db;
    this.now = now;
    this.initializeSchema();
  }

  initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS drivers (
        id TEXT PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL UNIQUE,
        pin_hash TEXT NOT NULL,
        pin_salt TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        current_status TEXT NOT NULL DEFAULT 'offline'
          CHECK (current_status IN ('offline', 'available', 'busy')),
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_seen_at TEXT
      );

      CREATE TABLE IF NOT EXISTS driver_sessions (
        id TEXT PRIMARY KEY,
        driver_id TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        user_agent TEXT NOT NULL DEFAULT ''
      );

      CREATE INDEX IF NOT EXISTS idx_driver_sessions_expires
        ON driver_sessions (driver_id, expires_at);

      CREATE TABLE IF NOT EXISTS driver_push_subscriptions (
        id TEXT PRIMARY KEY,
        driver_id TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  // ─── CRUD (admin) ───────────────────────────────────────────────

  create({ firstName, lastName = "", phone, pin, notes = "", active = true }) {
    const profile = normalizeProfile({ firstName, lastName, phone, notes });
    const normalizedPin = normalizePin(pin);
    const existing = this.db.prepare("SELECT id FROM drivers WHERE phone = ?").get(profile.phone);
    if (existing) throw new DriverError("DRIVER_PHONE_EXISTS", "Un livreur existe déjà avec ce téléphone.", 409);
    const salt = randomBytes(16).toString("hex");
    const hash = hashPin(normalizedPin, salt);
    const id = randomBytes(16).toString("hex");
    const nowIso = this.now().toISOString();
    this.db.prepare(`
      INSERT INTO drivers (id, first_name, last_name, phone, pin_hash, pin_salt, active, current_status, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'offline', ?, ?, ?)
    `).run(id, profile.firstName, profile.lastName, profile.phone, hash, salt, active ? 1 : 0, profile.notes, nowIso, nowIso);
    return this.getById(id);
  }

  update(id, patch = {}) {
    const current = this.getById(id);
    const merged = normalizeProfile({
      firstName: patch.firstName ?? current.firstName,
      lastName: patch.lastName ?? current.lastName,
      phone: patch.phone ?? current.phone,
      notes: patch.notes ?? current.notes,
    });
    // Vérifie l unicité si le téléphone change
    if (merged.phone !== current.phone) {
      const clash = this.db.prepare("SELECT id FROM drivers WHERE phone = ? AND id <> ?").get(merged.phone, id);
      if (clash) throw new DriverError("DRIVER_PHONE_EXISTS", "Un autre livreur utilise déjà ce téléphone.", 409);
    }
    const active = patch.active === undefined ? current.active : Boolean(patch.active);
    const nowIso = this.now().toISOString();
    this.db.prepare(`
      UPDATE drivers
      SET first_name = ?, last_name = ?, phone = ?, notes = ?, active = ?, updated_at = ?
      WHERE id = ?
    `).run(merged.firstName, merged.lastName, merged.phone, merged.notes, active ? 1 : 0, nowIso, id);
    if (patch.pin) {
      this.resetPin(id, patch.pin);
    }
    return this.getById(id);
  }

  resetPin(id, pin) {
    const normalized = normalizePin(pin);
    const salt = randomBytes(16).toString("hex");
    const hash = hashPin(normalized, salt);
    const nowIso = this.now().toISOString();
    const result = this.db.prepare("UPDATE drivers SET pin_hash = ?, pin_salt = ?, updated_at = ? WHERE id = ?")
      .run(hash, salt, nowIso, id);
    if (!result.changes) throw new DriverError("DRIVER_NOT_FOUND", "Livreur introuvable.", 404);
    // Sécurité : on invalide les sessions actives quand le PIN change.
    this.db.prepare("DELETE FROM driver_sessions WHERE driver_id = ?").run(id);
    return true;
  }

  archive(id) {
    const nowIso = this.now().toISOString();
    const result = this.db.prepare("UPDATE drivers SET active = 0, current_status = 'offline', updated_at = ? WHERE id = ?")
      .run(nowIso, id);
    if (!result.changes) throw new DriverError("DRIVER_NOT_FOUND", "Livreur introuvable.", 404);
    this.db.prepare("DELETE FROM driver_sessions WHERE driver_id = ?").run(id);
    return this.getById(id);
  }

  getById(id) {
    const row = this.db.prepare("SELECT * FROM drivers WHERE id = ?").get(id);
    if (!row) throw new DriverError("DRIVER_NOT_FOUND", "Livreur introuvable.", 404);
    return mapDriverRow(row);
  }

  list({ includeInactive = false } = {}) {
    const where = includeInactive ? "" : "WHERE active = 1";
    const rows = this.db.prepare(`SELECT * FROM drivers ${where} ORDER BY active DESC, first_name, last_name`).all();
    return rows.map(mapDriverRow);
  }

  listAvailable() {
    const rows = this.db.prepare(`
      SELECT * FROM drivers
      WHERE active = 1 AND current_status = 'available'
      ORDER BY first_name, last_name
    `).all();
    return rows.map(mapDriverRow);
  }

  // ─── Login livreur (PIN) ────────────────────────────────────────

  loginWithPin({ phone, pin }, { userAgent = "" } = {}) {
    const normalizedPhone = normalizePhone(phone);
    const normalizedPin = normalizePin(pin);
    const row = this.db.prepare("SELECT * FROM drivers WHERE phone = ?").get(normalizedPhone);
    if (!row || !row.active) throw new DriverError("DRIVER_INVALID_CREDENTIALS", "Téléphone ou code incorrect.", 401);
    if (!verifyPin(normalizedPin, row.pin_hash, row.pin_salt)) {
      throw new DriverError("DRIVER_INVALID_CREDENTIALS", "Téléphone ou code incorrect.", 401);
    }
    const sessionId = randomBytes(32).toString("hex");
    const nowDate = this.now();
    const nowIso = nowDate.toISOString();
    const expiresAt = new Date(nowDate.getTime() + SESSION_TTL_DAYS * 86400000).toISOString();
    this.db.prepare(`
      INSERT INTO driver_sessions (id, driver_id, created_at, expires_at, user_agent)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, row.id, nowIso, expiresAt, String(userAgent || "").slice(0, 200));
    this.db.prepare("UPDATE drivers SET last_seen_at = ? WHERE id = ?").run(nowIso, row.id);
    return { sessionId, driver: mapDriverRow(row), expiresAt };
  }

  getSession(request) {
    const cookie = readCookie(request, SESSION_COOKIE);
    if (!cookie) return null;
    const row = this.db.prepare(`
      SELECT s.id AS session_id, s.expires_at, d.*
      FROM driver_sessions s
      JOIN drivers d ON d.id = s.driver_id
      WHERE s.id = ? AND s.expires_at > ? AND d.active = 1
    `).get(cookie, this.now().toISOString());
    if (!row) return null;
    return { sessionId: row.session_id, driver: mapDriverRow(row) };
  }

  destroySession(request) {
    const cookie = readCookie(request, SESSION_COOKIE);
    if (!cookie) return;
    this.db.prepare("DELETE FROM driver_sessions WHERE id = ?").run(cookie);
  }

  updateOwnStatus(driverId, status) {
    if (!DRIVER_STATUSES.has(status)) throw new DriverError("DRIVER_STATUS_INVALID", "Statut livreur invalide.");
    const nowIso = this.now().toISOString();
    this.db.prepare("UPDATE drivers SET current_status = ?, last_seen_at = ?, updated_at = ? WHERE id = ?")
      .run(status, nowIso, nowIso, driverId);
    return this.getById(driverId);
  }

  // ─── Assignation ordre / suivi livraison ────────────────────────

  // Renvoie toutes les commandes de livraison en attente d etre prises
  // (confirmed / preparing / ready et non assignees).
  listPool() {
    const rows = this.db.prepare(`
      SELECT o.id, o.order_number, o.first_name, o.last_name, o.phone,
             o.delivery_mode, o.commune_name, o.delivery_address,
             o.delivery_latitude, o.delivery_longitude, o.delivery_maps_url, o.note,
             o.subtotal_cents, o.delivery_fee_cents, o.discount_cents, o.total_cents,
             o.status, o.created_at
      FROM orders o
      WHERE o.delivery_mode = 'delivery'
        AND o.assigned_driver_id IS NULL
        AND o.status IN ('confirmed', 'ready')
      ORDER BY o.created_at ASC
    `).all();
    return rows.map((row) => this._hydrateOrderForDriver(row));
  }

  // Un livreur "prend" une course : operation atomique pour eviter que
  // deux livreurs ne la reservent en meme temps. Renvoie 409 si deja prise.
  takeOrder(driverId, orderId) {
    const driver = this.getById(driverId);
    if (!driver.active) throw new DriverError("DRIVER_INACTIVE", "Vous n'êtes plus actif dans l'équipe.", 409);
    const nowIso = this.now().toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = this.db.prepare(`
        UPDATE orders
        SET assigned_driver_id = ?, driver_assigned_at = ?, updated_at = ?
        WHERE id = ?
          AND delivery_mode = 'delivery'
          AND assigned_driver_id IS NULL
          AND status IN ('confirmed', 'ready')
      `).run(driverId, nowIso, nowIso, orderId);
      if (!result.changes) {
        throw new DriverError(
          "ORDER_ALREADY_TAKEN",
          "Désolé, un autre livreur a déjà pris cette course.",
          409,
        );
      }
      this.db.prepare("UPDATE drivers SET current_status = 'busy', last_seen_at = ?, updated_at = ? WHERE id = ?")
        .run(nowIso, nowIso, driverId);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return { orderId, takenAt: nowIso };
  }

  // Le livreur relâche une course qu il ne peut plus faire — retour au pool.
  releaseOrder(driverId, orderId) {
    const nowIso = this.now().toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = this.db.prepare(`
        UPDATE orders
        SET assigned_driver_id = NULL, driver_assigned_at = NULL, driver_started_at = NULL, updated_at = ?
        WHERE id = ? AND assigned_driver_id = ? AND status IN ('confirmed', 'ready')
      `).run(nowIso, orderId, driverId);
      if (!result.changes) {
        throw new DriverError("ORDER_NOT_RELEASABLE", "Cette course ne peut pas être relâchée.", 409);
      }
      const stillBusy = this.db.prepare(`
        SELECT COUNT(*) AS count FROM orders
        WHERE assigned_driver_id = ? AND status IN ('confirmed', 'ready')
      `).get(driverId).count;
      if (stillBusy === 0) {
        this.db.prepare("UPDATE drivers SET current_status = 'available', updated_at = ? WHERE id = ?")
          .run(nowIso, driverId);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return { orderId, releasedAt: nowIso };
  }

  // Le livreur annule la course avec un motif obligatoire (client injoignable,
  // adresse fausse, refus, etc.). La commande passe en 'cancelled' et est
  // exclue du programme de fidelite au prochain sync.
  markCancelledByDriver(driverId, orderId, reason) {
    const cleanReason = String(reason || "").trim().slice(0, 200);
    if (!cleanReason) throw new DriverError("CANCEL_REASON_REQUIRED", "Un motif d'annulation est requis.");
    const nowIso = this.now().toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      // Recupere la note existante pour l enrichir sans l ecraser.
      const existing = this.db.prepare("SELECT note FROM orders WHERE id = ?").get(orderId);
      const enrichedNote = `${existing?.note || ""}${existing?.note ? "\n" : ""}[Livreur] Annulée : ${cleanReason}`.slice(0, 1000);
      const result = this.db.prepare(`
        UPDATE orders
        SET status = 'cancelled', note = ?, updated_at = ?
        WHERE id = ? AND assigned_driver_id = ? AND status IN ('confirmed', 'ready')
      `).run(enrichedNote, nowIso, orderId, driverId);
      if (!result.changes) {
        throw new DriverError("ORDER_NOT_CANCELLABLE", "Cette course ne peut plus être annulée.", 409);
      }
      this.db.prepare(`
        INSERT INTO order_status_history (order_id, status, note, changed_at)
        VALUES (?, 'cancelled', ?, ?)
      `).run(orderId, `Livreur : ${cleanReason}`, nowIso);
      const stillBusy = this.db.prepare(`
        SELECT COUNT(*) AS count FROM orders
        WHERE assigned_driver_id = ? AND status IN ('confirmed', 'ready')
      `).get(driverId).count;
      if (stillBusy === 0) {
        this.db.prepare("UPDATE drivers SET current_status = 'available', updated_at = ? WHERE id = ?")
          .run(nowIso, driverId);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return { orderId, cancelledAt: nowIso, reason: cleanReason };
  }

  assignOrder(orderId, driverId) {
    const driver = this.getById(driverId);
    if (!driver.active) throw new DriverError("DRIVER_INACTIVE", "Ce livreur n est plus actif.", 409);
    const nowIso = this.now().toISOString();
    // Passe le livreur en busy et associe la commande.
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = this.db.prepare(`
        UPDATE orders
        SET assigned_driver_id = ?, driver_assigned_at = ?, updated_at = ?
        WHERE id = ? AND delivery_mode = 'delivery' AND status IN ('confirmed', 'ready')
      `).run(driverId, nowIso, nowIso, orderId);
      if (!result.changes) {
        throw new DriverError(
          "ORDER_NOT_ASSIGNABLE",
          "Cette commande ne peut pas être assignée (livraison non prête ou déjà livrée).",
          409,
        );
      }
      this.db.prepare("UPDATE drivers SET current_status = 'busy', updated_at = ? WHERE id = ?")
        .run(nowIso, driverId);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return { driverId, orderId, assignedAt: nowIso };
  }

  unassignOrder(orderId) {
    const nowIso = this.now().toISOString();
    const row = this.db.prepare(`
      SELECT assigned_driver_id FROM orders WHERE id = ?
    `).get(orderId);
    if (!row?.assigned_driver_id) return { changed: false };
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare(`
        UPDATE orders
        SET assigned_driver_id = NULL, driver_assigned_at = NULL, driver_started_at = NULL, updated_at = ?
        WHERE id = ?
      `).run(nowIso, orderId);
      // Repasse le livreur en available s il n a plus d autres courses.
      const stillBusy = this.db.prepare(`
        SELECT COUNT(*) AS count FROM orders
        WHERE assigned_driver_id = ? AND status IN ('confirmed', 'ready')
      `).get(row.assigned_driver_id).count;
      if (stillBusy === 0) {
        this.db.prepare("UPDATE drivers SET current_status = 'available', updated_at = ? WHERE id = ?")
          .run(nowIso, row.assigned_driver_id);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return { changed: true };
  }

  // Marque la commande "en route" par le livreur (post pickup au restaurant).
  markInTransit(driverId, orderId) {
    const nowIso = this.now().toISOString();
    const result = this.db.prepare(`
      UPDATE orders
      SET driver_started_at = ?, updated_at = ?
      WHERE id = ? AND assigned_driver_id = ? AND status = 'ready'
    `).run(nowIso, nowIso, orderId, driverId);
    if (!result.changes) {
      throw new DriverError(
        "ORDER_NOT_IN_TRANSIT",
        "Cette course ne peut pas passer en route (statut invalide).",
        409,
      );
    }
    return { orderId, startedAt: nowIso };
  }

  // Marque la commande livrée + repasse le livreur en available.
  markDelivered(driverId, orderId) {
    const nowIso = this.now().toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = this.db.prepare(`
        UPDATE orders
        SET status = 'delivered', delivered_at = ?, updated_at = ?
        WHERE id = ? AND assigned_driver_id = ? AND status = 'ready'
      `).run(nowIso, nowIso, orderId, driverId);
      if (!result.changes) {
        throw new DriverError(
          "ORDER_NOT_DELIVERABLE",
          "Cette course ne peut pas être marquée livrée.",
          409,
        );
      }
      this.db.prepare(`
        INSERT INTO order_status_history (order_id, status, note, changed_at)
        VALUES (?, 'delivered', 'Livrée par livreur', ?)
      `).run(orderId, nowIso);
      const stillBusy = this.db.prepare(`
        SELECT COUNT(*) AS count FROM orders
        WHERE assigned_driver_id = ? AND status IN ('confirmed', 'ready')
      `).get(driverId).count;
      if (stillBusy === 0) {
        this.db.prepare("UPDATE drivers SET current_status = 'available', updated_at = ? WHERE id = ?")
          .run(nowIso, driverId);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return { orderId, deliveredAt: nowIso };
  }

  // ─── Consultation courses ───────────────────────────────────────

  // Courses actives du livreur (assignées mais pas encore livrées / annulées).
  listActiveOrders(driverId) {
    const rows = this.db.prepare(`
      SELECT o.id, o.order_number, o.first_name, o.last_name, o.phone,
             o.delivery_mode, o.commune_name, o.delivery_address,
             o.delivery_latitude, o.delivery_longitude, o.delivery_maps_url, o.note,
             o.subtotal_cents, o.delivery_fee_cents, o.discount_cents, o.total_cents,
             o.status, o.driver_assigned_at, o.driver_started_at, o.created_at
      FROM orders o
      WHERE o.assigned_driver_id = ?
        AND o.status IN ('confirmed', 'ready')
      ORDER BY o.created_at ASC
    `).all(driverId);
    return rows.map((row) => this._hydrateOrderForDriver(row));
  }

  // Historique du livreur (par défaut : 30 derniers jours).
  listHistory(driverId, { sinceIso } = {}) {
    const since = sinceIso || new Date(this.now().getTime() - 30 * 86400000).toISOString();
    const rows = this.db.prepare(`
      SELECT o.id, o.order_number, o.first_name, o.last_name,
             o.commune_name, o.delivery_address,
             o.delivery_latitude, o.delivery_longitude, o.delivery_maps_url,
             o.subtotal_cents, o.delivery_fee_cents, o.total_cents,
             o.status, o.delivered_at, o.driver_assigned_at, o.created_at
      FROM orders o
      WHERE o.assigned_driver_id = ?
        AND o.delivered_at IS NOT NULL
        AND o.delivered_at >= ?
      ORDER BY o.delivered_at DESC
      LIMIT 100
    `).all(driverId, since);
    return rows.map(mapHistoryRow);
  }

  // Stats simples : compteurs par periode (aujourd hui / semaine / mois / total)
  // ainsi que les annulations. Volontairement pas de CA (paye geree hors app).
  getStats(driverId) {
    const nowDate = this.now();
    // Debut du jour local courant
    const dayStart = new Date(nowDate);
    dayStart.setHours(0, 0, 0, 0);
    // Debut de la semaine ISO (lundi)
    const weekStart = new Date(dayStart);
    const dayOfWeek = weekStart.getDay(); // 0=Sunday, 1=Monday
    const diff = (dayOfWeek + 6) % 7; // ramene au lundi
    weekStart.setDate(weekStart.getDate() - diff);
    // Debut du mois
    const monthStart = new Date(dayStart);
    monthStart.setDate(1);

    function count(db, driverId, since, status = "delivered") {
      return db.prepare(`
        SELECT COUNT(*) AS n FROM orders
        WHERE assigned_driver_id = ? AND status = ?
          AND ${status === "cancelled" ? "updated_at" : "delivered_at"} >= ?
      `).get(driverId, status, since.toISOString()).n;
    }
    return {
      today: {
        delivered: count(this.db, driverId, dayStart, "delivered"),
        cancelled: count(this.db, driverId, dayStart, "cancelled"),
      },
      week: {
        delivered: count(this.db, driverId, weekStart, "delivered"),
        cancelled: count(this.db, driverId, weekStart, "cancelled"),
      },
      month: {
        delivered: count(this.db, driverId, monthStart, "delivered"),
        cancelled: count(this.db, driverId, monthStart, "cancelled"),
      },
      lifetime: {
        delivered: this.db.prepare(`
          SELECT COUNT(*) AS n FROM orders WHERE assigned_driver_id = ? AND status = 'delivered'
        `).get(driverId).n,
        cancelled: this.db.prepare(`
          SELECT COUNT(*) AS n FROM orders WHERE assigned_driver_id = ? AND status = 'cancelled'
        `).get(driverId).n,
      },
    };
  }

  _hydrateOrderForDriver(row) {
    const items = this.db.prepare(`
      SELECT product_id, title, unit_price_cents, quantity, line_total_cents
      FROM order_items WHERE order_id = ? ORDER BY rowid
    `).all(row.id).map((item) => ({
      productId: item.product_id,
      title: item.title,
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
      lineTotalCents: item.line_total_cents,
    }));
    return {
      id: row.id,
      orderNumber: row.order_number,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      deliveryMode: row.delivery_mode,
      communeName: row.commune_name,
      deliveryAddress: row.delivery_address,
      // Coordonnees precises choisies par le client au checkout (null si absent).
      // Doit matcher le nommage de orderSystem.mapOrder() pour que le meme
      // helper (frontend-react/src/lib/maps.js) fonctionne cote livreur.
      deliveryLatitude: typeof row.delivery_latitude === "number" ? row.delivery_latitude : null,
      deliveryLongitude: typeof row.delivery_longitude === "number" ? row.delivery_longitude : null,
      deliveryMapsUrl: row.delivery_maps_url || null,
      note: row.note,
      subtotalCents: row.subtotal_cents,
      deliveryFeeCents: row.delivery_fee_cents,
      discountCents: row.discount_cents,
      totalCents: row.total_cents,
      status: row.status,
      driverAssignedAt: row.driver_assigned_at,
      driverStartedAt: row.driver_started_at,
      createdAt: row.created_at,
      items,
    };
  }

  // ─── Push subscriptions (utile pour Phase 2) ────────────────────

  savePushSubscription(driverId, { endpoint, keys }) {
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      throw new DriverError("PUSH_SUBSCRIPTION_INVALID", "Subscription invalide.");
    }
    const id = randomBytes(12).toString("hex");
    const nowIso = this.now().toISOString();
    this.db.prepare(`
      INSERT INTO driver_push_subscriptions (id, driver_id, endpoint, p256dh, auth, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (endpoint) DO UPDATE SET driver_id = excluded.driver_id, p256dh = excluded.p256dh, auth = excluded.auth
    `).run(id, driverId, endpoint, keys.p256dh, keys.auth, nowIso);
    return true;
  }

  listPushSubscriptions(driverId) {
    return this.db.prepare(`
      SELECT id, endpoint, p256dh, auth
      FROM driver_push_subscriptions WHERE driver_id = ?
    `).all(driverId);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

export function buildDriverSessionCookie(sessionId, request, maxAgeSeconds = SESSION_TTL_DAYS * 86400) {
  const secure = isSecureRequest(request);
  const attrs = [
    `${SESSION_COOKIE}=${sessionId}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) attrs.push("Secure");
  if (maxAgeSeconds <= 0) attrs.push("Max-Age=0");
  else attrs.push(`Max-Age=${maxAgeSeconds}`);
  return attrs.join("; ");
}

function readCookie(request, name) {
  const raw = request?.headers?.cookie || "";
  const parts = raw.split(";");
  for (const part of parts) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function isSecureRequest(request) {
  if (!request) return false;
  if (request.socket?.encrypted) return true;
  const proto = request.headers?.["x-forwarded-proto"];
  return proto && String(proto).split(",")[0].trim() === "https";
}

function normalizeProfile({ firstName, lastName, phone, notes }) {
  const cleanFirst = String(firstName || "").trim().slice(0, 60);
  if (!cleanFirst) throw new DriverError("DRIVER_FIRSTNAME_REQUIRED", "Le prénom est requis.");
  const cleanLast = String(lastName || "").trim().slice(0, 60);
  const cleanPhone = normalizePhone(phone);
  const cleanNotes = String(notes || "").trim().slice(0, 500);
  return { firstName: cleanFirst, lastName: cleanLast, phone: cleanPhone, notes: cleanNotes };
}

function normalizePhone(phone) {
  const clean = String(phone || "").trim().replace(/[\s.\-()]/g, "");
  if (!/^\+?\d{8,15}$/.test(clean)) {
    throw new DriverError("DRIVER_PHONE_INVALID", "Numéro de téléphone invalide.");
  }
  return clean;
}

function normalizePin(pin) {
  const clean = String(pin || "").trim();
  if (!/^\d{4,8}$/.test(clean)) {
    throw new DriverError("DRIVER_PIN_INVALID", "Le code doit contenir de 4 à 8 chiffres.");
  }
  return clean;
}

function hashPin(pin, salt) {
  return scryptSync(pin, salt, 64).toString("hex");
}

function verifyPin(pin, hash, salt) {
  const expected = Buffer.from(hash, "hex");
  const actual = Buffer.from(hashPin(pin, salt), "hex");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

function mapDriverRow(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    active: Boolean(row.active),
    currentStatus: row.current_status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
  };
}

function mapHistoryRow(row) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    firstName: row.first_name,
    lastName: row.last_name,
    communeName: row.commune_name,
    deliveryAddress: row.delivery_address,
    deliveryLatitude: typeof row.delivery_latitude === "number" ? row.delivery_latitude : null,
    deliveryLongitude: typeof row.delivery_longitude === "number" ? row.delivery_longitude : null,
    deliveryMapsUrl: row.delivery_maps_url || null,
    subtotalCents: row.subtotal_cents,
    deliveryFeeCents: row.delivery_fee_cents,
    totalCents: row.total_cents,
    status: row.status,
    deliveredAt: row.delivered_at,
    driverAssignedAt: row.driver_assigned_at,
    createdAt: row.created_at,
  };
}
