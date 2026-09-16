import { randomUUID } from "node:crypto";

const QUALIFYING_STATUSES = ["delivered", "withdrawn", "completed"];
const REWARD_TYPES = new Set(["percentage", "fixed"]);
const DEFAULT_SETTINGS = {
  id: "default",
  threshold: 10,
  rewardType: "percentage",
  rewardValue: 10,
  title: "Récompense Pasta Lover",
  description: "Une remise sur votre prochaine commande.",
  active: true,
};

export class LoyaltyError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = "LoyaltyError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class LoyaltySystem {
  constructor({ db, now = () => new Date() } = {}) {
    if (!db) throw new Error("LoyaltySystem requires a SQLite database.");
    this.db = db;
    this.now = now;
    this.initializeSchema();
    this.seedSettings();
  }

  initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS loyalty_settings (
        id TEXT PRIMARY KEY CHECK (id = 'default'),
        qualifying_order_threshold INTEGER NOT NULL CHECK (qualifying_order_threshold BETWEEN 1 AND 100),
        reward_type TEXT NOT NULL CHECK (reward_type IN ('percentage', 'fixed')),
        reward_value INTEGER NOT NULL CHECK (reward_value > 0),
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS loyalty_rewards (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        qualifying_order_count INTEGER NOT NULL CHECK (qualifying_order_count > 0),
        reward_type TEXT NOT NULL CHECK (reward_type IN ('percentage', 'fixed')),
        reward_value INTEGER NOT NULL CHECK (reward_value > 0),
        title TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('available', 'applied', 'expired')),
        applied_order_id TEXT,
        created_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_rewards_milestone
        ON loyalty_rewards (customer_id, qualifying_order_count);
      CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_customer_status
        ON loyalty_rewards (customer_id, status, created_at);
    `);
  }

  seedSettings() {
    const timestamp = this.now().toISOString();
    this.db.prepare(`
      INSERT OR IGNORE INTO loyalty_settings
        (id, qualifying_order_threshold, reward_type, reward_value, title, description, active, created_at, updated_at)
      VALUES ('default', ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      DEFAULT_SETTINGS.threshold,
      DEFAULT_SETTINGS.rewardType,
      DEFAULT_SETTINGS.rewardValue,
      DEFAULT_SETTINGS.title,
      DEFAULT_SETTINGS.description,
      timestamp,
      timestamp,
    );
  }

  getSettings() {
    const row = this.db.prepare("SELECT * FROM loyalty_settings WHERE id = 'default'").get();
    return mapSettingsRow(row);
  }

  updateSettings(input = {}) {
    const current = this.getSettings();
    const settings = normalizeSettings({ ...current, ...input });
    const timestamp = this.now().toISOString();
    this.db.prepare(`
      UPDATE loyalty_settings
      SET qualifying_order_threshold = ?, reward_type = ?, reward_value = ?,
          title = ?, description = ?, active = ?, updated_at = ?
      WHERE id = 'default'
    `).run(
      settings.threshold,
      settings.rewardType,
      settings.rewardValue,
      settings.title,
      settings.description,
      settings.active ? 1 : 0,
      timestamp,
    );
    return this.getSettings();
  }

  syncCustomerRewards(customerId) {
    const progress = this.getCustomerProgress(customerId, { sync: false });
    if (!progress.settings.active) return progress;

    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO loyalty_rewards
        (id, customer_id, qualifying_order_count, reward_type, reward_value, title, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'available', ?)
    `);
    const timestamp = this.now().toISOString();
    for (let milestone = progress.settings.threshold; milestone <= progress.qualifyingOrders; milestone += progress.settings.threshold) {
      insert.run(
        randomUUID(),
        customerId,
        milestone,
        progress.settings.rewardType,
        progress.settings.rewardValue,
        progress.settings.title,
        timestamp,
      );
    }
    return this.getCustomerProgress(customerId, { sync: false });
  }

  getCustomerProgress(customerId, { sync = true } = {}) {
    if (!customerId) throw new LoyaltyError("LOYALTY_CUSTOMER_REQUIRED", "A customer account is required.", 401);
    const settings = this.getSettings();
    const qualifyingOrders = this.db.prepare(`
      SELECT COUNT(*) AS count
      FROM orders
      WHERE customer_id = ? AND status IN (${QUALIFYING_STATUSES.map(() => "?").join(", ")})
    `).get(customerId, ...QUALIFYING_STATUSES).count;

    if (sync && settings.active) return this.syncCustomerRewards(customerId);

    const availableReward = this.db.prepare(`
      SELECT id, qualifying_order_count, reward_type, reward_value, title, status, created_at
      FROM loyalty_rewards
      WHERE customer_id = ? AND status = 'available'
      ORDER BY qualifying_order_count ASC LIMIT 1
    `).get(customerId);
    const progressInCycle = qualifyingOrders % settings.threshold;
    const ordersToNextReward = progressInCycle === 0 ? settings.threshold : settings.threshold - progressInCycle;
    return {
      settings,
      qualifyingOrders,
      progressInCycle,
      ordersToNextReward,
      rewardAvailable: availableReward ? mapRewardRow(availableReward) : null,
    };
  }

  previewReward(customerId, rewardId, subtotalCents) {
    if (!customerId || !rewardId) return null;
    const subtotal = Number(subtotalCents);
    if (!Number.isInteger(subtotal) || subtotal < 0) {
      throw new LoyaltyError("LOYALTY_SUBTOTAL_INVALID", "The order subtotal is invalid.", 422);
    }
    const row = this.db.prepare(`
      SELECT id, customer_id, reward_type, reward_value, title
      FROM loyalty_rewards
      WHERE id = ? AND customer_id = ? AND status = 'available'
    `).get(rewardId, customerId);
    if (!row) return null;
    const discountCents = row.reward_type === "fixed"
      ? Math.min(subtotal, row.reward_value * 100)
      : Math.min(subtotal, Math.floor(subtotal * row.reward_value / 100));
    return { id: row.id, title: row.title, discountCents };
  }

  applyReward(customerId, rewardId, subtotalCents, orderId) {
    const reward = this.previewReward(customerId, rewardId, subtotalCents);
    if (!reward) {
      throw new LoyaltyError("LOYALTY_REWARD_UNAVAILABLE", "This loyalty reward is no longer available.", 409);
    }
    const result = this.db.prepare(`
      UPDATE loyalty_rewards
      SET status = 'applied', applied_order_id = ?
      WHERE id = ? AND customer_id = ? AND status = 'available'
    `).run(orderId, rewardId, customerId);
    if (!result.changes) {
      throw new LoyaltyError("LOYALTY_REWARD_UNAVAILABLE", "This loyalty reward is no longer available.", 409);
    }
    return reward;
  }

  listCustomerProgress({ search = "" } = {}) {
    const normalizedSearch = String(search || "").trim().slice(0, 100);
    const params = [];
    let where = "";
    if (normalizedSearch) {
      where = "WHERE lower(first_name || ' ' || last_name) LIKE ? OR lower(email) LIKE ? OR phone LIKE ?";
      const term = `%${normalizedSearch.toLowerCase()}%`;
      params.push(term, term, `%${normalizedSearch}%`);
    }
    const accounts = this.db.prepare(`
      SELECT id, email, first_name, last_name, phone
      FROM customer_accounts ${where}
      ORDER BY last_name, first_name, email
      LIMIT 500
    `).all(...params);
    return accounts.map((account) => ({
      id: account.id,
      email: account.email,
      firstName: account.first_name,
      lastName: account.last_name,
      phone: account.phone,
      ...this.getCustomerProgress(account.id),
    }));
  }
}

function normalizeSettings(input) {
  const threshold = Number(input.threshold);
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 100) {
    throw new LoyaltyError("LOYALTY_THRESHOLD_INVALID", "The loyalty threshold must be between 1 and 100 orders.");
  }
  const rewardType = String(input.rewardType || "").trim();
  if (!REWARD_TYPES.has(rewardType)) {
    throw new LoyaltyError("LOYALTY_REWARD_TYPE_INVALID", "The reward type is invalid.");
  }
  const rewardValue = Number(input.rewardValue);
  if (!Number.isInteger(rewardValue) || rewardValue <= 0 || (rewardType === "percentage" && rewardValue > 100)) {
    throw new LoyaltyError("LOYALTY_REWARD_VALUE_INVALID", "The reward value is invalid.");
  }
  const title = normalizeText(input.title, "LOYALTY_TITLE_INVALID", 120);
  const description = normalizeText(input.description, "LOYALTY_DESCRIPTION_INVALID", 300, true);
  return {
    threshold,
    rewardType,
    rewardValue,
    title,
    description,
    active: input.active !== false && Number(input.active) !== 0,
  };
}

function normalizeText(value, code, maxLength, allowEmpty = false) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if ((!allowEmpty && !normalized) || normalized.length > maxLength) {
    throw new LoyaltyError(code, "The loyalty text is invalid.");
  }
  return normalized;
}

function mapSettingsRow(row) {
  return {
    threshold: row.qualifying_order_threshold,
    rewardType: row.reward_type,
    rewardValue: row.reward_value,
    title: row.title,
    description: row.description,
    active: Boolean(row.active),
    updatedAt: row.updated_at,
  };
}

function mapRewardRow(row) {
  return {
    id: row.id,
    qualifyingOrderCount: row.qualifying_order_count,
    rewardType: row.reward_type,
    rewardValue: row.reward_value,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
  };
}
