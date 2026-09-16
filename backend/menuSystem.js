import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MENU_STATUSES = new Set(["draft", "published", "archived"]);
const MENU_ITEM_TYPES = new Set(["dish", "menu", "offer"]);
const MAX_TITLE_LENGTH = 120;
const MAX_SHORT_DESCRIPTION_LENGTH = 240;
const MAX_LONG_DESCRIPTION_LENGTH = 2_000;
const MAX_CATEGORY_LENGTH = 40;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const DEFAULT_MENU = [
  {
    id: "tagliolini-beurre-noisette",
    itemType: "dish",
    category: "fresca",
    sortOrder: 1,
    title: "Tagliolini, beurre noisette",
    shortDescription: "Truffe noire, parmesan 36 mois",
    longDescription: "Une pâte fine tirée chaque jour, nappée d'un beurre noisette aux notes de sous-bois. La truffe noire et le parmesan affiné apportent une profondeur nette, sans alourdir l'assiette.",
    priceCents: 2900,
    imageUrl: "/assets/menu-tagliolini.png",
    imageAlt: "Tagliolini frais avec truffe noire et parmesan",
  },
  {
    id: "ravioli-courge-sauge",
    itemType: "dish",
    category: "vegetal",
    sortOrder: 2,
    title: "Ravioli de courge, sauge",
    shortDescription: "Noisette du Piémont, vinaigre de Xérès",
    longDescription: "La courge rôtie est enveloppée dans une pâte souple, puis servie avec une sauge croustillante, la rondeur de la noisette et quelques gouttes de vinaigre de Xérès.",
    priceCents: 2700,
    imageUrl: "/assets/menu-ravioli.png",
    imageAlt: "Ravioli de courge avec beurre de sauge et noisettes",
  },
  {
    id: "tortelli-betterave-ricotta",
    itemType: "dish",
    category: "ripiena",
    sortOrder: 3,
    title: "Tortelli betterave & ricotta",
    shortDescription: "Huile d'herbes, citron confit",
    longDescription: "Une farce de betterave rôtie et ricotta fraîche, relevée par le citron confit. L'huile d'herbes termine le plat avec une fraîcheur végétale et précise.",
    priceCents: 2600,
    imageUrl: "/assets/menu-tortelli.png",
    imageAlt: "Tortelli de betterave et ricotta avec herbes fraîches",
  },
];

const IMAGE_SIGNATURES = [
  { mimeType: "image/jpeg", extension: ".jpg", matches: (data) => data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff },
  { mimeType: "image/png", extension: ".png", matches: (data) => data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  { mimeType: "image/webp", extension: ".webp", matches: (data) => data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP" },
];

export class MenuError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = "MenuError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class MenuSystem {
  constructor({ db, uploadRoot, publicBasePath = "/uploads/menu", now = () => new Date() } = {}) {
    if (!db) throw new Error("MenuSystem requires a SQLite database.");
    this.db = db;
    this.uploadRoot = uploadRoot;
    this.publicBasePath = publicBasePath.replace(/\/$/, "");
    this.now = now;
    this.initializeSchema();
    this.seedDefaults();
  }

  initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        item_type TEXT NOT NULL DEFAULT 'dish',
        category TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
        available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
        draft_revision_id TEXT,
        published_revision_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published_at TEXT,
        archived_at TEXT
      );

      CREATE TABLE IF NOT EXISTS menu_item_revisions (
        id TEXT PRIMARY KEY,
        menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
        item_type TEXT NOT NULL DEFAULT 'dish',
        title TEXT NOT NULL,
        short_description TEXT NOT NULL DEFAULT '',
        long_description TEXT NOT NULL DEFAULT '',
        price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
        currency TEXT NOT NULL DEFAULT 'DZD',
        image_url TEXT NOT NULL DEFAULT '',
        image_alt TEXT NOT NULL DEFAULT '',
        available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_menu_items_public_order ON menu_items (status, sort_order, updated_at);
      CREATE INDEX IF NOT EXISTS idx_menu_revisions_item ON menu_item_revisions (menu_item_id, created_at);
    `);
    const revisionColumns = this.db.prepare("PRAGMA table_info(menu_item_revisions)").all();
    if (!revisionColumns.some((column) => column.name === "available")) {
      this.db.exec("ALTER TABLE menu_item_revisions ADD COLUMN available INTEGER NOT NULL DEFAULT 1");
    }
    const itemColumns = this.db.prepare("PRAGMA table_info(menu_items)").all();
    if (!itemColumns.some((column) => column.name === "available")) {
      this.db.exec("ALTER TABLE menu_items ADD COLUMN available INTEGER NOT NULL DEFAULT 1");
    }
    if (!itemColumns.some((column) => column.name === "item_type")) {
      this.db.exec("ALTER TABLE menu_items ADD COLUMN item_type TEXT NOT NULL DEFAULT 'dish'");
    }
    if (!revisionColumns.some((column) => column.name === "item_type")) {
      this.db.exec("ALTER TABLE menu_item_revisions ADD COLUMN item_type TEXT NOT NULL DEFAULT 'dish'");
    }
  }

  seedDefaults() {
    if (this.db.prepare("SELECT COUNT(*) AS count FROM menu_items").get().count > 0) return;
    const timestamp = this.now().toISOString();
    this.runInTransaction(() => {
      for (const item of DEFAULT_MENU) {
        const revisionId = randomUUID();
        this.db.prepare(`
          INSERT INTO menu_items (id, category, sort_order, status, draft_revision_id, published_revision_id, created_at, updated_at, published_at)
          VALUES (?, ?, ?, 'published', ?, ?, ?, ?, ?)
        `).run(item.id, item.category, item.sortOrder, revisionId, revisionId, timestamp, timestamp, timestamp);
        this.insertRevision({ revisionId, itemId: item.id, item, createdAt: timestamp });
      }
    });
  }

  runInTransaction(callback) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = callback();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  listPublished({ category = null } = {}) {
    const clauses = ["item.status = 'published'", "item.published_revision_id IS NOT NULL"];
    const params = [];
    if (category) {
      clauses.push("item.category = ?");
      params.push(normalizeCategory(category));
    }

    const rows = this.db.prepare(`
      SELECT
        item.id AS item_id,
        revision.item_type AS item_type,
        item.category,
        item.sort_order,
        item.updated_at,
        item.published_at,
        item.available,
        revision.title,
        revision.short_description,
        revision.long_description,
        revision.price_cents,
        revision.currency,
        revision.image_url,
        revision.image_alt
      FROM menu_items AS item
      JOIN menu_item_revisions AS revision ON revision.id = item.published_revision_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY item.sort_order, item.created_at
    `).all(...params);

    return rows.map((row) => mapPublishedRow(row));
  }

  listAdmin({ includeArchived = false } = {}) {
    const statusClause = includeArchived ? "" : "WHERE item.status <> 'archived'";
    return this.db.prepare(`
      SELECT
        item.*,
        draft.id AS draft_id,
        draft.item_type AS draft_item_type,
        draft.title AS draft_title,
        draft.short_description AS draft_short_description,
        draft.long_description AS draft_long_description,
        draft.price_cents AS draft_price_cents,
        draft.currency AS draft_currency,
        draft.image_url AS draft_image_url,
        draft.image_alt AS draft_image_alt,
        draft.available AS draft_available,
        draft.created_at AS draft_created_at,
        published.id AS published_id,
        published.item_type AS published_item_type,
        published.title AS published_title,
        published.short_description AS published_short_description,
        published.long_description AS published_long_description,
        published.price_cents AS published_price_cents,
        published.currency AS published_currency,
        published.image_url AS published_image_url,
        published.image_alt AS published_image_alt,
        published.available AS published_available,
        published.created_at AS published_created_at
      FROM menu_items AS item
      LEFT JOIN menu_item_revisions AS draft ON draft.id = item.draft_revision_id
      LEFT JOIN menu_item_revisions AS published ON published.id = item.published_revision_id
      ${statusClause}
      ORDER BY item.sort_order, item.created_at
    `).all().map((row) => mapAdminRow(row));
  }

  getAdmin(id) {
    const item = this.listAdmin({ includeArchived: true }).find((candidate) => candidate.id === id);
    if (!item) throw new MenuError("MENU_ITEM_NOT_FOUND", "Menu item was not found.", 404);
    return item;
  }

  create(input) {
    const item = normalizeMenuInput(input, { requireTitle: true });
    const id = randomUUID();
    const revisionId = randomUUID();
    const timestamp = this.now().toISOString();
    this.runInTransaction(() => {
      this.db.prepare(`
      INSERT INTO menu_items (id, item_type, category, sort_order, status, draft_revision_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)
      `).run(id, item.itemType, item.category, item.sortOrder, revisionId, timestamp, timestamp);
      this.insertRevision({ revisionId, itemId: id, item, createdAt: timestamp });
    });
    return this.getAdmin(id);
  }

  update(id, input) {
    const current = this.getAdmin(id);
    if (current.status === "archived") {
      throw new MenuError("MENU_ITEM_ARCHIVED", "Archived menu items cannot be edited.", 409);
    }
    const base = current.draft || current.published;
    const item = normalizeMenuInput({
      ...base,
      category: current.category,
      sortOrder: current.sortOrder,
      ...input,
    }, { requireTitle: true });
    const revisionId = randomUUID();
    const timestamp = this.now().toISOString();
    this.runInTransaction(() => {
      this.insertRevision({ revisionId, itemId: id, item, createdAt: timestamp });
      this.db.prepare(`
        UPDATE menu_items
        SET item_type = ?, category = ?, sort_order = ?, draft_revision_id = ?, status = 'draft', updated_at = ?, archived_at = NULL
        WHERE id = ?
      `).run(item.itemType, item.category, item.sortOrder, revisionId, timestamp, id);
    });
    return this.getAdmin(id);
  }

  publish(id) {
    const current = this.getAdmin(id);
    if (current.status === "archived") {
      throw new MenuError("MENU_ITEM_ARCHIVED", "Archived menu items cannot be published.", 409);
    }
    const revisionId = current.draft?.id || current.published?.id;
    if (!revisionId) throw new MenuError("MENU_REVISION_MISSING", "Menu item has no revision to publish.", 409);
    const timestamp = this.now().toISOString();
    this.db.prepare(`
      UPDATE menu_items
      SET published_revision_id = ?, status = 'published', published_at = ?, updated_at = ?, archived_at = NULL
      WHERE id = ?
    `).run(revisionId, timestamp, timestamp, id);
    return this.getAdmin(id);
  }

  archive(id) {
    this.getAdmin(id);
    const timestamp = this.now().toISOString();
    this.db.prepare("UPDATE menu_items SET status = 'archived', archived_at = ?, updated_at = ? WHERE id = ?")
      .run(timestamp, timestamp, id);
    return this.getAdmin(id);
  }

  setAvailability(id, available) {
    const current = this.getAdmin(id);
    if (current.status === "archived") throw new MenuError("MENU_ITEM_ARCHIVED", "Archived menu items cannot change availability.", 409);
    if (typeof available !== "boolean") throw new MenuError("MENU_AVAILABILITY_INVALID", "Availability must be true or false.", 400);
    this.db.prepare("UPDATE menu_items SET available = ?, updated_at = ? WHERE id = ?")
      .run(available ? 1 : 0, this.now().toISOString(), id);
    return this.getAdmin(id);
  }

  async uploadImage(id, file) {
    const current = this.getAdmin(id);
    if (current.status === "archived") {
      throw new MenuError("MENU_ITEM_ARCHIVED", "Archived menu items cannot receive images.", 409);
    }
    const image = validateImage(file);
    const filename = `${randomUUID()}${image.extension}`;
    await mkdir(this.uploadRoot, { recursive: true });
    const filePath = join(this.uploadRoot, filename);
    await writeFile(filePath, image.data, { flag: "wx" });
    try {
      return this.update(id, {
        imageUrl: `${this.publicBasePath}/${filename}`,
        imageAlt: file.imageAlt || current.draft?.imageAlt || current.published?.imageAlt || current.id,
      });
    } catch (error) {
      await unlink(filePath).catch(() => {});
      throw error;
    }
  }

  removeImage(id) {
    this.getAdmin(id);
    return this.update(id, { imageUrl: "", imageAlt: "" });
  }

  insertRevision({ revisionId, itemId, item, createdAt }) {
    this.db.prepare(`
      INSERT INTO menu_item_revisions (
        id, menu_item_id, item_type, title, short_description, long_description, price_cents, currency, image_url, image_alt, available, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'DZD', ?, ?, ?, ?)
    `).run(
      revisionId,
      itemId,
      item.itemType || "dish",
      item.title,
      item.shortDescription,
      item.longDescription,
      item.priceCents,
      item.imageUrl,
      item.imageAlt,
      item.available ? 1 : 0,
      createdAt,
    );
  }
}

function normalizeMenuInput(input, { requireTitle = false } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new MenuError("MENU_INPUT_INVALID", "Menu item payload must be an object.", 400);
  }

  const itemType = normalizeItemType(input.itemType ?? input.productType ?? "dish");
  const title = normalizeText(input.title);
  const shortDescription = normalizeText(input.shortDescription ?? input.description ?? "");
  const longDescription = normalizeText(input.longDescription ?? input.descriptionLong ?? shortDescription);
  const category = normalizeCategory(input.category || "pasta");
  const imageUrl = normalizeImageUrl(input.imageUrl || "");
  const imageAlt = normalizeText(input.imageAlt || "");
  const available = input.available !== false && input.isAvailable !== false && Number(input.available) !== 0;
  const sortOrder = normalizeSortOrder(input.sortOrder ?? 0);
  const priceCents = normalizePrice(input.priceCents ?? input.price ?? 0);

  if (requireTitle && !title) throw new MenuError("MENU_TITLE_REQUIRED", "Menu item title is required.", 400);
  if (title.length > MAX_TITLE_LENGTH) throw new MenuError("MENU_TITLE_TOO_LONG", "Menu item title is too long.", 400);
  if (shortDescription.length > MAX_SHORT_DESCRIPTION_LENGTH) throw new MenuError("MENU_SHORT_DESCRIPTION_TOO_LONG", "Short description is too long.", 400);
  if (longDescription.length > MAX_LONG_DESCRIPTION_LENGTH) throw new MenuError("MENU_LONG_DESCRIPTION_TOO_LONG", "Long description is too long.", 400);
  if (imageAlt.length > 240) throw new MenuError("MENU_IMAGE_ALT_TOO_LONG", "Image alt text is too long.", 400);

  return { itemType, title, shortDescription, longDescription, category, imageUrl, imageAlt, sortOrder, priceCents, available };
}

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeCategory(value) {
  const category = normalizeText(value).toLowerCase();
  if (!category || category.length > MAX_CATEGORY_LENGTH || !/^[a-z0-9][a-z0-9-]*$/.test(category)) {
    throw new MenuError("MENU_CATEGORY_INVALID", "Menu item category is invalid.", 400);
  }
  return category;
}

function normalizeItemType(value) {
  const itemType = normalizeText(value).toLowerCase();
  if (!MENU_ITEM_TYPES.has(itemType)) {
    throw new MenuError("MENU_ITEM_TYPE_INVALID", "Menu item type must be dish, menu or offer.", 400);
  }
  return itemType;
}

function normalizeImageUrl(value) {
  const imageUrl = normalizeText(value);
  if (!imageUrl) return "";
  if (!imageUrl.startsWith("/assets/") && !imageUrl.startsWith("/uploads/menu/")) {
    throw new MenuError("MENU_IMAGE_URL_INVALID", "Menu image must use a local asset path.", 400);
  }
  if (imageUrl.includes("..") || /[\u0000-\u001f]/.test(imageUrl)) {
    throw new MenuError("MENU_IMAGE_URL_INVALID", "Menu image path is invalid.", 400);
  }
  return imageUrl;
}

function normalizeSortOrder(value) {
  const sortOrder = Number(value);
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10_000) {
    throw new MenuError("MENU_SORT_ORDER_INVALID", "Menu item order is invalid.", 400);
  }
  return sortOrder;
}

function normalizePrice(value) {
  if (Number.isInteger(value) && value >= 0 && value <= 100_000_000_00) return value;
  const text = String(value ?? "").trim().replace(",", ".");
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(text)) {
    throw new MenuError("MENU_PRICE_INVALID", "Menu item price must be a valid non-negative amount.", 400);
  }
  const [whole, decimal = ""] = text.split(".");
  const priceCents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(priceCents) || priceCents > 100_000_000_00) {
    throw new MenuError("MENU_PRICE_INVALID", "Menu item price is too large.", 400);
  }
  return priceCents;
}

function validateImage(file) {
  if (!file || !Buffer.isBuffer(file.data) || file.data.length === 0) {
    throw new MenuError("MENU_IMAGE_REQUIRED", "An image file is required.", 400);
  }
  if (file.data.length > MAX_IMAGE_BYTES) {
    throw new MenuError("MENU_IMAGE_TOO_LARGE", "Menu image cannot exceed 5 MB.", 413);
  }
  const detected = IMAGE_SIGNATURES.find((signature) => signature.matches(file.data));
  if (!detected) {
    throw new MenuError("MENU_IMAGE_TYPE_INVALID", "Only JPEG, PNG and WebP images are accepted.", 415);
  }
  if (file.contentType && ![detected.mimeType, "application/octet-stream"].includes(file.contentType.toLowerCase())) {
    throw new MenuError("MENU_IMAGE_TYPE_INVALID", "Image content type does not match its file data.", 415);
  }
  return { ...detected, data: file.data };
}

function mapPublishedRow(row) {
  return {
    id: row.item_id,
    productType: row.item_type || "dish",
    category: row.category,
    sortOrder: row.sort_order,
    title: row.title,
    shortDescription: row.short_description,
    longDescription: row.long_description,
    priceCents: row.price_cents,
    price: formatPrice(row.price_cents),
    currency: row.currency,
    imageUrl: row.image_url,
    imageAlt: row.image_alt,
    available: Boolean(row.available),
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

function mapAdminRow(row) {
  const draft = row.draft_id ? mapRevision(row, "draft") : null;
  const published = row.published_id ? mapRevision(row, "published") : null;
  const current = (draft || published) ? { ...(draft || published), available: Boolean(row.available) } : null;
  return {
    id: row.id,
    productType: row.item_type || "dish",
    category: row.category,
    sortOrder: row.sort_order,
    status: MENU_STATUSES.has(row.status) ? row.status : "draft",
    available: Boolean(row.available),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    current,
    draft,
    published,
  };
}

function mapRevision(row, prefix) {
  const value = (key) => row[`${prefix}_${key}`];
  return {
    id: value("id"),
    productType: value("item_type") || "dish",
    title: value("title"),
    shortDescription: value("short_description"),
    longDescription: value("long_description"),
    priceCents: value("price_cents"),
    price: formatPrice(value("price_cents")),
    currency: value("currency"),
    imageUrl: value("image_url"),
    imageAlt: value("image_alt"),
    available: Boolean(value("available")),
    createdAt: value("created_at"),
  };
}

function formatPrice(priceCents) {
  return (Number(priceCents) / 100).toFixed(2);
}
