import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AnalyticsSystem } from "./analyticsSystem.js";
import { MenuSystem } from "./menuSystem.js";
import { SqliteReservationStore } from "./reservationSystem.js";

const SERVICE_WEEKDAYS = new Set([3, 4, 5, 6]);
const DEMO_RESERVATION_PREFIX = "demo-reservation-";
const DEMO_DATA_PREFIX = "demo-";

export function seedDemoData({
  databasePath = ":memory:",
  legacyJsonPath = null,
  uploadRoot = null,
  now = new Date(),
  resetOnly = false,
} = {}) {
  const store = new SqliteReservationStore({ databasePath, legacyJsonPath });
  const menu = new MenuSystem({
    db: store.db,
    uploadRoot: uploadRoot || join(process.cwd(), "backend", "data", "uploads", "menu"),
    now: () => new Date(now),
  });
  const analytics = new AnalyticsSystem({ db: store.db, now: () => new Date(now) });

  try {
    clearDemoData(store.db);
    if (resetOnly) {
      return buildSummary(store.db, { resetOnly: true, menuItems: menu.listPublished().length });
    }

    const dates = getDemoDates(now);
    const timestamp = new Date(now).toISOString();
    const reservations = buildReservations(dates, timestamp);
    const revenues = buildRevenues(dates.recent, timestamp);
    const events = buildEvents(dates.recent);

    store.runInTransaction(() => {
      for (const reservation of reservations) insertReservation(store.db, reservation);
      insertManualBlock(store.db, dates.upcoming[2], timestamp);
      for (const revenue of revenues) insertRevenue(store.db, revenue);
      for (const event of events) insertEvent(store.db, event);
    });

    // Confirmed demo reservations must behave exactly like real admin confirmations.
    store.backfillAutomaticBlockedTimeSlots();

    return buildSummary(store.db, {
      dates,
      menuItems: menu.listPublished().length,
      resetOnly: false,
    });
  } finally {
    store.close();
  }
}

export function getDemoDates(now = new Date()) {
  const base = startOfDay(new Date(now));
  const upcoming = collectServiceDates(base, 1, 60, 4);
  const recent = collectServiceDates(base, -1, 60, 6);
  return { recent, upcoming };
}

function collectServiceDates(base, direction, maxDays, count) {
  const dates = [];
  for (let offset = direction > 0 ? 0 : -1; Math.abs(offset) <= maxDays && dates.length < count; offset += direction) {
    const candidate = new Date(base);
    candidate.setUTCDate(candidate.getUTCDate() + offset);
    if (SERVICE_WEEKDAYS.has(candidate.getUTCDay())) dates.push(formatDate(candidate));
  }
  return dates;
}

function buildReservations(dates, timestamp) {
  return [
    reservation({
      key: `requested-${dates.upcoming[0]}`,
      firstName: "Nadia",
      lastName: "Bensaid",
      phone: "+213555010101",
      email: "nadia.bensaid@example.com",
      date: dates.upcoming[0],
      time: "19:00",
      partySize: 2,
      tableType: "normal",
      status: "requested",
      specialRequest: "Une table calme, si possible.",
      timestamp,
    }),
    reservation({
      key: `confirmed-vip-${dates.upcoming[0]}`,
      firstName: "Karim",
      lastName: "Mansouri",
      phone: "+213555010102",
      email: "karim.mansouri@example.com",
      date: dates.upcoming[0],
      time: "19:30",
      partySize: 4,
      tableType: "vip",
      status: "confirmed",
      specialRequest: "Anniversaire, prévoir une attention discrète.",
      timestamp,
    }),
    reservation({
      key: `confirmed-normal-${dates.upcoming[1]}`,
      firstName: "Sonia",
      lastName: "Cherif",
      phone: "+213555010103",
      email: "sonia.cherif@example.com",
      date: dates.upcoming[1],
      time: "20:00",
      partySize: 3,
      tableType: "normal",
      status: "confirmed",
      specialRequest: "",
      timestamp,
    }),
    reservation({
      key: `cancelled-${dates.recent[1]}`,
      firstName: "Mehdi",
      lastName: "Saidi",
      phone: "+213555010104",
      email: "mehdi.saidi@example.com",
      date: dates.recent[1],
      time: "20:30",
      partySize: 2,
      tableType: "normal",
      status: "cancelled",
      specialRequest: "",
      timestamp,
    }),
    reservation({
      key: `completed-${dates.recent[0]}`,
      firstName: "Amel",
      lastName: "Kaci",
      phone: "+213555010105",
      email: "amel.kaci@example.com",
      date: dates.recent[0],
      time: "19:00",
      partySize: 2,
      tableType: "vip",
      status: "completed",
      specialRequest: "",
      timestamp,
    }),
  ];
}

function reservation({ key, firstName, lastName, phone, email, date, time, partySize, tableType, status, specialRequest, timestamp }) {
  return {
    id: `${DEMO_RESERVATION_PREFIX}${key}`,
    firstName,
    lastName,
    phone,
    email,
    date,
    time,
    partySize,
    tableType,
    status,
    specialRequest,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildRevenues(recentDates, timestamp) {
  const amounts = [48600, 72800, 59400, 84600, 66700, 91200];
  return recentDates.map((date, index) => ({
    id: `demo-revenue-${date}`,
    date,
    amountCents: amounts[index],
    note: "Service de demonstration",
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

function buildEvents(recentDates) {
  return recentDates.flatMap((date, index) => {
    const sessionId = `demo-session-${String(index + 1).padStart(2, "0")}`;
    const at = `${date}T20:00:00.000Z`;
    return [
      { id: `demo-event-${date}-menu`, eventName: "menu_viewed", sessionId, pagePath: "/menu", occurredAt: at },
      { id: `demo-event-${date}-cta`, eventName: "reservation_cta_clicked", sessionId, pagePath: "/", occurredAt: at },
      { id: `demo-event-${date}-started`, eventName: "reservation_started", sessionId, pagePath: "/reservation", occurredAt: at },
      { id: `demo-event-${date}-submitted`, eventName: "reservation_submitted", sessionId, pagePath: "/reservation", occurredAt: at },
    ];
  });
}

function insertReservation(db, reservation) {
  db.prepare(`
    INSERT INTO reservations (
      id, first_name, last_name, phone, email, date, time, party_size, table_type, status, special_request, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    reservation.id,
    reservation.firstName,
    reservation.lastName,
    reservation.phone,
    reservation.email,
    reservation.date,
    reservation.time,
    reservation.partySize,
    reservation.tableType,
    reservation.status,
    reservation.specialRequest,
    reservation.createdAt,
    reservation.updatedAt,
  );
}

function insertManualBlock(db, date, timestamp) {
  db.prepare(`
    INSERT INTO blocked_time_slots (id, date, time, table_type, reason, reservation_id, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `demo-block-${date}`,
    date,
    "21:00",
    null,
    "Diner prive - demonstration",
    null,
    "manual",
    timestamp,
  );
}

function insertRevenue(db, revenue) {
  db.prepare(`
    INSERT INTO daily_revenues (id, date, amount_cents, currency, note, created_at, updated_at)
    VALUES (?, ?, ?, 'DZD', ?, ?, ?)
    ON CONFLICT(date) DO NOTHING
  `).run(revenue.id, revenue.date, revenue.amountCents, revenue.note, revenue.createdAt, revenue.updatedAt);
}

function insertEvent(db, event) {
  db.prepare(`
    INSERT INTO analytics_events (id, event_name, session_id, page_path, occurred_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(event.id, event.eventName, event.sessionId, event.pagePath, event.occurredAt);
}

function clearDemoData(db) {
  db.prepare(`
    DELETE FROM blocked_time_slots
    WHERE id LIKE ?
       OR reservation_id IN (SELECT id FROM reservations WHERE id LIKE ?)
  `).run(`${DEMO_DATA_PREFIX}%`, `${DEMO_RESERVATION_PREFIX}%`);
  db.prepare("DELETE FROM reservations WHERE id LIKE ?").run(`${DEMO_RESERVATION_PREFIX}%`);
  db.prepare("DELETE FROM daily_revenues WHERE id LIKE ?").run(`${DEMO_DATA_PREFIX}%`);
  db.prepare("DELETE FROM analytics_events WHERE id LIKE ?").run(`${DEMO_DATA_PREFIX}%`);
}

function buildSummary(db, { dates = null, menuItems, resetOnly }) {
  return {
    mode: resetOnly ? "reset" : "seeded",
    menuItems,
    demoReservations: Number(db.prepare("SELECT COUNT(*) AS count FROM reservations WHERE id LIKE ?").get(`${DEMO_RESERVATION_PREFIX}%`).count),
    demoBlockedTimeSlots: Number(db.prepare("SELECT COUNT(*) AS count FROM blocked_time_slots WHERE id LIKE ? OR reservation_id LIKE ?").get(`${DEMO_DATA_PREFIX}%`, `${DEMO_RESERVATION_PREFIX}%`).count),
    demoRevenueEntries: Number(db.prepare("SELECT COUNT(*) AS count FROM daily_revenues WHERE id LIKE ?").get(`${DEMO_DATA_PREFIX}%`).count),
    demoAnalyticsEvents: Number(db.prepare("SELECT COUNT(*) AS count FROM analytics_events WHERE id LIKE ?").get(`${DEMO_DATA_PREFIX}%`).count),
    ...(dates ? { dates } : {}),
  };
}

function startOfDay(date) {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rootDir = join(fileURLToPath(new URL(".", import.meta.url)), "..");
  const result = seedDemoData({
    databasePath: join(rootDir, "backend", "data", "galatee.sqlite"),
    legacyJsonPath: join(rootDir, "backend", "data", "reservations.json"),
    uploadRoot: join(rootDir, "backend", "data", "uploads", "menu"),
    resetOnly: process.argv.includes("--reset"),
  });
  console.log(JSON.stringify(result, null, 2));
}
