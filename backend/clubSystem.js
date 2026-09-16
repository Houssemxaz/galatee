import { randomUUID } from "node:crypto";

export class ClubError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = "ClubError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class ClubSystem {
  constructor({ db, now = () => new Date() } = {}) {
    if (!db) throw new Error("ClubSystem requires a SQLite database.");
    this.db = db;
    this.now = now;
    this.initializeSchema();
    this.seedDefaults();
  }

  initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pasta_club_settings (
        id TEXT PRIMARY KEY CHECK (id = 'default'),
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        title TEXT NOT NULL,
        intro TEXT NOT NULL,
        benefits TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pasta_club_events (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        event_date TEXT NOT NULL DEFAULT '',
        location TEXT NOT NULL DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_pasta_club_events_date ON pasta_club_events (event_date, active);
    `);
  }

  seedDefaults() {
    const timestamp = this.now().toISOString();
    this.db.prepare(`
      INSERT OR IGNORE INTO pasta_club_settings (id, active, title, intro, benefits, updated_at)
      VALUES ('default', 1, ?, ?, ?, ?)
    `).run(
      "Pasta Lover Club",
      "Un cercle pour celles et ceux qui aiment les pâtes, les rencontres et les soirées Galatee.",
      "Rencontres privées\nSoirées thématiques\nVêtements et casquettes\nAvant-premières et offres réservées",
      timestamp,
    );
  }

  getContent({ includeInactive = false } = {}) {
    const settings = this.db.prepare("SELECT * FROM pasta_club_settings WHERE id = 'default'").get();
    const events = this.db.prepare(`
      SELECT * FROM pasta_club_events
      ${includeInactive ? "" : "WHERE active = 1"}
      ORDER BY CASE WHEN event_date = '' THEN 1 ELSE 0 END, event_date, created_at
    `).all();
    return { settings: mapSettings(settings), events: events.map(mapEvent) };
  }

  updateSettings(input = {}) {
    const current = this.getContent({ includeInactive: true }).settings;
    const settings = normalizeSettings({ ...current, ...input });
    this.db.prepare(`
      UPDATE pasta_club_settings
      SET active = ?, title = ?, intro = ?, benefits = ?, updated_at = ?
      WHERE id = 'default'
    `).run(settings.active ? 1 : 0, settings.title, settings.intro, settings.benefits, this.now().toISOString());
    return this.getContent({ includeInactive: true });
  }

  createEvent(input = {}) {
    const event = normalizeEvent(input);
    const timestamp = this.now().toISOString();
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO pasta_club_events (id, title, description, event_date, location, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, event.title, event.description, event.eventDate, event.location, event.active ? 1 : 0, timestamp, timestamp);
    return this.getContent({ includeInactive: true }).events.find((item) => item.id === id);
  }

  updateEvent(id, input = {}) {
    const current = this.getContent({ includeInactive: true }).events.find((item) => item.id === id);
    if (!current) throw new ClubError("CLUB_EVENT_NOT_FOUND", "Club event was not found.", 404);
    const event = normalizeEvent({ ...current, ...input });
    this.db.prepare(`
      UPDATE pasta_club_events
      SET title = ?, description = ?, event_date = ?, location = ?, active = ?, updated_at = ?
      WHERE id = ?
    `).run(event.title, event.description, event.eventDate, event.location, event.active ? 1 : 0, this.now().toISOString(), id);
    return this.getContent({ includeInactive: true }).events.find((item) => item.id === id);
  }

  deleteEvent(id) {
    const result = this.db.prepare("DELETE FROM pasta_club_events WHERE id = ?").run(id);
    if (!result.changes) throw new ClubError("CLUB_EVENT_NOT_FOUND", "Club event was not found.", 404);
    return { id };
  }
}

function normalizeSettings(input) {
  return {
    active: input.active !== false && Number(input.active) !== 0,
    title: normalizeText(input.title, "CLUB_TITLE_INVALID", 120),
    intro: normalizeText(input.intro, "CLUB_INTRO_INVALID", 500),
    benefits: normalizeText(input.benefits, "CLUB_BENEFITS_INVALID", 2_000, true),
  };
}

function normalizeEvent(input) {
  const eventDate = String(input.eventDate ?? input.date ?? "").trim();
  if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) throw new ClubError("CLUB_EVENT_DATE_INVALID", "Event date must use YYYY-MM-DD.");
  return {
    title: normalizeText(input.title, "CLUB_EVENT_TITLE_INVALID", 120),
    description: normalizeText(input.description, "CLUB_EVENT_DESCRIPTION_INVALID", 500, true),
    eventDate,
    location: normalizeText(input.location, "CLUB_EVENT_LOCATION_INVALID", 160, true),
    active: input.active !== false && Number(input.active) !== 0,
  };
}

function normalizeText(value, code, maxLength, allowEmpty = false) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if ((!allowEmpty && !normalized) || normalized.length > maxLength) throw new ClubError(code, "Club content is invalid.");
  return normalized;
}

function mapSettings(row) {
  return { active: Boolean(row.active), title: row.title, intro: row.intro, benefits: row.benefits, updatedAt: row.updated_at };
}

function mapEvent(row) {
  return { id: row.id, title: row.title, description: row.description, eventDate: row.event_date, location: row.location, active: Boolean(row.active), createdAt: row.created_at, updatedAt: row.updated_at };
}
