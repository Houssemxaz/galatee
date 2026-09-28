import { randomUUID } from "node:crypto";

const EVENT_NAMES = new Set([
  "page_viewed",
  "menu_viewed",
  "dish_viewed",
  "order_cta_clicked",
  "order_started",
  "order_submitted",
]);
const GROUP_BYS = new Set(["day", "week", "month", "year"]);
const CONFIRMED_ORDER_STATUSES = ["confirmed", "preparing", "ready", "delivered", "withdrawn", "completed"];

export class AnalyticsError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = "AnalyticsError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class AnalyticsSystem {
  constructor({ db, now = () => new Date(), currency = "DZD" } = {}) {
    if (!db) throw new Error("AnalyticsSystem requires a SQLite database.");
    this.db = db;
    this.now = now;
    this.currency = currency;
    this.initializeSchema();
  }

  initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS daily_revenues (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL UNIQUE,
        amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
        currency TEXT NOT NULL DEFAULT 'DZD',
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY,
        event_name TEXT NOT NULL,
        session_id TEXT,
        page_path TEXT NOT NULL DEFAULT '',
        occurred_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_daily_revenues_date ON daily_revenues (date);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_date_name ON analytics_events (occurred_at, event_name);
    `);
  }

  recordEvent(input) {
    const eventName = String(input?.eventName || "");
    if (!EVENT_NAMES.has(eventName)) {
      throw new AnalyticsError("ANALYTICS_EVENT_INVALID", "Analytics event is not allowed.", 400);
    }
    const sessionId = input?.sessionId == null ? null : String(input.sessionId);
    if (sessionId && !/^[A-Za-z0-9_-]{16,96}$/.test(sessionId)) {
      throw new AnalyticsError("ANALYTICS_SESSION_INVALID", "Analytics session identifier is invalid.", 400);
    }
    const pagePath = String(input?.pagePath || "").trim();
    if (pagePath.length > 160 || /[\u0000-\u001f]/.test(pagePath)) {
      throw new AnalyticsError("ANALYTICS_PAGE_INVALID", "Analytics page path is invalid.", 400);
    }
    const occurredAt = this.now().toISOString();
    this.db.prepare(`
      INSERT INTO analytics_events (id, event_name, session_id, page_path, occurred_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(randomUUID(), eventName, sessionId, pagePath, occurredAt);
    return { accepted: true };
  }

  upsertRevenue(input) {
    const date = validateDate(input?.date);
    const amountCents = normalizeAmount(input?.amountCents ?? input?.amount);
    const note = String(input?.note || "").trim();
    if (note.length > 500) throw new AnalyticsError("REVENUE_NOTE_TOO_LONG", "Revenue note is too long.", 400);
    const timestamp = this.now().toISOString();
    this.db.prepare(`
      INSERT INTO daily_revenues (id, date, amount_cents, currency, note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        amount_cents = excluded.amount_cents,
        currency = excluded.currency,
        note = excluded.note,
        updated_at = excluded.updated_at
    `).run(randomUUID(), date, amountCents, this.currency, note, timestamp, timestamp);
    return this.getRevenueEntry(date);
  }

  getRevenueEntry(date) {
    const normalizedDate = validateDate(date);
    const row = this.db.prepare("SELECT * FROM daily_revenues WHERE date = ?").get(normalizedDate);
    return row ? mapRevenueRow(row) : null;
  }

  listRevenue({ from, to } = {}) {
    const range = normalizeRange(from, to);
    return this.db.prepare("SELECT * FROM daily_revenues WHERE date BETWEEN ? AND ? ORDER BY date")
      .all(range.from, range.to).map(mapRevenueRow);
  }

  deleteRevenue(date) {
    const normalizedDate = validateDate(date);
    const result = this.db.prepare("DELETE FROM daily_revenues WHERE date = ?").run(normalizedDate);
    if (!result.changes) throw new AnalyticsError("REVENUE_NOT_FOUND", "Revenue entry was not found.", 404);
    return { removed: true };
  }

  getDashboard({ from, to, groupBy = "day" } = {}) {
    if (!GROUP_BYS.has(groupBy)) throw new AnalyticsError("ANALYTICS_GROUP_INVALID", "Analytics grouping is invalid.", 400);
    const range = normalizeRange(from, to);
    const current = this.queryRange(range, groupBy);
    const dayCount = daysBetween(range.from, range.to) + 1;
    const previousTo = shiftDate(range.from, -1);
    const previousFrom = shiftDate(previousTo, -(dayCount - 1));
    const previous = this.queryRange({ from: previousFrom, to: previousTo }, groupBy);

    return {
      currency: this.currency,
      from: range.from,
      to: range.to,
      groupBy,
      totals: current.totals,
      series: current.series,
      previousPeriod: {
        from: previousFrom,
        to: previousTo,
        totals: previous.totals,
      },
    };
  }

  getSiteStats({ from, to, groupBy = "day" } = {}) {
    if (!GROUP_BYS.has(groupBy)) throw new AnalyticsError("ANALYTICS_GROUP_INVALID", "Analytics grouping is invalid.", 400);
    const range = normalizeRange(from, to);
    const current = this.queryRange(range, groupBy);
    const orders = this.queryOrderAnalytics(range, groupBy);
    const traffic = this.queryTraffic(range, groupBy);
    const events = current.totals.events;
    const seriesPeriods = new Set([
      ...current.series.map((point) => point.period),
      ...traffic.series.map((point) => point.period),
      ...orders.series.map((point) => point.period),
    ]);
    const series = [...seriesPeriods].sort().map((period) => {
      const currentPoint = current.series.find((point) => point.period === period);
      const trafficPoint = traffic.series.find((point) => point.period === period);
      const orderPoint = orders.series.find((point) => point.period === period);
      const emptyCurrent = { events: { pageViewed: 0, menuViewed: 0, dishViewed: 0, orderCtaClicked: 0, orderStarted: 0, orderSubmitted: 0 } };
      return {
        period,
        menuViews: currentPoint?.events.menuViewed || 0,
        siteViews: trafficPoint?.pageViews || 0,
        uniqueVisitors: trafficPoint?.uniqueVisitors || 0,
        orders: orderPoint?.orders || { received: 0, confirmed: 0, cancelled: 0, revenueCents: 0, revenue: "0.00" },
        revenueCents: orderPoint?.orders.revenueCents || 0,
        events: currentPoint?.events || emptyCurrent.events,
      };
    });

    return {
      from: range.from,
      to: range.to,
      groupBy,
      totals: {
        menuViews: events.menuViewed,
        siteViews: traffic.totals.pageViews,
        uniqueVisitors: traffic.totals.uniqueVisitors,
        traffic: traffic.totals,
        orders: orders.totals,
        events: {
          pageViewed: events.pageViewed,
          menuViewed: events.menuViewed,
          dishViewed: events.dishViewed,
          orderCtaClicked: events.orderCtaClicked,
          orderStarted: events.orderStarted,
          orderSubmitted: events.orderSubmitted,
        },
      },
      series,
      products: orders.products,
      busiestSlots: this.queryBusiestSlots(range),
    };
  }

  queryRange(range, groupBy) {
    const periodExpression = periodSqlForColumn(groupBy, "date");
    const revenueRows = this.db.prepare(`
      SELECT ${periodExpression} AS period, COALESCE(SUM(amount_cents), 0) AS revenue_cents
      FROM daily_revenues
      WHERE date BETWEEN ? AND ?
      GROUP BY period
    `).all(range.from, range.to);
    const eventRows = this.db.prepare(`
      SELECT ${periodSqlForEvent(groupBy)} AS period, event_name, COUNT(*) AS count
      FROM analytics_events
      WHERE substr(occurred_at, 1, 10) BETWEEN ? AND ?
      GROUP BY period, event_name
    `).all(range.from, range.to);

    const periods = new Set();
    const series = new Map();
    const ensure = (period) => {
      periods.add(period);
      if (!series.has(period)) {
        series.set(period, {
          period,
          revenueCents: 0,
          revenue: "0.00",
          events: { pageViewed: 0, menuViewed: 0, dishViewed: 0, orderCtaClicked: 0, orderStarted: 0, orderSubmitted: 0 },
        });
      }
      return series.get(period);
    };

    for (const row of revenueRows) {
      const point = ensure(row.period);
      point.revenueCents = Number(row.revenue_cents);
      point.revenue = formatAmount(point.revenueCents);
    }
    for (const row of eventRows) {
      const point = ensure(row.period);
      const key = {
        page_viewed: "pageViewed",
        menu_viewed: "menuViewed",
        dish_viewed: "dishViewed",
        order_cta_clicked: "orderCtaClicked",
        order_started: "orderStarted",
        order_submitted: "orderSubmitted",
      }[row.event_name];
      if (key) point.events[key] = Number(row.count);
    }

    const sortedSeries = [...periods].sort().map((period) => series.get(period));
    const totals = {
      revenueCents: sortedSeries.reduce((sum, point) => sum + point.revenueCents, 0),
      revenue: formatAmount(sortedSeries.reduce((sum, point) => sum + point.revenueCents, 0)),
      events: {
        pageViewed: sortedSeries.reduce((sum, point) => sum + point.events.pageViewed, 0),
        menuViewed: sortedSeries.reduce((sum, point) => sum + point.events.menuViewed, 0),
        dishViewed: sortedSeries.reduce((sum, point) => sum + point.events.dishViewed, 0),
        orderCtaClicked: sortedSeries.reduce((sum, point) => sum + point.events.orderCtaClicked, 0),
        orderStarted: sortedSeries.reduce((sum, point) => sum + point.events.orderStarted, 0),
        orderSubmitted: sortedSeries.reduce((sum, point) => sum + point.events.orderSubmitted, 0),
      },
    };
    return { totals, series: sortedSeries };
  }

  queryOrderAnalytics(range, groupBy) {
    const orderDate = "substr(created_at, 1, 10)";
    const periodExpression = periodSqlForColumn(groupBy, orderDate);
    const rows = this.db.prepare(`
      SELECT ${periodExpression} AS period, status, COUNT(*) AS count,
        COALESCE(SUM(total_cents), 0) AS revenue_cents
      FROM orders
      WHERE ${orderDate} BETWEEN ? AND ?
      GROUP BY period, status
    `).all(range.from, range.to);
    const periods = new Set();
    const series = new Map();
    const ensure = (period) => {
      periods.add(period);
      if (!series.has(period)) series.set(period, { period, orders: { received: 0, confirmed: 0, cancelled: 0, revenueCents: 0, revenue: "0.00" } });
      return series.get(period);
    };
    for (const row of rows) {
      const point = ensure(row.period);
      const count = Number(row.count);
      point.orders.received += count;
      if (row.status === "cancelled") point.orders.cancelled += count;
      if (CONFIRMED_ORDER_STATUSES.includes(row.status)) {
        point.orders.confirmed += count;
        point.orders.revenueCents += Number(row.revenue_cents);
      }
    }
    const seriesRows = [...periods].sort().map((period) => {
      const point = series.get(period);
      point.orders.revenue = formatAmount(point.orders.revenueCents);
      return point;
    });
    const products = this.queryProductPerformance(range);
    const totals = {
      received: seriesRows.reduce((sum, point) => sum + point.orders.received, 0),
      confirmed: seriesRows.reduce((sum, point) => sum + point.orders.confirmed, 0),
      cancelled: seriesRows.reduce((sum, point) => sum + point.orders.cancelled, 0),
      revenueCents: seriesRows.reduce((sum, point) => sum + point.orders.revenueCents, 0),
    };
    totals.revenue = formatAmount(totals.revenueCents);
    totals.confirmationRate = totals.received ? Number(((totals.confirmed / totals.received) * 100).toFixed(1)) : 0;
    return { totals, series: seriesRows, products };
  }

  queryProductPerformance(range) {
    const rows = this.db.prepare(`
      SELECT item.product_type, item.product_id, item.title,
        SUM(item.quantity) AS quantity, COALESCE(SUM(item.line_total_cents), 0) AS revenue_cents
      FROM order_items AS item
      JOIN orders AS order_row ON order_row.id = item.order_id
      WHERE substr(order_row.created_at, 1, 10) BETWEEN ? AND ?
        AND order_row.status IN (${CONFIRMED_ORDER_STATUSES.map(() => "?").join(", ")})
      GROUP BY item.product_type, item.product_id, item.title
    `).all(range.from, range.to, ...CONFIRMED_ORDER_STATUSES).map((row) => ({
      productType: row.product_type,
      productId: row.product_id,
      title: row.title,
      quantity: Number(row.quantity),
      revenueCents: Number(row.revenue_cents),
      revenue: formatAmount(row.revenue_cents),
    }));
    return {
      bestSelling: [...rows].sort((a, b) => b.quantity - a.quantity || b.revenueCents - a.revenueCents).slice(0, 5),
      leastSelling: [...rows].sort((a, b) => a.quantity - b.quantity || a.revenueCents - b.revenueCents).slice(0, 5),
    };
  }

  queryTraffic(range, groupBy) {
    const eventPeriod = periodSqlForEvent(groupBy);
    const rows = this.db.prepare(`
      SELECT ${eventPeriod} AS period, event_name, COUNT(*) AS count
      FROM analytics_events
      WHERE substr(occurred_at, 1, 10) BETWEEN ? AND ?
      GROUP BY period, event_name
    `).all(range.from, range.to);
    const uniqueRows = this.db.prepare(`
      SELECT ${eventPeriod} AS period, COUNT(DISTINCT session_id) AS count
      FROM analytics_events
      WHERE substr(occurred_at, 1, 10) BETWEEN ? AND ?
        AND event_name = 'page_viewed' AND session_id IS NOT NULL
      GROUP BY period
    `).all(range.from, range.to);
    const periods = new Set();
    const series = new Map();
    const ensure = (period) => {
      periods.add(period);
      if (!series.has(period)) series.set(period, { period, pageViews: 0, uniqueVisitors: 0, menuViews: 0 });
      return series.get(period);
    };
    for (const row of rows) {
      const point = ensure(row.period);
      if (row.event_name === "page_viewed") point.pageViews = Number(row.count);
      if (row.event_name === "menu_viewed") point.menuViews = Number(row.count);
    }
    for (const row of uniqueRows) ensure(row.period).uniqueVisitors = Number(row.count);
    const seriesRows = [...periods].sort().map((period) => series.get(period));
    return {
      totals: {
        pageViews: seriesRows.reduce((sum, point) => sum + point.pageViews, 0),
        uniqueVisitors: seriesRows.reduce((sum, point) => sum + point.uniqueVisitors, 0),
        menuViews: seriesRows.reduce((sum, point) => sum + point.menuViews, 0),
      },
      series: seriesRows,
    };
  }

  queryBusiestSlots(range) {
    return this.db.prepare(`
      SELECT substr(created_at, 1, 10) AS date,
        substr(created_at, 12, 5) AS time,
        COUNT(*) AS orders
      FROM orders
      WHERE substr(created_at, 1, 10) BETWEEN ? AND ?
        AND status NOT IN ('cancelled', 'withdrawn')
      GROUP BY date, time
      ORDER BY orders DESC, date ASC, time ASC
      LIMIT 8
    `).all(range.from, range.to).map((row) => ({
      date: row.date,
      time: row.time,
      orders: Number(row.orders),
    }));
  }
}

function mapRevenueRow(row) {
  return {
    id: row.id,
    date: row.date,
    amountCents: Number(row.amount_cents),
    amount: formatAmount(row.amount_cents),
    currency: row.currency,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeAmount(value) {
  if (Number.isInteger(value) && value >= 0 && value <= 100_000_000_00) return value;
  const text = String(value ?? "").trim().replace(",", ".");
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(text)) {
    throw new AnalyticsError("REVENUE_AMOUNT_INVALID", "Revenue amount must be a valid non-negative amount.", 400);
  }
  const [whole, decimal = ""] = text.split(".");
  const amountCents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(amountCents) || amountCents > 100_000_000_00) {
    throw new AnalyticsError("REVENUE_AMOUNT_INVALID", "Revenue amount is too large.", 400);
  }
  return amountCents;
}

function formatAmount(amountCents) {
  return (Number(amountCents) / 100).toFixed(2);
}

function validateDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    throw new AnalyticsError("ANALYTICS_DATE_INVALID", "Date must use YYYY-MM-DD.", 400);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new AnalyticsError("ANALYTICS_DATE_INVALID", "Date must be a real calendar date.", 400);
  }
  return value;
}

function normalizeRange(from, to) {
  const normalizedFrom = validateDate(from || to || today());
  const normalizedTo = validateDate(to || from || normalizedFrom);
  if (normalizedFrom > normalizedTo) {
    throw new AnalyticsError("ANALYTICS_RANGE_INVALID", "Date range is invalid.", 400);
  }
  return { from: normalizedFrom, to: normalizedTo };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(value, days) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000);
}

function periodSql(groupBy) {
  return periodSqlForColumn(groupBy, "date");
}

function periodSqlForColumn(groupBy, column) {
  return {
    day: column,
    week: `strftime('%Y-W%W', ${column})`,
    month: `strftime('%Y-%m', ${column})`,
    year: `strftime('%Y', ${column})`,
  }[groupBy];
}

function periodSqlForEvent(groupBy) {
  return {
    day: "substr(occurred_at, 1, 10)",
    week: "strftime('%Y-W%W', substr(occurred_at, 1, 10))",
    month: "strftime('%Y-%m', substr(occurred_at, 1, 10))",
    year: "strftime('%Y', substr(occurred_at, 1, 10))",
  }[groupBy];
}
