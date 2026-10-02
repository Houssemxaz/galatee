import { randomUUID } from "node:crypto";

const REWARD_TYPES = new Set(["percentage", "fixed"]);
const PROMOTION_SCOPES = new Set(["items", "pack"]);

export class PromotionError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = "PromotionError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class PromotionSystem {
  constructor({ db, now = () => new Date() } = {}) {
    if (!db) throw new Error("PromotionSystem requires a SQLite database.");
    this.db = db;
    this.now = now;
    this.initializeSchema();
  }

  initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS promotions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        reward_type TEXT NOT NULL CHECK (reward_type IN ('percentage', 'fixed')),
        reward_value INTEGER NOT NULL CHECK (reward_value > 0),
        scope TEXT NOT NULL CHECK (scope IN ('items', 'pack')),
        target_ids TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_promotions_active_updated ON promotions (active, updated_at);
    `);
  }

  list({ activeOnly = false } = {}) {
    const rows = this.db.prepare(`
      SELECT id, title, description, reward_type, reward_value, scope, target_ids,
             active, created_at, updated_at
      FROM promotions
      ${activeOnly ? "WHERE active = 1" : ""}
      ORDER BY active DESC, updated_at DESC, created_at DESC
    `).all();
    return rows.map(mapPromotionRow);
  }

  get(id) {
    const row = this.db.prepare(`
      SELECT id, title, description, reward_type, reward_value, scope, target_ids,
             active, created_at, updated_at
      FROM promotions WHERE id = ?
    `).get(id);
    return row ? mapPromotionRow(row) : null;
  }

  create(input = {}) {
    const promotion = normalizePromotion(input);
    const timestamp = this.now().toISOString();
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO promotions (
        id, title, description, reward_type, reward_value, scope, target_ids,
        active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      promotion.title,
      promotion.description,
      promotion.rewardType,
      promotion.rewardValue,
      promotion.scope,
      JSON.stringify(promotion.targetIds),
      promotion.active ? 1 : 0,
      timestamp,
      timestamp,
    );
    return this.get(id);
  }

  update(id, input = {}) {
    const current = this.get(id);
    if (!current) throw new PromotionError("PROMOTION_NOT_FOUND", "Promotion not found.", 404);
    const promotion = normalizePromotion({ ...current, ...input });
    const timestamp = this.now().toISOString();
    this.db.prepare(`
      UPDATE promotions
      SET title = ?, description = ?, reward_type = ?, reward_value = ?, scope = ?,
          target_ids = ?, active = ?, updated_at = ?
      WHERE id = ?
    `).run(
      promotion.title,
      promotion.description,
      promotion.rewardType,
      promotion.rewardValue,
      promotion.scope,
      JSON.stringify(promotion.targetIds),
      promotion.active ? 1 : 0,
      timestamp,
      id,
    );
    return this.get(id);
  }

  deactivate(id) {
    const current = this.get(id);
    if (!current) throw new PromotionError("PROMOTION_NOT_FOUND", "Promotion not found.", 404);
    const timestamp = this.now().toISOString();
    this.db.prepare("UPDATE promotions SET active = 0, updated_at = ? WHERE id = ?").run(timestamp, id);
    return this.get(id);
  }

  previewBest(items = []) {
    const candidates = this.list({ activeOnly: true })
      .map((promotion) => this.preview(promotion, items))
      .filter(Boolean)
      .sort((left, right) => right.discountCents - left.discountCents);
    return candidates[0] || null;
  }

  preview(promotion, items = []) {
    if (!promotion?.active || !Array.isArray(items) || !items.length) return null;
    const targetIds = promotion.targetIds || [];
    const eligibleItems = items.filter((item) => targetIds.includes(item.productId || item.id));
    if (!eligibleItems.length) return null;

    if (promotion.scope === "pack") {
      const presentIds = new Set(
        eligibleItems
          .filter((item) => Number(item.quantity) > 0)
          .map((item) => item.productId || item.id),
      );
      if (targetIds.length < 2 || targetIds.some((id) => !presentIds.has(id))) return null;
    }

    const eligibleAmountCents = eligibleItems.reduce(
      (sum, item) => sum + Math.max(0, Math.trunc(Number(item.lineTotalCents ?? item.lineTotal) || 0)),
      0,
    );
    if (eligibleAmountCents <= 0) return null;
    const discountCents = promotion.scope === "items"
      ? eligibleItems.reduce(
          (sum, item) => sum + calculateItemDiscountCents(item, promotion.rewardType, promotion.rewardValue),
          0,
        )
      : calculatePromotionDiscountCents(eligibleAmountCents, promotion.rewardType, promotion.rewardValue);
    if (discountCents <= 0) return null;
    return {
      id: promotion.id,
      title: promotion.title,
      description: promotion.description,
      rewardType: promotion.rewardType,
      rewardValue: promotion.rewardValue,
      scope: promotion.scope,
      targetIds,
      eligibleAmountCents,
      discountCents,
      totalAfterDiscountCents: Math.max(0, eligibleAmountCents - discountCents),
    };
  }
}

export function calculatePromotionDiscountCents(amountCents, rewardType, rewardValue) {
  const amount = Math.max(0, Math.trunc(Number(amountCents) || 0));
  const value = Math.max(0, Math.trunc(Number(rewardValue) || 0));
  if (rewardType === "fixed") return Math.min(amount, value * 100);
  return Math.min(amount, Math.floor(amount * value / 100));
}

function calculateItemDiscountCents(item, rewardType, rewardValue) {
  const lineTotalCents = Math.max(0, Math.trunc(Number(item.lineTotalCents ?? item.lineTotal) || 0));
  if (rewardType !== "fixed") return calculatePromotionDiscountCents(lineTotalCents, rewardType, rewardValue);
  const quantity = Math.max(1, Math.trunc(Number(item.quantity) || 1));
  return Math.min(lineTotalCents, Math.max(0, Math.trunc(Number(rewardValue) || 0)) * 100 * quantity);
}

function normalizePromotion(input = {}) {
  const title = normalizeText(input.title, "PROMOTION_TITLE_INVALID", 120);
  const description = normalizeText(input.description, "PROMOTION_DESCRIPTION_INVALID", 240, true);
  const rewardType = String(input.rewardType || "").trim();
  if (!REWARD_TYPES.has(rewardType)) {
    throw new PromotionError("PROMOTION_REWARD_TYPE_INVALID", "The promotion reward type is invalid.");
  }
  const rewardValue = Number(input.rewardValue);
  if (!Number.isInteger(rewardValue) || rewardValue <= 0 || (rewardType === "percentage" && rewardValue > 100)) {
    throw new PromotionError("PROMOTION_REWARD_VALUE_INVALID", "The promotion value is invalid.");
  }
  const scope = String(input.scope || "items").trim();
  if (!PROMOTION_SCOPES.has(scope)) {
    throw new PromotionError("PROMOTION_SCOPE_INVALID", "The promotion scope is invalid.");
  }
  const targetIds = [...new Set(
    (Array.isArray(input.targetIds) ? input.targetIds : [])
      .filter((id) => typeof id === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id.trim()))
      .map((id) => id.trim())
      .slice(0, 50),
  )];
  if (scope === "items" && targetIds.length < 1) {
    throw new PromotionError("PROMOTION_ITEM_TARGET_REQUIRED", "An individual promotion must target at least one dish.");
  }
  if (scope === "pack" && targetIds.length < 2) {
    throw new PromotionError("PROMOTION_PACK_TARGET_REQUIRED", "A pack promotion requires at least two selected dishes.");
  }
  return {
    title,
    description,
    rewardType,
    rewardValue,
    scope,
    targetIds,
    active: input.active !== false && Number(input.active) !== 0,
  };
}

function normalizeText(value, code, maxLength, allowEmpty = false) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if ((!allowEmpty && !normalized) || normalized.length > maxLength) {
    throw new PromotionError(code, "The promotion text is invalid.");
  }
  return normalized;
}

function mapPromotionRow(row) {
  let targetIds = [];
  try {
    const parsed = JSON.parse(row.target_ids || "[]");
    if (Array.isArray(parsed)) targetIds = parsed.filter((id) => typeof id === "string");
  } catch { /* A malformed legacy value is treated as no target. */ }
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    rewardType: row.reward_type,
    rewardValue: row.reward_value,
    scope: row.scope,
    targetIds,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
