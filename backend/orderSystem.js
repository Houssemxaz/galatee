import { randomUUID } from "node:crypto";

// Cycle de vie simplifie : 4 statuts + cancelled.
// - pending    : en attente de confirmation par le restaurant
// - confirmed  : accepte par le resto (visible dans le pool livreur si delivery)
// - ready      : prete a etre recuperee (par le livreur ou le client en pickup)
// - delivered  : livree (par livreur) ou retiree (par client)
// - cancelled  : annulee (par resto, par client, ou par livreur avec motif)
const ORDER_STATUSES = new Set([
  "pending",
  "confirmed",
  "ready",
  "delivered",
  "cancelled",
]);
const DELIVERY_MODES = new Set(["delivery", "pickup"]);
const PAYMENT_METHOD = "cash_on_delivery";
const MAX_ITEMS = 50;
const MAX_QUANTITY = 99;

const DEFAULT_COMMUNES = [
  ["hydra", "Hydra", 50_000],
  ["el-biar", "El Biar", 60_000],
  ["ben-aknoun", "Ben Aknoun", 60_000],
  ["bir-mourad-rais", "Bir Mourad Raïs", 70_000],
  ["delly-brahim", "Dely Ibrahim", 80_000],
  ["cheraga", "Chéraga", 90_000],
];

export class OrderError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = "OrderError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class OrderSystem {
  constructor({ db, menu, loyalty = null, promotions = null, now = () => new Date() } = {}) {
    if (!db) throw new Error("OrderSystem requires a SQLite database.");
    if (!menu) throw new Error("OrderSystem requires a MenuSystem.");
    this.db = db;
    this.menu = menu;
    this.loyalty = loyalty;
    this.promotions = promotions;
    this.now = now;
    this.initializeSchema();
    this.seedCommunes();
  }

  initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS delivery_communes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        fee_cents INTEGER NOT NULL CHECK (fee_cents >= 0),
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_number TEXT NOT NULL UNIQUE,
        customer_id TEXT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL DEFAULT '',
        delivery_mode TEXT NOT NULL CHECK (delivery_mode IN ('delivery', 'pickup')),
        commune_id TEXT,
        commune_name TEXT NOT NULL DEFAULT '',
        delivery_address TEXT NOT NULL DEFAULT '',
        payment_method TEXT NOT NULL CHECK (payment_method = 'cash_on_delivery'),
        status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled', 'preparing', 'ready', 'delivered', 'withdrawn', 'completed')),
        note TEXT NOT NULL DEFAULT '',
        subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
        delivery_fee_cents INTEGER NOT NULL CHECK (delivery_fee_cents >= 0),
        discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
        loyalty_reward_id TEXT,
        promotion_id TEXT,
        total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (commune_id) REFERENCES delivery_communes(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
        product_type TEXT NOT NULL DEFAULT 'dish' CHECK (product_type IN ('dish', 'menu', 'offer')),
        product_id TEXT NOT NULL,
        title TEXT NOT NULL,
        unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0)
      );

      CREATE TABLE IF NOT EXISTS order_status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        changed_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders (status, created_at);
      CREATE INDEX IF NOT EXISTS idx_orders_customer_created ON orders (customer_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at);
      CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);
      CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history (order_id, changed_at);
    `);
    const orderColumns = this.db.prepare("PRAGMA table_info(orders)").all();
    if (!orderColumns.some((column) => column.name === "discount_cents")) {
      this.db.exec("ALTER TABLE orders ADD COLUMN discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0)");
    }
    if (!orderColumns.some((column) => column.name === "loyalty_reward_id")) {
      this.db.exec("ALTER TABLE orders ADD COLUMN loyalty_reward_id TEXT");
    }
    if (!orderColumns.some((column) => column.name === "promotion_id")) {
      this.db.exec("ALTER TABLE orders ADD COLUMN promotion_id TEXT");
    }
    // Champs livreur : assignation manuelle depuis le backoffice puis suivi
    // du parcours de livraison (en route, livree).
    if (!orderColumns.some((column) => column.name === "assigned_driver_id")) {
      this.db.exec("ALTER TABLE orders ADD COLUMN assigned_driver_id TEXT");
      this.db.exec("CREATE INDEX IF NOT EXISTS idx_orders_driver ON orders (assigned_driver_id, status)");
    }
    if (!orderColumns.some((column) => column.name === "driver_assigned_at")) {
      this.db.exec("ALTER TABLE orders ADD COLUMN driver_assigned_at TEXT");
    }
    if (!orderColumns.some((column) => column.name === "driver_started_at")) {
      this.db.exec("ALTER TABLE orders ADD COLUMN driver_started_at TEXT");
    }
    if (!orderColumns.some((column) => column.name === "delivered_at")) {
      this.db.exec("ALTER TABLE orders ADD COLUMN delivered_at TEXT");
    }
    // Localisation precise choisie par le client sur une carte au checkout.
    // Nullables : le champ reste optionnel et l'adresse texte demeure obligatoire.
    if (!orderColumns.some((column) => column.name === "delivery_latitude")) {
      this.db.exec("ALTER TABLE orders ADD COLUMN delivery_latitude REAL");
    }
    if (!orderColumns.some((column) => column.name === "delivery_longitude")) {
      this.db.exec("ALTER TABLE orders ADD COLUMN delivery_longitude REAL");
    }
    // Lien Google Maps colle par le client au checkout, ouvert tel quel par le
    // livreur. Prioritaire sur les coordonnees, puis sur l adresse texte.
    if (!orderColumns.some((column) => column.name === "delivery_maps_url")) {
      this.db.exec("ALTER TABLE orders ADD COLUMN delivery_maps_url TEXT");
    }
    const orderItemColumns = this.db.prepare("PRAGMA table_info(order_items)").all();
    if (!orderItemColumns.some((column) => column.name === "position")) {
      this.db.exec("ALTER TABLE order_items ADD COLUMN position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0)");
    }
    const historyColumns = this.db.prepare("PRAGMA table_info(order_status_history)").all();
    const historyId = historyColumns.find((column) => column.name === "id");
    if (this.db.isPostgres && historyId?.is_identity !== "YES") {
      this.db.exec("ALTER TABLE order_status_history ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY");
    }
    // Migration statuts : simplification a 4 statuts + cancelled.
    // 'preparing' devient 'confirmed' (accepte mais pas encore pret).
    // 'withdrawn' et 'completed' deviennent 'delivered'.
    this.db.exec(`
      UPDATE orders SET status = 'confirmed' WHERE status = 'preparing';
      UPDATE orders SET status = 'delivered' WHERE status IN ('withdrawn', 'completed');
    `);
  }

  seedCommunes() {
    if (this.db.prepare("SELECT COUNT(*) AS count FROM delivery_communes").get().count > 0) return;
    const timestamp = this.now().toISOString();
    const insert = this.db.prepare(`
      INSERT INTO delivery_communes (id, name, fee_cents, active, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?)
    `);
    for (const [id, name, feeCents] of DEFAULT_COMMUNES) insert.run(id, name, feeCents, timestamp, timestamp);
  }

  listCommunes({ activeOnly = false } = {}) {
    const where = activeOnly ? "WHERE active = 1" : "";
    return this.db.prepare(`SELECT * FROM delivery_communes ${where} ORDER BY active DESC, name`).all().map(mapCommune);
  }

  getCommune(id) {
    const row = this.db.prepare("SELECT * FROM delivery_communes WHERE id = ?").get(id);
    return row ? mapCommune(row) : null;
  }

  createCommune(input) {
    const commune = normalizeCommune(input);
    const id = slugify(commune.name);
    const timestamp = this.now().toISOString();
    try {
      this.db.prepare(`
        INSERT INTO delivery_communes (id, name, fee_cents, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, commune.name, commune.feeCents, commune.active ? 1 : 0, timestamp, timestamp);
    } catch (error) {
      if (String(error.message).includes("UNIQUE constraint failed")) {
        throw new OrderError("COMMUNE_ALREADY_EXISTS", "This commune already exists.", 409);
      }
      throw error;
    }
    return this.getCommune(id);
  }

  updateCommune(id, input) {
    const current = this.getCommune(id);
    if (!current) throw new OrderError("COMMUNE_NOT_FOUND", "Delivery commune was not found.", 404);
    const commune = normalizeCommune({ ...current, ...input });
    const timestamp = this.now().toISOString();
    try {
      this.db.prepare(`
        UPDATE delivery_communes
        SET name = ?, fee_cents = ?, active = ?, updated_at = ?
        WHERE id = ?
      `).run(commune.name, commune.feeCents, commune.active ? 1 : 0, timestamp, id);
    } catch (error) {
      if (String(error.message).includes("UNIQUE constraint failed")) {
        throw new OrderError("COMMUNE_ALREADY_EXISTS", "This commune already exists.", 409);
      }
      throw error;
    }
    return this.getCommune(id);
  }

  createOrder(input, { customerId = null } = {}) {
    const normalized = normalizeOrderInput(input);
    if (normalized.loyaltyRewardId && !customerId) {
      throw new OrderError("LOYALTY_ACCOUNT_REQUIRED", "A customer account is required to use a loyalty reward.", 401);
    }
    const items = this.resolveItems(normalized.items);
    const commune = normalized.deliveryMode === "delivery" ? this.resolveDeliveryCommune(normalized.communeId) : null;
    const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
    const deliveryFeeCents = commune?.feeCents || 0;
    const reward = normalized.loyaltyRewardId
      ? this.loyalty?.previewReward(customerId, normalized.loyaltyRewardId, subtotalCents, items)
      : null;
    if (normalized.loyaltyRewardId && !reward) {
      throw new OrderError("LOYALTY_REWARD_UNAVAILABLE", "This loyalty reward is no longer available.", 409);
    }
    const promotion = this.promotions?.previewBest(items) || null;
    const rewardDiscountCents = reward?.discountCents || 0;
    const promotionDiscountCents = promotion?.discountCents || 0;
    const appliedPromotion = promotion && promotionDiscountCents >= rewardDiscountCents ? promotion : null;
    const appliedReward = appliedPromotion ? null : reward;
    const discountCents = appliedPromotion?.discountCents || appliedReward?.discountCents || 0;
    const timestamp = this.now().toISOString();
    const order = {
      id: randomUUID(),
      orderNumber: makeOrderNumber(this.now()),
      customerId,
      ...normalized,
      communeName: commune?.name || "",
      paymentMethod: PAYMENT_METHOD,
      status: "pending",
      subtotalCents,
      deliveryFeeCents,
      discountCents,
      loyaltyRewardId: appliedReward?.id || null,
      promotionId: appliedPromotion?.id || null,
      totalCents: Math.max(0, subtotalCents + deliveryFeeCents - discountCents),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare(`
        INSERT INTO orders (
          id, order_number, customer_id, first_name, last_name, phone, email,
          delivery_mode, commune_id, commune_name, delivery_address, delivery_latitude, delivery_longitude, delivery_maps_url, payment_method,
          status, note, subtotal_cents, delivery_fee_cents, discount_cents, loyalty_reward_id, promotion_id, total_cents, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        order.id, order.orderNumber, order.customerId, order.firstName, order.lastName,
        order.phone, order.email, order.deliveryMode, order.communeId, order.communeName,
        order.deliveryAddress, order.deliveryLatitude, order.deliveryLongitude, order.deliveryMapsUrl, order.paymentMethod, order.status, order.note,
        order.subtotalCents, order.deliveryFeeCents, order.discountCents, order.loyaltyRewardId, order.promotionId,
        order.totalCents, order.createdAt, order.updatedAt,
      );
      const insertItem = this.db.prepare(`
        INSERT INTO order_items (id, order_id, position, product_type, product_id, title, unit_price_cents, quantity, line_total_cents)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const [position, item] of items.entries()) {
        insertItem.run(randomUUID(), order.id, position, item.productType, item.productId, item.title, item.unitPriceCents, item.quantity, item.lineTotalCents);
      }
      this.db.prepare("INSERT INTO order_status_history (order_id, status, changed_at) VALUES (?, ?, ?)")
        .run(order.id, "pending", timestamp);
      if (appliedReward) this.loyalty.applyReward(customerId, appliedReward.id, subtotalCents, order.id, items);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return this.getOrder(order.id);
  }

  resolveItems(inputItems) {
    const merged = new Map();
    for (const input of inputItems) {
      const productId = normalizeId(input.productId || input.menuItemId || input.id);
      const quantity = normalizeQuantity(input.quantity);
      const productType = normalizeProductType(input.productType || "dish");
      const current = merged.get(productId) || { quantity: 0, productType };
      if (current.productType !== productType) {
        throw new OrderError("PRODUCT_TYPE_INVALID", "A product cannot use multiple types in the same order.");
      }
      current.quantity += quantity;
      merged.set(productId, current);
      if (current.quantity > MAX_QUANTITY) {
        throw new OrderError("ORDER_QUANTITY_INVALID", "An item quantity cannot exceed 99.", 400);
      }
    }
    if (!merged.size) throw new OrderError("ORDER_ITEMS_REQUIRED", "At least one item is required.", 400);

    const placeholders = [...merged.keys()].map(() => "?").join(", ");
    const rows = this.db.prepare(`
      SELECT item.id, revision.item_type, revision.title, revision.price_cents, revision.currency, item.available AS available
      FROM menu_items AS item
      JOIN menu_item_revisions AS revision ON revision.id = item.published_revision_id
      WHERE item.id IN (${placeholders}) AND item.status = 'published'
    `).all(...merged.keys());
    const byId = new Map(rows.map((row) => [row.id, row]));
    const unavailable = [];
    const resolved = [];
    for (const [productId, selection] of merged) {
      const { quantity, productType } = selection;
      const row = byId.get(productId);
      if (!row) {
        unavailable.push({ id: productId, reason: "not_found" });
        continue;
      }
      if (!row.available) {
        unavailable.push({ id: productId, title: row.title, reason: "out_of_stock" });
        continue;
      }
      if ((row.item_type || "dish") !== productType) {
        throw new OrderError("PRODUCT_TYPE_MISMATCH", "The selected product type does not match the catalogue.", 422);
      }
      resolved.push({
        productType: row.item_type || "dish",
        productId,
        title: row.title,
        unitPriceCents: row.price_cents,
        quantity,
        lineTotalCents: row.price_cents * quantity,
      });
    }
    if (unavailable.length) {
      throw new OrderError("PRODUCT_UNAVAILABLE", "One or more selected items are unavailable.", 409, { products: unavailable });
    }
    return resolved;
  }

  resolveDeliveryCommune(id) {
    const commune = this.getCommune(id);
    if (!commune || !commune.active) {
      throw new OrderError("COMMUNE_UNAVAILABLE", "This delivery commune is not available.", 422);
    }
    return commune;
  }

  listOrders({ status = null, customerId = null, from = null, to = null } = {}) {
    const clauses = [];
    const params = [];
    if (status) {
      validateOrderStatus(status);
      clauses.push("order_row.status = ?");
      params.push(status);
    }
    if (customerId) { clauses.push("order_row.customer_id = ?"); params.push(customerId); }
    if (from) { validateDateFilter(from); clauses.push("substr(order_row.created_at, 1, 10) >= ?"); params.push(from); }
    if (to) { validateDateFilter(to); clauses.push("substr(order_row.created_at, 1, 10) <= ?"); params.push(to); }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db.prepare(`SELECT order_row.* FROM orders AS order_row ${where} ORDER BY order_row.created_at DESC`).all(...params);
    return rows.map((row) => this.mapOrder(row));
  }

  getOrder(id) {
    const row = this.db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
    return row ? this.mapOrder(row) : null;
  }

  updateStatus(id, nextStatus, note = "", { allowCorrection = false } = {}) {
    const order = this.getOrder(id);
    if (!order) throw new OrderError("ORDER_NOT_FOUND", "Order was not found.", 404);
    validateOrderStatus(nextStatus);
    if (nextStatus === order.status) return order;
    const allowed = nextStatuses(order);
    if (!allowCorrection && !allowed.includes(nextStatus)) {
      throw new OrderError("ORDER_STATUS_TRANSITION_INVALID", `Cannot move an order from ${order.status} to ${nextStatus}.`, 409, { allowedStatuses: allowed });
    }
    const cleanNote = normalizeOptionalText(note, 500) || (allowCorrection
      ? `Correction manuelle : ${order.status} → ${nextStatus}`
      : "");
    const timestamp = this.now().toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare(`
        UPDATE orders
        SET status = ?,
            note = CASE WHEN ? <> '' THEN ? ELSE note END,
            delivered_at = CASE WHEN ? = 'delivered' THEN COALESCE(delivered_at, ?) ELSE NULL END,
            updated_at = ?
        WHERE id = ?
      `).run(nextStatus, cleanNote, cleanNote, nextStatus, timestamp, timestamp, id);
      this.db.prepare("INSERT INTO order_status_history (order_id, status, note, changed_at) VALUES (?, ?, ?, ?)")
        .run(id, nextStatus, cleanNote, timestamp);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return this.getOrder(id);
  }

  correctStatus(id, nextStatus, note = "") {
    return this.updateStatus(id, nextStatus, note, { allowCorrection: true });
  }

  mapOrder(row) {
    const items = this.db.prepare(`
      SELECT product_type, product_id, title, unit_price_cents, quantity, line_total_cents
      FROM order_items WHERE order_id = ? ORDER BY position, id
    `).all(row.id).map((item) => ({
      productType: item.product_type,
      productId: item.product_id,
      title: item.title,
      unitPriceCents: item.unit_price_cents,
      unitPrice: formatAmount(item.unit_price_cents),
      quantity: item.quantity,
      lineTotalCents: item.line_total_cents,
      lineTotal: formatAmount(item.line_total_cents),
    }));
    return {
      id: row.id,
      orderNumber: row.order_number,
      customerId: row.customer_id,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      email: row.email,
      deliveryMode: row.delivery_mode,
      communeId: row.commune_id,
      communeName: row.commune_name,
      deliveryAddress: row.delivery_address,
      deliveryLatitude: typeof row.delivery_latitude === "number" ? row.delivery_latitude : null,
      deliveryLongitude: typeof row.delivery_longitude === "number" ? row.delivery_longitude : null,
      deliveryMapsUrl: row.delivery_maps_url || null,
      paymentMethod: row.payment_method,
      status: row.status,
      note: row.note,
      items,
      subtotalCents: row.subtotal_cents,
      subtotal: formatAmount(row.subtotal_cents),
      deliveryFeeCents: row.delivery_fee_cents,
      deliveryFee: formatAmount(row.delivery_fee_cents),
      discountCents: row.discount_cents || 0,
      discount: formatAmount(row.discount_cents || 0),
      loyaltyRewardId: row.loyalty_reward_id || null,
      promotionId: row.promotion_id || null,
      totalCents: row.total_cents,
      total: formatAmount(row.total_cents),
      assignedDriverId: row.assigned_driver_id || null,
      driverAssignedAt: row.driver_assigned_at || null,
      driverStartedAt: row.driver_started_at || null,
      deliveredAt: row.delivered_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

function normalizeOrderInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new OrderError("ORDER_INPUT_INVALID", "Order payload must be an object.");
  const firstName = normalizeRequiredText(input.firstName, "ORDER_FIRST_NAME_REQUIRED", "First name is required.", 80);
  const lastName = normalizeRequiredText(input.lastName, "ORDER_LAST_NAME_REQUIRED", "Last name is required.", 80);
  const phone = normalizeRequiredText(input.phone, "ORDER_PHONE_REQUIRED", "Phone number is required.", 30);
  if (!/^[+()\d\s.-]{7,30}$/.test(phone)) throw new OrderError("ORDER_PHONE_INVALID", "Phone number is invalid.");
  const email = normalizeOptionalText(input.email, 160).toLowerCase();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new OrderError("ORDER_EMAIL_INVALID", "Email address is invalid.");
  const deliveryMode = String(input.deliveryMode || "").trim();
  if (!DELIVERY_MODES.has(deliveryMode)) throw new OrderError("DELIVERY_MODE_INVALID", "Delivery mode must be delivery or pickup.");
  const communeId = normalizeOptionalText(input.communeId, 80);
  const deliveryAddress = normalizeOptionalText(input.deliveryAddress || input.address, 300);
  if (deliveryMode === "delivery" && !communeId) throw new OrderError("COMMUNE_REQUIRED", "A delivery commune is required.");
  if (deliveryMode === "delivery" && !deliveryAddress) throw new OrderError("DELIVERY_ADDRESS_REQUIRED", "A delivery address is required.");
  const items = Array.isArray(input.items) ? input.items : [];
  if (items.length > MAX_ITEMS) throw new OrderError("ORDER_ITEMS_TOO_MANY", "An order cannot contain more than 50 lines.");
  const note = normalizeOptionalText(input.note, 500);
  const loyaltyRewardId = normalizeOptionalText(input.loyaltyRewardId, 120);
  const { deliveryLatitude, deliveryLongitude } = normalizeDeliveryCoordinates(input, deliveryMode);
  const deliveryMapsUrl = normalizeDeliveryMapsUrl(input.deliveryMapsUrl, deliveryMode);
  return {
    firstName, lastName, phone, email, deliveryMode,
    communeId: deliveryMode === "delivery" ? communeId : null,
    deliveryAddress: deliveryMode === "delivery" ? deliveryAddress : "",
    deliveryLatitude, deliveryLongitude, deliveryMapsUrl,
    items, note, loyaltyRewardId,
  };
}

// Le livreur ouvre ce lien tel quel : on n accepte que des liens Google Maps
// en https, jamais une URL arbitraire. Meme regle que isAllowedMapsUrl dans
// frontend-react/src/lib/googleMapsLink.js.
const MAPS_URL_MAX_LENGTH = 500;

export function isAllowedMapsUrl(value) {
  let url;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  if (host === "maps.app.goo.gl") return true;
  if (host === "goo.gl") return url.pathname.startsWith("/maps");
  if (/^maps\.google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host)) return true;
  if (/^(www\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host)) return url.pathname.startsWith("/maps");
  return false;
}

function normalizeDeliveryMapsUrl(value, deliveryMode) {
  if (deliveryMode !== "delivery") return null;
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.length > MAPS_URL_MAX_LENGTH || !isAllowedMapsUrl(text)) {
    throw new OrderError("DELIVERY_MAPS_URL_INVALID", "The delivery link must be a Google Maps link.");
  }
  return text;
}

// Bounding box large autour du grand Alger. Rejette silencieusement toute coordonnee
// hors zone ou non finie plutot que de bloquer la commande : le champ reste optionnel
// et l adresse texte demeure la source de verite obligatoire.
const ALGIERS_LAT_MIN = 36.4;
const ALGIERS_LAT_MAX = 37.0;
const ALGIERS_LNG_MIN = 2.5;
const ALGIERS_LNG_MAX = 3.6;

function normalizeDeliveryCoordinates(input, deliveryMode) {
  if (deliveryMode !== "delivery") return { deliveryLatitude: null, deliveryLongitude: null };
  const lat = input.deliveryLatitude;
  const lng = input.deliveryLongitude;
  if (lat === undefined || lat === null || lat === "" || lng === undefined || lng === null || lng === "") {
    return { deliveryLatitude: null, deliveryLongitude: null };
  }
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    throw new OrderError("DELIVERY_COORDINATES_INVALID", "Delivery coordinates must be finite numbers.");
  }
  if (latNum < ALGIERS_LAT_MIN || latNum > ALGIERS_LAT_MAX || lngNum < ALGIERS_LNG_MIN || lngNum > ALGIERS_LNG_MAX) {
    throw new OrderError("DELIVERY_COORDINATES_OUT_OF_RANGE", "Delivery coordinates are outside the Algiers area.");
  }
  return { deliveryLatitude: latNum, deliveryLongitude: lngNum };
}

function normalizeCommune(input) {
  const name = normalizeRequiredText(input.name, "COMMUNE_NAME_REQUIRED", "Commune name is required.", 100);
  // The admin UI sends `fee` in dinars, sometimes as an input string. Normalize
  // both numeric and string values through the same dinar representation.
  const feeCents = input.fee !== undefined ? normalizeAmount(String(input.fee)) : normalizeAmount(input.feeCents ?? 0);
  return { name, feeCents, active: input.active !== false && Number(input.active) !== 0 };
}

function normalizeRequiredText(value, code, message, maxLength) {
  const text = normalizeOptionalText(value, maxLength);
  if (!text) throw new OrderError(code, message);
  return text;
}

function normalizeOptionalText(value, maxLength) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (text.length > maxLength) throw new OrderError("ORDER_FIELD_TOO_LONG", `A field cannot exceed ${maxLength} characters.`);
  return text;
}

function normalizeAmount(value) {
  if (Number.isInteger(value) && value >= 0) return value;
  const text = String(value ?? "").trim().replace(",", ".");
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(text)) throw new OrderError("AMOUNT_INVALID", "Amount must be a valid non-negative number.");
  const [whole, decimal = ""] = text.split(".");
  return Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
}

function normalizeQuantity(value) {
  const quantity = Number(value ?? 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) throw new OrderError("ORDER_QUANTITY_INVALID", "Item quantity must be an integer between 1 and 99.");
  return quantity;
}

function normalizeId(value) {
  const id = normalizeOptionalText(value, 120);
  if (!id || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id)) throw new OrderError("PRODUCT_ID_INVALID", "A selected item is invalid.");
  return id;
}

function normalizeProductType(value) {
  const type = String(value).trim();
  if (!new Set(["dish", "menu", "offer"]).has(type)) throw new OrderError("PRODUCT_TYPE_INVALID", "Product type is invalid.");
  return type;
}

function validateOrderStatus(value) {
  if (!ORDER_STATUSES.has(String(value))) throw new OrderError("ORDER_STATUS_INVALID", "Order status is invalid.");
  return String(value);
}

function validateDateFilter(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw new OrderError("DATE_FILTER_INVALID", "Date filters must use YYYY-MM-DD.");
}

function nextStatuses(order) {
  if (order.status === "pending") return ["confirmed", "cancelled"];
  if (order.status === "confirmed") return ["ready", "cancelled"];
  if (order.status === "ready") return ["delivered", "cancelled"];
  return [];
}

function mapCommune(row) {
  return { id: row.id, name: row.name, feeCents: row.fee_cents, fee: formatAmount(row.fee_cents), active: Boolean(row.active), createdAt: row.created_at, updatedAt: row.updated_at };
}

function formatAmount(cents) {
  return (Number(cents) / 100).toFixed(2);
}

function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || randomUUID();
}

function makeOrderNumber(date) {
  const day = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `GAL-${day}-${randomUUID().slice(0, 6).toUpperCase()}`;
}
