import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_SERVICES = [
  {
    id: "dinner-wednesday",
    name: "Dinner",
    weekday: 3,
    startTime: "19:00",
    endTime: "21:30",
    slotIntervalMinutes: 30,
    normalTableCount: 1,
    normalTableCapacity: 18,
    vipTableCount: 1,
    vipTableCapacity: 4,
    normalCapacityCovers: 18,
    vipCapacityCovers: 4,
    active: true,
  },
  {
    id: "dinner-thursday",
    name: "Dinner",
    weekday: 4,
    startTime: "19:00",
    endTime: "21:30",
    slotIntervalMinutes: 30,
    normalTableCount: 1,
    normalTableCapacity: 18,
    vipTableCount: 1,
    vipTableCapacity: 4,
    normalCapacityCovers: 18,
    vipCapacityCovers: 4,
    active: true,
  },
  {
    id: "dinner-friday",
    name: "Dinner",
    weekday: 5,
    startTime: "19:00",
    endTime: "21:30",
    slotIntervalMinutes: 30,
    normalTableCount: 1,
    normalTableCapacity: 20,
    vipTableCount: 1,
    vipTableCapacity: 6,
    normalCapacityCovers: 20,
    vipCapacityCovers: 6,
    active: true,
  },
  {
    id: "dinner-saturday",
    name: "Dinner",
    weekday: 6,
    startTime: "19:00",
    endTime: "21:30",
    slotIntervalMinutes: 30,
    normalTableCount: 1,
    normalTableCapacity: 20,
    vipTableCount: 1,
    vipTableCapacity: 6,
    normalCapacityCovers: 20,
    vipCapacityCovers: 6,
    active: true,
  },
];

const DEFAULT_TABLES = [
  { id: "normal-01", label: "Normal 01", tableType: "normal", capacity: 18, effectiveFrom: "2026-01-01" },
  { id: "vip-01", label: "VIP 01", tableType: "vip", capacity: 4, effectiveFrom: "2026-01-01" },
];

const MAX_PARTY_SIZE = 6;
const CONFIRMED_STATUSES = new Set(["confirmed"]);
const RESERVATION_STATUSES = new Set(["requested", "confirmed", "cancelled", "completed"]);
const TABLE_TYPES = new Set(["normal", "vip"]);

export class ReservationError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = "ReservationError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class SqliteReservationStore {
  constructor({ databasePath = ":memory:", legacyJsonPath = null, services = DEFAULT_SERVICES, tables = DEFAULT_TABLES } = {}) {
    if (databasePath !== ":memory:") {
      mkdirSync(dirname(databasePath), { recursive: true });
    }

    this.db = new DatabaseSync(databasePath);
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA busy_timeout = 5000");
    if (databasePath !== ":memory:") {
      this.db.exec("PRAGMA journal_mode = WAL");
    }
    this.initializeSchema();
    this.seedServices(services);
    this.seedAvailabilitySettings(services);
    this.seedTables(tables);
    this.migrateLegacyJson(legacyJsonPath);
    this.backfillAutomaticBlockedTimeSlots();
  }

  close() {
    this.db.close();
  }

  initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        slot_interval_minutes INTEGER NOT NULL CHECK (slot_interval_minutes > 0),
        normal_table_count INTEGER NOT NULL DEFAULT 1 CHECK (normal_table_count >= 0),
        normal_table_capacity INTEGER NOT NULL DEFAULT 1 CHECK (normal_table_capacity > 0),
        vip_table_count INTEGER NOT NULL DEFAULT 1 CHECK (vip_table_count >= 0),
        vip_table_capacity INTEGER NOT NULL DEFAULT 1 CHECK (vip_table_capacity > 0),
        normal_capacity_covers INTEGER NOT NULL CHECK (normal_capacity_covers >= 0),
        vip_capacity_covers INTEGER NOT NULL CHECK (vip_capacity_covers >= 0),
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
      );

      CREATE TABLE IF NOT EXISTS reservations (
        id TEXT PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        party_size INTEGER NOT NULL CHECK (party_size > 0),
        table_type TEXT NOT NULL CHECK (table_type IN ('normal', 'vip')),
        status TEXT NOT NULL CHECK (status IN ('requested', 'confirmed', 'cancelled', 'completed')),
        special_request TEXT NOT NULL DEFAULT '',
        customer_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS blocked_time_slots (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        table_type TEXT CHECK (table_type IN ('normal', 'vip')),
        reason TEXT NOT NULL DEFAULT '',
        reservation_id TEXT REFERENCES reservations(id) ON DELETE SET NULL,
        created_by TEXT NOT NULL DEFAULT 'manual' CHECK (created_by IN ('manual', 'reservation_confirmation')),
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS restaurant_tables (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        table_type TEXT NOT NULL CHECK (table_type IN ('normal', 'vip')),
        capacity INTEGER NOT NULL CHECK (capacity > 0),
        effective_from TEXT NOT NULL,
        effective_to TEXT,
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
      );

      CREATE TABLE IF NOT EXISTS reservation_table_assignments (
        reservation_id TEXT PRIMARY KEY REFERENCES reservations(id) ON DELETE CASCADE,
        table_id TEXT NOT NULL REFERENCES restaurant_tables(id),
        assigned_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS availability_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        name TEXT NOT NULL,
        active_days TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        slot_interval_minutes INTEGER NOT NULL CHECK (slot_interval_minutes > 0),
        normal_table_count INTEGER NOT NULL CHECK (normal_table_count >= 0),
        normal_table_capacity INTEGER NOT NULL CHECK (normal_table_capacity > 0),
        vip_table_count INTEGER NOT NULL CHECK (vip_table_count >= 0),
        vip_table_capacity INTEGER NOT NULL CHECK (vip_table_capacity > 0),
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS availability_settings_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        source_id TEXT NOT NULL,
        name TEXT NOT NULL,
        active_days TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        slot_interval_minutes INTEGER NOT NULL,
        normal_table_count INTEGER NOT NULL,
        normal_table_capacity INTEGER NOT NULL,
        vip_table_count INTEGER NOT NULL,
        vip_table_capacity INTEGER NOT NULL,
        active INTEGER NOT NULL,
        changed_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS availability_events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        date_from TEXT NOT NULL,
        date_to TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        slot_interval_minutes INTEGER NOT NULL CHECK (slot_interval_minutes > 0),
        normal_table_count INTEGER NOT NULL CHECK (normal_table_count >= 0),
        normal_table_capacity INTEGER NOT NULL CHECK (normal_table_capacity > 0),
        vip_table_count INTEGER NOT NULL CHECK (vip_table_count >= 0),
        vip_table_capacity INTEGER NOT NULL CHECK (vip_table_capacity > 0),
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_services_weekday ON services (weekday);
      CREATE INDEX IF NOT EXISTS idx_reservations_date_time_type_status ON reservations (date, time, table_type, status);
      CREATE INDEX IF NOT EXISTS idx_reservations_date_status ON reservations (date, status);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_time_slots_unique ON blocked_time_slots (date, time, COALESCE(table_type, 'all'));
      CREATE INDEX IF NOT EXISTS idx_blocked_time_slots_date ON blocked_time_slots (date);
      CREATE INDEX IF NOT EXISTS idx_restaurant_tables_effective ON restaurant_tables (effective_from, effective_to, table_type);
      CREATE INDEX IF NOT EXISTS idx_table_assignments_table ON reservation_table_assignments (table_id);
      CREATE INDEX IF NOT EXISTS idx_availability_events_dates ON availability_events (date_from, date_to, active);
    `);
    this.ensureColumn(
      "blocked_time_slots",
      "reservation_id",
      "reservation_id TEXT REFERENCES reservations(id) ON DELETE SET NULL",
    );
    this.ensureColumn(
      "blocked_time_slots",
      "created_by",
      "created_by TEXT NOT NULL DEFAULT 'manual' CHECK (created_by IN ('manual', 'reservation_confirmation'))",
    );
    this.ensureColumn("reservations", "customer_id", "customer_id TEXT");
    const addedTableSettings = [
      this.ensureColumn("services", "normal_table_count", "normal_table_count INTEGER NOT NULL DEFAULT 1"),
      this.ensureColumn("services", "normal_table_capacity", "normal_table_capacity INTEGER NOT NULL DEFAULT 1"),
      this.ensureColumn("services", "vip_table_count", "vip_table_count INTEGER NOT NULL DEFAULT 1"),
      this.ensureColumn("services", "vip_table_capacity", "vip_table_capacity INTEGER NOT NULL DEFAULT 1"),
    ].some(Boolean);
    if (addedTableSettings) {
      this.db.exec(`
        UPDATE services
        SET normal_table_count = CASE WHEN normal_capacity_covers > 0 THEN 1 ELSE 0 END,
            normal_table_capacity = CASE WHEN normal_capacity_covers > 0 THEN normal_capacity_covers ELSE 1 END,
            vip_table_count = CASE WHEN vip_capacity_covers > 0 THEN 1 ELSE 0 END,
            vip_table_capacity = CASE WHEN vip_capacity_covers > 0 THEN vip_capacity_covers ELSE 1 END
      `);
    }
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_reservations_customer_id ON reservations (customer_id, date, created_at)");
  }

  ensureColumn(tableName, columnName, definition) {
    const columns = this.db.prepare(`PRAGMA table_info(${tableName})`).all();
    if (columns.some((column) => column.name === columnName)) return false;
    try {
      this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
      return true;
    } catch (error) {
      // Another process may have completed this idempotent migration after the PRAGMA check.
      if (!String(error.message || error).toLowerCase().includes("duplicate column")) throw error;
      return false;
    }
  }

  seedServices(services) {
    const insert = this.db.prepare(`
      INSERT INTO services (
        id,
        name,
        weekday,
        start_time,
        end_time,
        slot_interval_minutes,
        normal_table_count,
        normal_table_capacity,
        vip_table_count,
        vip_table_capacity,
        normal_capacity_covers,
        vip_capacity_covers,
        active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `);

    this.runInTransaction(() => {
      for (const service of services) {
        insert.run(
          service.id,
          service.name,
          service.weekday,
          service.startTime,
          service.endTime,
          service.slotIntervalMinutes,
          service.normalTableCount,
          service.normalTableCapacity,
          service.vipTableCount,
          service.vipTableCapacity,
          service.normalCapacityCovers,
          service.vipCapacityCovers,
          service.active ? 1 : 0,
        );
      }
    });
  }

  seedTables(tables) {
    if (this.db.prepare("SELECT COUNT(*) AS count FROM restaurant_tables").get().count > 0) return;

    const insert = this.db.prepare(`
      INSERT INTO restaurant_tables (id, label, table_type, capacity, effective_from, effective_to, active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    this.runInTransaction(() => {
      for (const table of tables) {
        insert.run(table.id, table.label, table.tableType, table.capacity, table.effectiveFrom, table.effectiveTo || null, table.active === false ? 0 : 1);
      }
    });
  }

  seedAvailabilitySettings(services) {
    if (this.db.prepare("SELECT 1 FROM availability_settings WHERE id = 1").get()) return;
    const base = services[0] || DEFAULT_SERVICES[0];
    const activeDays = services.filter((service) => service.active).map((service) => service.weekday);
    this.db.prepare(`
      INSERT INTO availability_settings (
        id, name, active_days, start_time, end_time, slot_interval_minutes,
        normal_table_count, normal_table_capacity, vip_table_count, vip_table_capacity, active, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      base.name,
      JSON.stringify(activeDays),
      base.startTime,
      base.endTime,
      base.slotIntervalMinutes,
      base.normalTableCount || 1,
      base.normalTableCapacity || base.normalCapacityCovers,
      base.vipTableCount || 1,
      base.vipTableCapacity || base.vipCapacityCovers,
      1,
      new Date().toISOString(),
    );
  }

  migrateLegacyJson(legacyJsonPath) {
    if (!legacyJsonPath || !existsSync(legacyJsonPath)) return;
    if (this.db.prepare("SELECT COUNT(*) AS count FROM reservations").get().count > 0) return;
    if (this.db.prepare("SELECT COUNT(*) AS count FROM blocked_time_slots").get().count > 0) return;

    const legacy = normalizeLegacyState(JSON.parse(readFileSync(legacyJsonPath, "utf8")));
    if (!legacy.reservations.length && !legacy.blockedTimeSlots.length) return;

    const insertReservation = this.db.prepare(`
      INSERT OR IGNORE INTO reservations (
        id, first_name, last_name, phone, email, date, time, party_size, table_type, status, special_request, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertBlockedTimeSlot = this.db.prepare(`
      INSERT OR IGNORE INTO blocked_time_slots (id, date, time, table_type, reason, reservation_id, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.runInTransaction(() => {
      for (const reservation of legacy.reservations) {
        const normalized = normalizeLegacyReservation(reservation);
        insertReservation.run(
          normalized.id,
          normalized.firstName,
          normalized.lastName,
          normalized.phone,
          normalized.email || null,
          normalized.date,
          normalized.time,
          normalized.partySize,
          normalized.tableType,
          normalized.status,
          normalized.specialRequest,
          normalized.createdAt,
          normalized.updatedAt,
        );
      }

      for (const blockedTimeSlot of legacy.blockedTimeSlots) {
        insertBlockedTimeSlot.run(
          blockedTimeSlot.id || randomUUID(),
          blockedTimeSlot.date,
          blockedTimeSlot.time,
          TABLE_TYPES.has(blockedTimeSlot.tableType) ? blockedTimeSlot.tableType : null,
          blockedTimeSlot.reason || "",
          blockedTimeSlot.reservationId || null,
          blockedTimeSlot.createdBy || "manual",
          blockedTimeSlot.createdAt || new Date().toISOString(),
        );
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

  getActiveServiceForDate(date) {
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    const event = this.db.prepare(`
      SELECT * FROM availability_events
      WHERE active = 1 AND date_from <= ? AND date_to >= ?
      ORDER BY date_from DESC, created_at DESC
      LIMIT 1
    `).get(date, date);
    if (event) return mapAvailabilityEventRow(event, weekday);

    const settings = this.getAvailabilitySettings();
    if (!settings.active || !settings.activeDays.includes(weekday)) return null;
    const legacyService = this.db.prepare("SELECT id FROM services WHERE weekday = ?").get(weekday);
    return { ...settings, weekday, id: legacyService?.id || "global-service" };
  }

  getAvailabilitySettings() {
    const row = this.db.prepare("SELECT * FROM availability_settings WHERE id = 1").get();
    return row ? mapAvailabilitySettingsRow(row) : null;
  }

  updateAvailabilitySettings(settings) {
    return this.runInTransaction(() => {
      const current = this.db.prepare("SELECT * FROM availability_settings WHERE id = 1").get();
      if (current) this.recordAvailabilitySettingsHistory(mapAvailabilitySettingsRow(current), "global", "1", settings.updatedAt);
      this.db.prepare(`
        UPDATE availability_settings
        SET name = ?, active_days = ?, start_time = ?, end_time = ?, slot_interval_minutes = ?,
            normal_table_count = ?, normal_table_capacity = ?, vip_table_count = ?, vip_table_capacity = ?,
            active = ?, updated_at = ?
        WHERE id = 1
      `).run(
        settings.name,
        JSON.stringify(settings.activeDays),
        settings.startTime,
        settings.endTime,
        settings.slotIntervalMinutes,
        settings.normalTableCount,
        settings.normalTableCapacity,
        settings.vipTableCount,
        settings.vipTableCapacity,
        settings.active ? 1 : 0,
        settings.updatedAt,
      );
      return this.getAvailabilitySettings();
    });
  }

  recordAvailabilitySettingsHistory(settings, source, sourceId, changedAt) {
    this.db.prepare(`
      INSERT INTO availability_settings_history (
        source, source_id, name, active_days, start_time, end_time, slot_interval_minutes,
        normal_table_count, normal_table_capacity, vip_table_count, vip_table_capacity, active, changed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      source,
      sourceId,
      settings.name,
      JSON.stringify(settings.activeDays),
      settings.startTime,
      settings.endTime,
      settings.slotIntervalMinutes,
      settings.normalTableCount,
      settings.normalTableCapacity,
      settings.vipTableCount,
      settings.vipTableCapacity,
      settings.active ? 1 : 0,
      changedAt,
    );
  }

  listAvailabilitySettingsHistory() {
    return this.db.prepare("SELECT * FROM availability_settings_history ORDER BY changed_at DESC, id DESC").all().map((row) => ({
      id: row.id,
      source: row.source,
      sourceId: row.source_id,
      name: row.name,
      activeDays: JSON.parse(row.active_days),
      startTime: row.start_time,
      endTime: row.end_time,
      slotIntervalMinutes: row.slot_interval_minutes,
      normalTableCount: row.normal_table_count,
      normalTableCapacity: row.normal_table_capacity,
      vipTableCount: row.vip_table_count,
      vipTableCapacity: row.vip_table_capacity,
      active: Boolean(row.active),
      changedAt: row.changed_at,
    }));
  }

  listAvailabilityEvents() {
    return this.db.prepare("SELECT * FROM availability_events ORDER BY date_from, created_at").all().map(mapAvailabilityEventRow);
  }

  findOverlappingAvailabilityEvent(event) {
    return this.db.prepare(`
      SELECT * FROM availability_events
      WHERE active = 1
        AND date_from <= ?
        AND date_to >= ?
        AND id <> ?
      ORDER BY date_from, created_at
      LIMIT 1
    `).get(event.dateTo, event.dateFrom, event.id || "") || null;
  }

  createAvailabilityEvent(event) {
    this.db.prepare(`
      INSERT INTO availability_events (
        id, name, date_from, date_to, start_time, end_time, slot_interval_minutes,
        normal_table_count, normal_table_capacity, vip_table_count, vip_table_capacity, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id, event.name, event.dateFrom, event.dateTo, event.startTime, event.endTime, event.slotIntervalMinutes,
      event.normalTableCount, event.normalTableCapacity, event.vipTableCount, event.vipTableCapacity,
      event.active ? 1 : 0, event.createdAt, event.updatedAt,
    );
    return mapAvailabilityEventRow(this.db.prepare("SELECT * FROM availability_events WHERE id = ?").get(event.id));
  }

  updateAvailabilityEvent(event) {
    return this.runInTransaction(() => {
      const result = this.db.prepare(`
        UPDATE availability_events
        SET name = ?, date_from = ?, date_to = ?, start_time = ?, end_time = ?, slot_interval_minutes = ?,
            normal_table_count = ?, normal_table_capacity = ?, vip_table_count = ?, vip_table_capacity = ?,
            active = ?, updated_at = ?
        WHERE id = ?
      `).run(
        event.name, event.dateFrom, event.dateTo, event.startTime, event.endTime, event.slotIntervalMinutes,
        event.normalTableCount, event.normalTableCapacity, event.vipTableCount, event.vipTableCapacity,
        event.active ? 1 : 0, event.updatedAt, event.id,
      );
      return result.changes ? mapAvailabilityEventRow(this.db.prepare("SELECT * FROM availability_events WHERE id = ?").get(event.id)) : null;
    });
  }

  deleteAvailabilityEvent(id) {
    return this.db.prepare("DELETE FROM availability_events WHERE id = ?").run(id).changes > 0;
  }

  listServices() {
    return this.db
      .prepare("SELECT * FROM services ORDER BY weekday")
      .all()
      .map(mapServiceRow);
  }

  getServiceById(id) {
    const row = this.db.prepare("SELECT * FROM services WHERE id = ?").get(id);
    return row ? mapServiceRow(row) : null;
  }

  updateService(service) {
    return this.runInTransaction(() => {
      const result = this.db.prepare(`
        UPDATE services
        SET name = ?, start_time = ?, end_time = ?, slot_interval_minutes = ?,
            normal_table_count = ?, normal_table_capacity = ?,
            vip_table_count = ?, vip_table_capacity = ?,
            normal_capacity_covers = ?, vip_capacity_covers = ?, active = ?
        WHERE id = ?
      `).run(
        service.name,
        service.startTime,
        service.endTime,
        service.slotIntervalMinutes,
        service.normalTableCount,
        service.normalTableCapacity,
        service.vipTableCount,
        service.vipTableCapacity,
        service.normalCapacityCovers,
        service.vipCapacityCovers,
        service.active ? 1 : 0,
        service.id,
      );

      if (result.changes === 0) return null;
      const currentSettings = this.getAvailabilitySettings();
      if (currentSettings) {
        this.recordAvailabilitySettingsHistory(currentSettings, "global", "1", new Date().toISOString());
        this.db.prepare(`
          UPDATE availability_settings
          SET name = ?, start_time = ?, end_time = ?, slot_interval_minutes = ?,
              normal_table_count = ?, normal_table_capacity = ?, vip_table_count = ?, vip_table_capacity = ?,
              active = ?, updated_at = ?
          WHERE id = 1
        `).run(
          service.name,
          service.startTime,
          service.endTime,
          service.slotIntervalMinutes,
          service.normalTableCount,
          service.normalTableCapacity,
          service.vipTableCount,
          service.vipTableCapacity,
          service.active ? 1 : 0,
          new Date().toISOString(),
        );
      }
      return this.getServiceById(service.id);
    });
  }

  listTables({ date = null } = {}) {
    const rows = date
      ? this.db.prepare(`
        SELECT * FROM restaurant_tables
        WHERE effective_from <= ?
          AND (effective_to IS NULL OR effective_to >= ?)
        ORDER BY table_type, capacity, label
      `).all(date, date)
      : this.db.prepare("SELECT * FROM restaurant_tables ORDER BY effective_from DESC, table_type, capacity, label").all();
    return rows.map(mapRestaurantTableRow);
  }

  getTablesForDate(date, tableType = null) {
    const rows = this.db.prepare(`
      SELECT * FROM restaurant_tables
      WHERE active = 1
        AND effective_from <= ?
        AND (effective_to IS NULL OR effective_to >= ?)
        ${tableType ? "AND table_type = ?" : ""}
      ORDER BY capacity, label
    `).all(...(tableType ? [date, date, tableType] : [date, date]));
    return rows.map(mapRestaurantTableRow);
  }

  replaceTables({ effectiveFrom, tables }) {
    return this.runInTransaction(() => {
      const previousDate = previousISODate(effectiveFrom);
      this.db.prepare(`
        UPDATE restaurant_tables
        SET effective_to = ?
        WHERE effective_to IS NULL AND effective_from < ?
      `).run(previousDate, effectiveFrom);

      const insert = this.db.prepare(`
        INSERT INTO restaurant_tables (id, label, table_type, capacity, effective_from, effective_to, active)
        VALUES (?, ?, ?, ?, ?, NULL, 1)
      `);
      for (const table of tables) {
        insert.run(randomUUID(), table.label, table.tableType, table.capacity, effectiveFrom);
      }

      return this.listTables({ date: effectiveFrom });
    });
  }

  findAvailableTable({ date, time, tableType, partySize, excludeReservationId = null }) {
    const tables = this.getTablesForDate(date, tableType);
    return tables.find((table) => (
      table.capacity >= partySize
      && !this.db.prepare(`
        SELECT 1
        FROM reservation_table_assignments AS assignment
        JOIN reservations AS reservation ON reservation.id = assignment.reservation_id
        WHERE assignment.table_id = ?
          AND reservation.date = ?
          AND reservation.time = ?
          AND reservation.status = 'confirmed'
          ${excludeReservationId ? "AND reservation.id <> ?" : ""}
        LIMIT 1
      `).get(...(excludeReservationId
        ? [table.id, date, time, excludeReservationId]
        : [table.id, date, time])) === undefined
    ));
  }

  assignTable(reservationId, tableId, assignedAt) {
    this.db.prepare(`
      INSERT INTO reservation_table_assignments (reservation_id, table_id, assigned_at)
      VALUES (?, ?, ?)
      ON CONFLICT(reservation_id) DO UPDATE SET table_id = excluded.table_id, assigned_at = excluded.assigned_at
    `).run(reservationId, tableId, assignedAt);
  }

  removeTableAssignment(reservationId) {
    this.db.prepare("DELETE FROM reservation_table_assignments WHERE reservation_id = ?").run(reservationId);
  }

  listReservations({ date = null, status = null, customerId = null } = {}) {
    const clauses = [];
    const params = {};

    if (date) {
      clauses.push("date = $date");
      params.$date = date;
    }
    if (status) {
      clauses.push("status = $status");
      params.$status = status;
    }
    if (customerId) {
      clauses.push("customer_id = $customerId");
      params.$customerId = customerId;
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return this.db
      .prepare(`SELECT * FROM reservations ${where} ORDER BY date, time, created_at`)
      .all(params)
      .map(mapReservationRow);
  }

  updateReservationStatus(id, status, updatedAt) {
    return this.runInTransaction(() => {
      const reservationRow = this.db.prepare("SELECT * FROM reservations WHERE id = ?").get(id);
      if (!reservationRow) return null;
      const reservation = mapReservationRow(reservationRow);

      if (status === reservation.status) {
        return reservation;
      }

      let serviceForConfirmation = null;
      if (status === "confirmed" && reservation.status !== "confirmed") {
        this.assertReservationCanBeConfirmed(reservation);
        serviceForConfirmation = this.getActiveServiceForDate(reservation.date);
      }

      this.db
        .prepare("UPDATE reservations SET status = ?, updated_at = ? WHERE id = ?")
        .run(status, updatedAt, id);

      if (reservation.status === "confirmed" && status === "cancelled") {
        const service = this.getActiveServiceForDate(reservation.date);
        const tableConfig = service && tableConfigForType(service, reservation.tableType);
        const occupiedTables = this.confirmedTableCount({ date: reservation.date, time: reservation.time, tableType: reservation.tableType });
        if (!tableConfig || occupiedTables < tableConfig.tableCount) {
          this.removeAutomaticBlockedTimeSlotForReservation(reservation.id);
        }
      }

      if (status === "confirmed" && reservation.status !== "confirmed" && serviceForConfirmation) {
        const tableConfig = tableConfigForType(serviceForConfirmation, reservation.tableType);
        if (this.confirmedTableCount({
          date: reservation.date,
          time: reservation.time,
          tableType: reservation.tableType,
        }) >= tableConfig.tableCount) {
          this.createAutomaticBlockedTimeSlotForReservation(reservation, updatedAt);
        }
      }
      return mapReservationRow(this.db.prepare("SELECT * FROM reservations WHERE id = ?").get(id));
    });
  }

  listBlockedTimeSlots({ date = null } = {}) {
    const rows = date
      ? this.db.prepare("SELECT * FROM blocked_time_slots WHERE date = ? ORDER BY date, time").all(date)
      : this.db.prepare("SELECT * FROM blocked_time_slots ORDER BY date, time").all();
    return rows.map(mapBlockedTimeSlotRow);
  }

  blockTimeSlot(blockedTimeSlot) {
    this.db.prepare(`
      INSERT INTO blocked_time_slots (id, date, time, table_type, reason, reservation_id, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      blockedTimeSlot.id,
      blockedTimeSlot.date,
      blockedTimeSlot.time,
      blockedTimeSlot.tableType,
      blockedTimeSlot.reason,
      blockedTimeSlot.reservationId || null,
      blockedTimeSlot.createdBy || "manual",
      blockedTimeSlot.createdAt,
    );

    return mapBlockedTimeSlotRow(this.db.prepare("SELECT * FROM blocked_time_slots WHERE id = ?").get(blockedTimeSlot.id));
  }

  unblockTimeSlot(id) {
    const result = this.db.prepare("DELETE FROM blocked_time_slots WHERE id = ?").run(id);
    return result.changes > 0;
  }

  backfillAutomaticBlockedTimeSlots() {
    const confirmedReservations = this.db.prepare(`
      SELECT *
      FROM reservations AS reservation
      WHERE reservation.status = 'confirmed'
        AND NOT EXISTS (
          SELECT 1
          FROM blocked_time_slots AS blocked_time_slot
          WHERE blocked_time_slot.reservation_id = reservation.id
            AND blocked_time_slot.created_by = 'reservation_confirmation'
        )
      ORDER BY reservation.date, reservation.time, reservation.created_at
    `).all().map(mapReservationRow);

    if (!confirmedReservations.length) return;

    const timestamp = new Date().toISOString();
    this.runInTransaction(() => {
      for (const reservation of confirmedReservations) {
        const service = this.getActiveServiceForDate(reservation.date);
        if (!service) continue;
        const tableConfig = tableConfigForType(service, reservation.tableType);
        if (this.confirmedTableCount({ date: reservation.date, time: reservation.time, tableType: reservation.tableType }) < tableConfig.tableCount) {
          continue;
        }
        if (this.findBlockingTimeSlot({ date: reservation.date, time: reservation.time, tableType: reservation.tableType })) continue;

        this.blockTimeSlot({
          id: randomUUID(),
          date: reservation.date,
          time: reservation.time,
          tableType: reservation.tableType,
          reason: `Reservation ${reservation.id} confirmed`,
          reservationId: reservation.id,
          createdBy: "reservation_confirmation",
          createdAt: reservation.updatedAt || timestamp,
        });
      }
    });
  }

  getAvailability({ date, partySize, tableType }) {
    const service = this.getActiveServiceForDate(date);
    if (!service) {
      return {
        service: null,
        timeSlots: [],
      };
    }

    const timeSlots = buildTimeSlots(service).map((time) => {
      const reservedCovers = this.reservedCovers({ date, time, tableType });
      const tableConfig = tableConfigForType(service, tableType);
      const availableTables = Math.max(tableConfig.tableCount - this.confirmedTableCount({ date, time, tableType }), 0);
      const remainingCovers = availableTables * tableConfig.tableCapacity;
      const blocked = this.isBlocked({ date, time, tableType });

      return {
        time,
        remainingCovers,
        available: !blocked && availableTables > 0 && tableConfig.tableCapacity >= partySize,
      };
    });

    return {
      service,
      timeSlots: timeSlots.filter((slot) => slot.available),
    };
  }

  getAdminAvailability({ date, partySize, tableType, time = null }) {
    const service = this.getActiveServiceForDate(date);
    if (!service) {
      return {
        service: null,
        timeSlots: [],
      };
    }

    const requestedTypes = tableType === "all" ? [...TABLE_TYPES] : [tableType];
    const serviceTimeSlots = buildTimeSlots(service);
    const selectedTimes = time ? serviceTimeSlots.filter((slotTime) => slotTime === time) : serviceTimeSlots;

    const timeSlots = selectedTimes.map((slotTime) => {
      const types = {};

      for (const currentTableType of requestedTypes) {
        const tableConfig = tableConfigForType(service, currentTableType);
        const capacityCovers = tableConfig.tableCount * tableConfig.tableCapacity;
        const confirmedCovers = this.reservedCovers({
          date,
          time: slotTime,
          tableType: currentTableType,
        });
        const availableTables = Math.max(tableConfig.tableCount - this.confirmedTableCount({ date, time: slotTime, tableType: currentTableType }), 0);
        const remainingCovers = availableTables * tableConfig.tableCapacity;
        const blocked = this.isBlocked({ date, time: slotTime, tableType: currentTableType });

        types[currentTableType] = {
          capacityCovers,
          confirmedCovers,
          remainingCovers,
          available: !blocked && availableTables > 0 && tableConfig.tableCapacity >= partySize,
          blocked,
        };
      }

      return {
        time: slotTime,
        types,
      };
    });

    return {
      service,
      timeSlots,
    };
  }

  createReservationAtomically({ reservation }) {
    return this.runInTransaction(() => {
      const service = this.getActiveServiceForDate(reservation.date);
      if (!service) {
        throw new ReservationError("SERVICE_CLOSED", "No active service is available for this date.", 422);
      }

      if (!buildTimeSlots(service).includes(reservation.time) || this.isBlocked({
        date: reservation.date,
        time: reservation.time,
        tableType: reservation.tableType,
      })) {
        throw new ReservationError(
          "TIME_SLOT_UNAVAILABLE",
          "The requested time slot is not available for this party and table type.",
          409,
        );
      }

      const tableConfig = tableConfigForType(service, reservation.tableType);
      const occupiedTables = this.confirmedTableCount({
        date: reservation.date,
        time: reservation.time,
        tableType: reservation.tableType,
      });
      if (tableConfig.tableCapacity < reservation.partySize || occupiedTables >= tableConfig.tableCount) {
        throw new ReservationError(
          "TIME_SLOT_UNAVAILABLE",
          "The requested time slot is not available for this party and table type.",
          409,
        );
      }

      this.db.prepare(`
        INSERT INTO reservations (
          id, first_name, last_name, phone, email, date, time, party_size, table_type, status, special_request, customer_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        reservation.id,
        reservation.firstName,
        reservation.lastName,
        reservation.phone,
        reservation.email || null,
        reservation.date,
        reservation.time,
        reservation.partySize,
        reservation.tableType,
        reservation.status,
        reservation.specialRequest,
        reservation.customerId || null,
        reservation.createdAt,
        reservation.updatedAt,
      );

      return mapReservationRow(this.db.prepare("SELECT * FROM reservations WHERE id = ?").get(reservation.id));
    });
  }

  assertReservationCanBeConfirmed(reservation) {
    const service = this.getActiveServiceForDate(reservation.date);
    if (!service || !buildTimeSlots(service).includes(reservation.time)) {
      throw new ReservationError("TIME_SLOT_UNAVAILABLE", "The requested time slot is not available for this party and table type.", 409);
    }

    const tableConfig = tableConfigForType(service, reservation.tableType);
    const availableTables = Math.max(tableConfig.tableCount - this.confirmedTableCount({
      date: reservation.date,
      time: reservation.time,
      tableType: reservation.tableType,
      excludeReservationId: reservation.id,
    }), 0);
    if (availableTables < 1 || tableConfig.tableCapacity < reservation.partySize) {
      throw new ReservationError("TIME_SLOT_UNAVAILABLE", "The requested time slot is not available for this party and table type.", 409);
    }
  }

  createAutomaticBlockedTimeSlotForReservation(reservation, createdAt) {
    const existingAutomaticBlock = this.db.prepare(`
      SELECT *
      FROM blocked_time_slots
      WHERE reservation_id = ?
        AND created_by = 'reservation_confirmation'
      LIMIT 1
    `).get(reservation.id);

    if (existingAutomaticBlock) {
      return mapBlockedTimeSlotRow(existingAutomaticBlock);
    }

    const existingBlockingSlot = this.findBlockingTimeSlot({
      date: reservation.date,
      time: reservation.time,
      tableType: reservation.tableType,
    });

    if (existingBlockingSlot) {
      if (existingBlockingSlot.createdBy === "reservation_confirmation") {
        return existingBlockingSlot;
      }
      const source = existingBlockingSlot.createdBy === "manual" ? "manually blocked" : "already blocked";
      throw new ReservationError(
        "TIME_SLOT_ALREADY_BLOCKED",
        `Time slot is ${source} for this table type.`,
        409,
      );
    }

    const blockedTimeSlot = {
      id: randomUUID(),
      date: reservation.date,
      time: reservation.time,
      tableType: reservation.tableType,
      reason: `Reservation ${reservation.id} confirmed`,
      reservationId: reservation.id,
      createdBy: "reservation_confirmation",
      createdAt,
    };

    return this.blockTimeSlot(blockedTimeSlot);
  }

  removeAutomaticBlockedTimeSlotForReservation(reservationId) {
    this.db.prepare(`
      DELETE FROM blocked_time_slots
      WHERE reservation_id = ?
        AND created_by = 'reservation_confirmation'
    `).run(reservationId);
  }

  reservedCovers({ date, time, tableType, excludeReservationId = null }) {
    const placeholders = [...CONFIRMED_STATUSES].map(() => "?").join(", ");
    const excludeClause = excludeReservationId ? "AND id <> ?" : "";
    const params = [date, time, tableType, ...CONFIRMED_STATUSES];
    if (excludeReservationId) params.push(excludeReservationId);

    const row = this.db.prepare(`
      SELECT COALESCE(SUM(party_size), 0) AS covers
      FROM reservations
      WHERE date = ?
        AND time = ?
        AND table_type = ?
        AND status IN (${placeholders})
        ${excludeClause}
    `).get(...params);
    return row.covers;
  }

  confirmedTableCount({ date, time, tableType, excludeReservationId = null }) {
    const excludeClause = excludeReservationId ? "AND id <> ?" : "";
    const params = [date, time, tableType];
    if (excludeReservationId) params.push(excludeReservationId);
    const row = this.db.prepare(`
      SELECT COUNT(*) AS count
      FROM reservations
      WHERE date = ? AND time = ? AND table_type = ? AND status = 'confirmed'
      ${excludeClause}
    `).get(...params);
    return row.count;
  }

  isBlocked({ date, time, tableType }) {
    const block = this.findBlockingTimeSlot({ date, time, tableType });
    if (!block) return false;
    if (block.createdBy !== "reservation_confirmation") return true;
    const service = this.getActiveServiceForDate(date);
    if (!service) return true;
    const tableConfig = tableConfigForType(service, tableType);
    return this.confirmedTableCount({ date, time, tableType }) >= tableConfig.tableCount;
  }

  findBlockingTimeSlot({ date, time, tableType }) {
    const row = this.db.prepare(`
      SELECT *
      FROM blocked_time_slots
      WHERE date = ?
        AND time = ?
        AND (table_type IS NULL OR table_type = ?)
      LIMIT 1
    `).get(date, time, tableType);
    return row ? mapBlockedTimeSlotRow(row) : null;
  }
}

export class ReservationSystem {
  constructor({ store, now = () => new Date() }) {
    this.store = store;
    this.now = now;
  }

  async getAvailability(query) {
    const date = validateDate(query.date, this.now());
    const partySize = validatePartySize(query.partySize);
    const tableType = validateTableType(query.tableType || "normal");
    const availability = this.store.getAvailability({ date, partySize, tableType });

    return {
      date,
      partySize,
      tableType,
      service: availability.service
        ? {
          id: availability.service.id,
          name: availability.service.name,
          normalCapacityCovers: availability.service.normalCapacityCovers,
          vipCapacityCovers: availability.service.vipCapacityCovers,
          capacityCovers: capacityForTableType(availability.service, tableType),
        }
        : null,
      timeSlots: availability.timeSlots,
    };
  }

  async getAdminAvailability(query) {
    const date = validateDate(query.date, this.now(), { allowPast: true });
    const partySize = validatePartySize(query.partySize);
    const tableType = validateAdminTableType(query.tableType || "all");
    const time = query.time ? validateTime(query.time) : null;
    const service = this.store.getActiveServiceForDate(date);

    if (service && time && !buildTimeSlots(service).includes(time)) {
      throw new ReservationError("TIME_SLOT_INVALID", "Time slot does not belong to an active service.", 422);
    }

    const availability = this.store.getAdminAvailability({ date, partySize, tableType, time });

    return {
      date,
      partySize,
      tableType,
      time,
      service: availability.service
        ? {
          id: availability.service.id,
          name: availability.service.name,
          normalCapacityCovers: availability.service.normalCapacityCovers,
          vipCapacityCovers: availability.service.vipCapacityCovers,
        }
        : null,
      timeSlots: availability.timeSlots,
    };
  }

  async listServices() {
    return { services: this.store.listServices() };
  }

  async updateService(id, input) {
    const current = this.store.getServiceById(id);
    if (!current) {
      throw new ReservationError("SERVICE_NOT_FOUND", "Service was not found.", 404);
    }

    const service = normalizeServiceUpdate(current, input);
    const updated = this.store.updateService(service);
    if (!updated) {
      throw new ReservationError("SERVICE_NOT_FOUND", "Service was not found.", 404);
    }

    return { service: updated };
  }

  async getAvailabilitySettings() {
    return { settings: this.store.getAvailabilitySettings() };
  }

  async getAvailabilitySettingsHistory() {
    return { history: this.store.listAvailabilitySettingsHistory() };
  }

  async updateAvailabilitySettings(input) {
    const current = this.store.getAvailabilitySettings();
    if (!current) throw new ReservationError("AVAILABILITY_SETTINGS_NOT_FOUND", "Availability settings were not found.", 404);
    const settings = normalizeAvailabilitySettings(current, input);
    assertScheduleChangeSafe(this.store, settings, { global: true, now: this.now() });
    return { settings: this.store.updateAvailabilitySettings({ ...settings, updatedAt: this.now().toISOString() }) };
  }

  async listAvailabilityEvents() {
    return { events: this.store.listAvailabilityEvents() };
  }

  async createAvailabilityEvent(input) {
    const event = normalizeAvailabilityEvent(input, this.now());
    if (event.active && this.store.findOverlappingAvailabilityEvent(event)) {
      throw new ReservationError("AVAILABILITY_EVENT_OVERLAP", "This event overlaps an existing active event.", 409);
    }
    assertScheduleChangeSafe(this.store, event, { dateFrom: event.dateFrom, dateTo: event.dateTo, now: this.now() });
    return { event: this.store.createAvailabilityEvent({
      ...event,
      id: randomUUID(),
      createdAt: this.now().toISOString(),
      updatedAt: this.now().toISOString(),
    }) };
  }

  async updateAvailabilityEvent(id, input) {
    const current = this.store.listAvailabilityEvents().find((event) => event.id === id);
    if (!current) throw new ReservationError("AVAILABILITY_EVENT_NOT_FOUND", "Availability event was not found.", 404);
    const event = normalizeAvailabilityEvent({ ...current, ...input }, this.now(), { allowPast: true });
    if (event.active && this.store.findOverlappingAvailabilityEvent({ ...event, id })) {
      throw new ReservationError("AVAILABILITY_EVENT_OVERLAP", "This event overlaps an existing active event.", 409);
    }
    assertScheduleChangeSafe(this.store, event, { dateFrom: event.dateFrom, dateTo: event.dateTo, now: this.now() });
    const updated = this.store.updateAvailabilityEvent({ ...event, id, updatedAt: this.now().toISOString() });
    if (!updated) throw new ReservationError("AVAILABILITY_EVENT_NOT_FOUND", "Availability event was not found.", 404);
    return { event: updated };
  }

  async deleteAvailabilityEvent(id) {
    if (!this.store.deleteAvailabilityEvent(id)) {
      throw new ReservationError("AVAILABILITY_EVENT_NOT_FOUND", "Availability event was not found.", 404);
    }
    return { removed: true };
  }

  async createReservation(input, { customerId = null } = {}) {
    const reservationInput = normalizeReservationInput(input, this.now());
    const timestamp = this.now().toISOString();
    const reservation = {
      id: randomUUID(),
      ...reservationInput,
      customerId,
      status: "requested",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const savedReservation = this.store.createReservationAtomically({
      reservation,
    });

    return { reservation: savedReservation };
  }

  async listReservations(query = {}) {
    const date = query.date ? validateDate(query.date, this.now(), { allowPast: true }) : null;
    const status = query.status ? validateReservationStatus(query.status) : null;

    return {
      reservations: this.store.listReservations({ date, status }),
    };
  }

  async listCustomerReservations(customerId) {
    return {
      reservations: this.store.listReservations({ customerId }),
    };
  }

  async updateReservationStatus(id, status) {
    const nextStatus = validateReservationStatus(status);
    const reservation = this.store.updateReservationStatus(id, nextStatus, this.now().toISOString());

    if (!reservation) {
      throw new ReservationError("RESERVATION_NOT_FOUND", "Reservation was not found.", 404);
    }

    return { reservation };
  }

  async listBlockedTimeSlots(query = {}) {
    const date = query.date ? validateDate(query.date, this.now(), { allowPast: true }) : null;

    return {
      blockedTimeSlots: this.store.listBlockedTimeSlots({ date }),
    };
  }

  async blockTimeSlot(input) {
    const date = validateDate(input.date, this.now());
    const time = validateTime(input.time);
    const tableType = input.tableType ? validateTableType(input.tableType) : null;
    const reason = normalizeText(input.reason || "");
    const service = this.store.getActiveServiceForDate(date);

    if (!service || !buildTimeSlots(service).includes(time)) {
      throw new ReservationError("TIME_SLOT_INVALID", "Time slot does not belong to an active service.", 422);
    }

    const blockedTimeSlot = {
      id: randomUUID(),
      date,
      time,
      tableType,
      reason,
      createdAt: this.now().toISOString(),
    };

    try {
      return { blockedTimeSlot: this.store.blockTimeSlot(blockedTimeSlot) };
    } catch (error) {
      if (String(error.message).includes("UNIQUE constraint failed") || String(error.message).includes("idx_blocked_time_slots_unique")) {
        throw new ReservationError("TIME_SLOT_ALREADY_BLOCKED", "Time slot is already blocked.", 409);
      }
      throw error;
    }
  }

  async unblockTimeSlot(id) {
    const removed = this.store.unblockTimeSlot(id);
    if (!removed) {
      throw new ReservationError("BLOCKED_TIME_SLOT_NOT_FOUND", "Blocked time slot was not found.", 404);
    }
    return { removed: true };
  }
}

export function normalizeReservationInput(input, now = new Date()) {
  const firstName = normalizeText(input.firstName);
  const lastName = normalizeText(input.lastName);
  const phone = normalizeText(input.phone || input.guestPhone);
  const email = normalizeText(input.email || input.guestEmail || "").toLowerCase();
  const specialRequest = normalizeText(input.specialRequest || "");
  const date = validateDate(input.date, now);
  const time = validateTime(input.time);
  const partySize = validatePartySize(input.partySize);
  const tableType = validateTableType(input.tableType);

  if (!firstName) {
    throw new ReservationError("GUEST_FIRST_NAME_REQUIRED", "Guest first name is required.", 400);
  }
  if (!lastName) {
    throw new ReservationError("GUEST_LAST_NAME_REQUIRED", "Guest last name is required.", 400);
  }
  if (!/^[+()\d\s.-]{7,24}$/.test(phone)) {
    throw new ReservationError("GUEST_PHONE_INVALID", "Guest phone is invalid.", 400);
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ReservationError("GUEST_EMAIL_INVALID", "Guest email is invalid.", 400);
  }
  if (specialRequest.length > 500) {
    throw new ReservationError("SPECIAL_REQUEST_TOO_LONG", "Special request is too long.", 400);
  }

  return {
    firstName,
    lastName,
    phone,
    email,
    date,
    time,
    partySize,
    tableType,
    specialRequest,
  };
}

export function validateDate(value, now = new Date(), options = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    throw new ReservationError("DATE_INVALID", "Date must use YYYY-MM-DD.", 400);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ReservationError("DATE_INVALID", "Date must be a real calendar date.", 400);
  }

  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  if (!options.allowPast && date < today) {
    throw new ReservationError("DATE_IN_PAST", "Reservations cannot be made in the past.", 400);
  }

  return value;
}

export function validatePartySize(value) {
  const partySize = Number(value);
  if (!Number.isInteger(partySize) || partySize < 1) {
    throw new ReservationError("PARTY_SIZE_INVALID", "Party size must be a positive integer.", 400);
  }
  if (partySize > MAX_PARTY_SIZE) {
    throw new ReservationError(
      "PARTY_SIZE_TOO_LARGE",
      `Party size cannot exceed ${MAX_PARTY_SIZE}.`,
      400,
      { maxPartySize: MAX_PARTY_SIZE },
    );
  }
  return partySize;
}

export function validateTime(value) {
  if (!/^\d{2}:\d{2}$/.test(String(value))) {
    throw new ReservationError("TIME_INVALID", "Time must use HH:mm.", 400);
  }
  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) {
    throw new ReservationError("TIME_INVALID", "Time must be a real time.", 400);
  }
  return value;
}

export function validateReservationStatus(value) {
  if (!RESERVATION_STATUSES.has(String(value))) {
    throw new ReservationError("RESERVATION_STATUS_INVALID", "Reservation status is invalid.", 400);
  }
  return String(value);
}

export function validateTableType(value) {
  if (!TABLE_TYPES.has(String(value))) {
    throw new ReservationError("TABLE_TYPE_INVALID", "Table type must be normal or vip.", 400);
  }
  return String(value);
}

export function validateAdminTableType(value) {
  if (String(value) === "all") return "all";
  return validateTableType(value);
}

function assertScheduleChangeSafe(store, schedule, { global = false, dateFrom = null, dateTo = null, now = new Date() } = {}) {
  if (!schedule.active) return;

  const today = now.toISOString().slice(0, 10);
  const confirmed = store.listReservations({ status: "confirmed" });
  const conflicts = [];
  const occupiedTables = new Map();

  for (const reservation of confirmed) {
    if (reservation.date < today) continue;
    if (global) {
      const weekday = new Date(`${reservation.date}T00:00:00.000Z`).getUTCDay();
      if (!schedule.activeDays.includes(weekday)) {
        conflicts.push({ id: reservation.id, date: reservation.date, time: reservation.time, reasons: ["jour fermé"] });
        continue;
      }
      const existingEvent = store.getActiveServiceForDate(reservation.date);
      if (existingEvent?.dateFrom) continue;
    } else if (reservation.date < dateFrom || reservation.date > dateTo) {
      continue;
    }

    const tableConfig = tableConfigForType(schedule, reservation.tableType);
    const reasons = [];
    if (!buildTimeSlots(schedule).includes(reservation.time)) reasons.push("horaire");
    if (reservation.partySize > tableConfig.tableCapacity) reasons.push("capacité");
    const key = `${reservation.date}|${reservation.time}|${reservation.tableType}`;
    const count = (occupiedTables.get(key) || 0) + 1;
    occupiedTables.set(key, count);
    if (count > tableConfig.tableCount) reasons.push("tables disponibles");
    if (reasons.length) conflicts.push({ id: reservation.id, date: reservation.date, time: reservation.time, reasons });
  }

  if (conflicts.length) {
    throw new ReservationError(
      "AVAILABILITY_CHANGE_CONFLICT",
      "The schedule change conflicts with confirmed reservations.",
      409,
      { reservations: conflicts.slice(0, 10) },
    );
  }
}

function normalizeServiceUpdate(current, input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ReservationError("SERVICE_UPDATE_INVALID", "Service settings must be a JSON object.", 400);
  }

  const name = input.name === undefined ? current.name : normalizeText(input.name);
  if (!name || name.length > 80) {
    throw new ReservationError("SERVICE_NAME_INVALID", "Service name must contain between 1 and 80 characters.", 400);
  }

  const startTime = input.startTime === undefined ? current.startTime : validateTime(input.startTime);
  const endTime = input.endTime === undefined ? current.endTime : validateTime(input.endTime);
  if (minutesFromTime(endTime) <= minutesFromTime(startTime)) {
    throw new ReservationError("SERVICE_HOURS_INVALID", "Service end time must be after its start time.", 400);
  }

  const interval = input.slotIntervalMinutes === undefined
    ? current.slotIntervalMinutes
    : Number(input.slotIntervalMinutes);
  if (!Number.isInteger(interval) || interval < 5 || interval > 240) {
    throw new ReservationError("SERVICE_INTERVAL_INVALID", "Slot interval must be an integer between 5 and 240 minutes.", 400);
  }

  const normalTableCount = input.normalTableCount === undefined ? current.normalTableCount : Number(input.normalTableCount);
  const normalTableCapacity = input.normalTableCapacity === undefined ? current.normalTableCapacity : Number(input.normalTableCapacity);
  const vipTableCount = input.vipTableCount === undefined ? current.vipTableCount : Number(input.vipTableCount);
  const vipTableCapacity = input.vipTableCapacity === undefined ? current.vipTableCapacity : Number(input.vipTableCapacity);
  for (const [label, value] of [
    ["Normal table count", normalTableCount],
    ["Normal table capacity", normalTableCapacity],
    ["VIP table count", vipTableCount],
    ["VIP table capacity", vipTableCapacity],
  ]) {
    if (!Number.isInteger(value) || value < 0 || value > 500) {
      throw new ReservationError("SERVICE_TABLE_CONFIG_INVALID", `${label} must be an integer between 0 and 500.`, 400);
    }
  }
  if (normalTableCapacity < 1 || vipTableCapacity < 1) {
    throw new ReservationError("SERVICE_TABLE_CONFIG_INVALID", "Each configured table must have at least one place.", 400);
  }

  const normalCapacityCovers = normalTableCount * normalTableCapacity;
  const vipCapacityCovers = vipTableCount * vipTableCapacity;

  const active = input.active === undefined ? current.active : input.active;
  if (typeof active !== "boolean") {
    throw new ReservationError("SERVICE_ACTIVE_INVALID", "Service active state must be boolean.", 400);
  }
  if (active && normalCapacityCovers === 0 && vipCapacityCovers === 0) {
    throw new ReservationError("SERVICE_CAPACITY_INVALID", "An active service must have capacity for at least one table type.", 400);
  }

  return {
    ...current,
    name,
    startTime,
    endTime,
    slotIntervalMinutes: interval,
    normalTableCount,
    normalTableCapacity,
    vipTableCount,
    vipTableCapacity,
    normalCapacityCovers,
    vipCapacityCovers,
    active,
  };
}

function normalizeAvailabilitySettings(current, input = {}) {
  const next = normalizeScheduleFields(current, input);
  const activeDays = input.activeDays === undefined ? current.activeDays : input.activeDays;
  if (!Array.isArray(activeDays) || activeDays.some((day) => !Number.isInteger(Number(day)) || Number(day) < 0 || Number(day) > 6)) {
    throw new ReservationError("ACTIVE_DAYS_INVALID", "Active days must contain weekday numbers from 0 to 6.", 400);
  }
  const name = input.name === undefined ? current.name : normalizeText(input.name);
  if (!name || name.length > 100) {
    throw new ReservationError("AVAILABILITY_NAME_INVALID", "Availability name must contain between 1 and 100 characters.", 400);
  }
  return { ...current, ...next, name, activeDays: [...new Set(activeDays.map(Number))].sort((a, b) => a - b) };
}

function normalizeAvailabilityEvent(input = {}, now = new Date(), options = {}) {
  const name = normalizeText(input.name);
  if (!name || name.length > 100) {
    throw new ReservationError("AVAILABILITY_EVENT_NAME_INVALID", "Event name must contain between 1 and 100 characters.", 400);
  }
  const dateFrom = validateDate(input.dateFrom, now, { allowPast: options.allowPast === true });
  const dateTo = validateDate(input.dateTo || input.dateFrom, now, { allowPast: options.allowPast === true });
  if (dateTo < dateFrom) {
    throw new ReservationError("AVAILABILITY_EVENT_DATES_INVALID", "Event end date must be on or after its start date.", 400);
  }
  return {
    ...normalizeScheduleFields({}, input),
    name,
    dateFrom,
    dateTo,
    active: input.active === undefined ? true : input.active,
  };
}

function normalizeScheduleFields(current = {}, input = {}) {
  const startTime = input.startTime === undefined ? current.startTime : validateTime(input.startTime);
  const endTime = input.endTime === undefined ? current.endTime : validateTime(input.endTime);
  if (minutesFromTime(endTime) <= minutesFromTime(startTime)) {
    throw new ReservationError("SERVICE_HOURS_INVALID", "Service end time must be after its start time.", 400);
  }

  const slotIntervalMinutes = input.slotIntervalMinutes === undefined ? current.slotIntervalMinutes : Number(input.slotIntervalMinutes);
  if (!Number.isInteger(slotIntervalMinutes) || slotIntervalMinutes < 5 || slotIntervalMinutes > 240) {
    throw new ReservationError("SERVICE_INTERVAL_INVALID", "Slot interval must be an integer between 5 and 240 minutes.", 400);
  }

  const values = {
    normalTableCount: input.normalTableCount === undefined ? current.normalTableCount : Number(input.normalTableCount),
    normalTableCapacity: input.normalTableCapacity === undefined ? current.normalTableCapacity : Number(input.normalTableCapacity),
    vipTableCount: input.vipTableCount === undefined ? current.vipTableCount : Number(input.vipTableCount),
    vipTableCapacity: input.vipTableCapacity === undefined ? current.vipTableCapacity : Number(input.vipTableCapacity),
  };
  for (const [label, value] of Object.entries(values)) {
    const minimum = label.endsWith("Capacity") ? 1 : 0;
    if (!Number.isInteger(value) || value < minimum || value > 500) {
      throw new ReservationError("SERVICE_TABLE_CONFIG_INVALID", `${label} must be an integer between ${minimum} and 500.`, 400);
    }
  }

  const active = input.active === undefined ? (current.active ?? true) : input.active;
  if (typeof active !== "boolean") {
    throw new ReservationError("SERVICE_ACTIVE_INVALID", "Service active state must be boolean.", 400);
  }
  if (active && values.normalTableCount * values.normalTableCapacity + values.vipTableCount * values.vipTableCapacity === 0) {
    throw new ReservationError("SERVICE_CAPACITY_INVALID", "An active service must have capacity for at least one table type.", 400);
  }

  return {
    startTime,
    endTime,
    slotIntervalMinutes,
    ...values,
    normalCapacityCovers: values.normalTableCount * values.normalTableCapacity,
    vipCapacityCovers: values.vipTableCount * values.vipTableCapacity,
    active,
  };
}

export function buildTimeSlots(service) {
  const start = minutesFromTime(service.startTime);
  const end = minutesFromTime(service.endTime);
  const slots = [];

  for (let minutes = start; minutes <= end; minutes += service.slotIntervalMinutes) {
    slots.push(timeFromMinutes(minutes));
  }

  return slots;
}

function mapServiceRow(row) {
  return {
    id: row.id,
    name: row.name,
    weekday: row.weekday,
    startTime: row.start_time,
    endTime: row.end_time,
    slotIntervalMinutes: row.slot_interval_minutes,
    normalTableCount: row.normal_table_count,
    normalTableCapacity: row.normal_table_capacity,
    vipTableCount: row.vip_table_count,
    vipTableCapacity: row.vip_table_capacity,
    normalCapacityCovers: row.normal_capacity_covers,
    vipCapacityCovers: row.vip_capacity_covers,
    active: Boolean(row.active),
  };
}

function mapRestaurantTableRow(row) {
  return {
    id: row.id,
    label: row.label,
    tableType: row.table_type,
    capacity: row.capacity,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to || null,
    active: Boolean(row.active),
  };
}

function mapAvailabilitySettingsRow(row) {
  let activeDays = [];
  try {
    activeDays = JSON.parse(row.active_days);
  } catch {
    activeDays = [];
  }
  return {
    id: row.id,
    name: row.name,
    activeDays: Array.isArray(activeDays) ? activeDays : [],
    startTime: row.start_time,
    endTime: row.end_time,
    slotIntervalMinutes: row.slot_interval_minutes,
    normalTableCount: row.normal_table_count,
    normalTableCapacity: row.normal_table_capacity,
    vipTableCount: row.vip_table_count,
    vipTableCapacity: row.vip_table_capacity,
    normalCapacityCovers: row.normal_table_count * row.normal_table_capacity,
    vipCapacityCovers: row.vip_table_count * row.vip_table_capacity,
    active: Boolean(row.active),
    updatedAt: row.updated_at,
  };
}

function mapAvailabilityEventRow(row, weekday = null) {
  return {
    id: row.id,
    name: row.name,
    dateFrom: row.date_from,
    dateTo: row.date_to,
    weekday,
    startTime: row.start_time,
    endTime: row.end_time,
    slotIntervalMinutes: row.slot_interval_minutes,
    normalTableCount: row.normal_table_count,
    normalTableCapacity: row.normal_table_capacity,
    vipTableCount: row.vip_table_count,
    vipTableCapacity: row.vip_table_capacity,
    normalCapacityCovers: row.normal_table_count * row.normal_table_capacity,
    vipCapacityCovers: row.vip_table_count * row.vip_table_capacity,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReservationRow(row) {
  const firstName = row.first_name;
  const lastName = row.last_name;
  const phone = row.phone;
  const email = row.email || "";
  const guestName = `${firstName} ${lastName}`.trim();

  return {
    id: row.id,
    firstName,
    lastName,
    guestName,
    phone,
    guestPhone: phone,
    email,
    guestEmail: email,
    date: row.date,
    time: row.time,
    partySize: row.party_size,
    tableType: row.table_type,
    status: row.status,
    specialRequest: row.special_request,
    customerId: row.customer_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBlockedTimeSlotRow(row) {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    tableType: row.table_type,
    reason: row.reason,
    reservationId: row.reservation_id || null,
    createdBy: row.created_by || "manual",
    createdAt: row.created_at,
  };
}

function capacityForTableType(service, tableType) {
  return tableType === "vip" ? service.vipCapacityCovers : service.normalCapacityCovers;
}

function tableConfigForType(service, tableType) {
  return tableType === "vip"
    ? { tableCount: service.vipTableCount, tableCapacity: service.vipTableCapacity }
    : { tableCount: service.normalTableCount, tableCapacity: service.normalTableCapacity };
}

function normalizeLegacyState(value) {
  if (Array.isArray(value)) {
    return {
      reservations: value,
      blockedTimeSlots: [],
    };
  }

  return {
    reservations: Array.isArray(value?.reservations) ? value.reservations : [],
    blockedTimeSlots: Array.isArray(value?.blockedTimeSlots) ? value.blockedTimeSlots : [],
  };
}

function normalizeLegacyReservation(reservation) {
  const guestName = normalizeText(reservation.guestName);
  const [firstName = "Guest", ...rest] = guestName.split(" ");
  const lastName = rest.length ? rest.join(" ") : "Galatee";

  return {
    id: reservation.id || randomUUID(),
    firstName: reservation.firstName || firstName,
    lastName: reservation.lastName || lastName,
    phone: reservation.phone || reservation.guestPhone || "0000000000",
    email: reservation.email || reservation.guestEmail || "",
    date: reservation.date,
    time: reservation.time,
    partySize: reservation.partySize,
    tableType: TABLE_TYPES.has(reservation.tableType) ? reservation.tableType : "normal",
    status: RESERVATION_STATUSES.has(reservation.status) ? reservation.status : "confirmed",
    specialRequest: reservation.specialRequest || "",
    createdAt: reservation.createdAt || new Date().toISOString(),
    updatedAt: reservation.updatedAt || reservation.createdAt || new Date().toISOString(),
  };
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function minutesFromTime(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function timeFromMinutes(value) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function previousISODate(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
