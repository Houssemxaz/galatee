CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  slot_interval_minutes INTEGER NOT NULL CHECK (slot_interval_minutes > 0),
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_services_weekday ON services (weekday);
CREATE INDEX IF NOT EXISTS idx_reservations_date_time_type_status ON reservations (date, time, table_type, status);
CREATE INDEX IF NOT EXISTS idx_reservations_date_status ON reservations (date, status);
CREATE INDEX IF NOT EXISTS idx_reservations_customer_id ON reservations (customer_id, date, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_time_slots_unique ON blocked_time_slots (date, time, COALESCE(table_type, 'all'));
CREATE INDEX IF NOT EXISTS idx_blocked_time_slots_date ON blocked_time_slots (date);

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
