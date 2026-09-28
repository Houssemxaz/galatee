-- Galatee PostgreSQL baseline schema.
--
-- This schema intentionally preserves the current SQLite column contracts and
-- ISO date/time strings. The application runtime still uses SQLite until the
-- PostgreSQL adapter is reviewed and merged in a later migration step.

CREATE TABLE IF NOT EXISTS galatee_schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS galatee_migration_runs (
  id TEXT PRIMARY KEY,
  source_path TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  imported_rows INTEGER NOT NULL CHECK (imported_rows >= 0),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  error_message TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS customer_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  password_hash TEXT,
  password_salt TEXT,
  residence_commune TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS delivery_communes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  fee_cents INTEGER NOT NULL CHECK (fee_cents >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

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

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  item_type TEXT NOT NULL DEFAULT 'dish'
    CHECK (item_type IN ('dish', 'menu', 'offer')),
  category TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
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
  item_type TEXT NOT NULL DEFAULT 'dish'
    CHECK (item_type IN ('dish', 'menu', 'offer')),
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

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  table_type TEXT NOT NULL CHECK (table_type IN ('normal', 'vip')),
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
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
  customer_id TEXT REFERENCES customer_accounts(id) ON DELETE SET NULL,
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
  created_by TEXT NOT NULL DEFAULT 'manual'
    CHECK (created_by IN ('manual', 'reservation_confirmation')),
  created_at TEXT NOT NULL
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
  id BIGINT PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_id TEXT REFERENCES customer_accounts(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  delivery_mode TEXT NOT NULL CHECK (delivery_mode IN ('delivery', 'pickup')),
  commune_id TEXT REFERENCES delivery_communes(id) ON DELETE SET NULL,
  commune_name TEXT NOT NULL DEFAULT '',
  delivery_address TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL CHECK (payment_method = 'cash_on_delivery'),
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled', 'preparing', 'ready', 'delivered', 'withdrawn', 'completed')),
  note TEXT NOT NULL DEFAULT '',
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  delivery_fee_cents INTEGER NOT NULL CHECK (delivery_fee_cents >= 0),
  discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  loyalty_reward_id TEXT,
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  assigned_driver_id TEXT REFERENCES drivers(id) ON DELETE SET NULL,
  driver_assigned_at TEXT,
  driver_started_at TEXT,
  delivered_at TEXT,
  delivery_latitude DOUBLE PRECISION,
  delivery_longitude DOUBLE PRECISION,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (delivery_latitude IS NULL OR delivery_latitude BETWEEN -90 AND 90),
  CHECK (delivery_longitude IS NULL OR delivery_longitude BETWEEN -180 AND 180)
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  product_type TEXT NOT NULL DEFAULT 'dish'
    CHECK (product_type IN ('dish', 'menu', 'offer')),
  product_id TEXT NOT NULL,
  title TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0)
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  changed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loyalty_settings (
  id TEXT PRIMARY KEY CHECK (id = 'default'),
  qualifying_order_threshold INTEGER NOT NULL CHECK (qualifying_order_threshold BETWEEN 1 AND 100),
  reward_type TEXT NOT NULL CHECK (reward_type IN ('percentage', 'fixed')),
  reward_value INTEGER NOT NULL CHECK (reward_value > 0),
  reward_scope TEXT NOT NULL DEFAULT 'items' CHECK (reward_scope IN ('items', 'pack')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  eligible_dish_ids TEXT,
  reward_expiration_days INTEGER NOT NULL DEFAULT 90,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  qualifying_order_count INTEGER NOT NULL CHECK (qualifying_order_count > 0),
  reward_type TEXT NOT NULL CHECK (reward_type IN ('percentage', 'fixed')),
  reward_value INTEGER NOT NULL CHECK (reward_value > 0),
  reward_scope TEXT NOT NULL DEFAULT 'items' CHECK (reward_scope IN ('items', 'pack')),
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'applied', 'expired')),
  applied_order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  session_id TEXT,
  page_path TEXT NOT NULL DEFAULT '',
  occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_revenues (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'DZD',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

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

CREATE TABLE IF NOT EXISTS customer_login_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('signup', 'login')),
  code_hash TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_sessions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_password_resets (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS driver_sessions (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS driver_push_subscriptions (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_services_weekday
  ON services (weekday);
CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_time_slots_unique
  ON blocked_time_slots (date, time, COALESCE(table_type, 'all'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_rewards_milestone
  ON loyalty_rewards (customer_id, qualifying_order_count);
CREATE INDEX IF NOT EXISTS idx_menu_items_public_order
  ON menu_items (status, sort_order, updated_at);
CREATE INDEX IF NOT EXISTS idx_menu_revisions_item
  ON menu_item_revisions (menu_item_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reservations_date_time_type_status
  ON reservations (date, time, table_type, status);
CREATE INDEX IF NOT EXISTS idx_reservations_customer_id
  ON reservations (customer_id, date, created_at);
CREATE INDEX IF NOT EXISTS idx_blocked_time_slots_date
  ON blocked_time_slots (date);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_effective
  ON restaurant_tables (effective_from, effective_to, table_type);
CREATE INDEX IF NOT EXISTS idx_table_assignments_table
  ON reservation_table_assignments (table_id);
CREATE INDEX IF NOT EXISTS idx_availability_events_dates
  ON availability_events (date_from, date_to, active);
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON orders (status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer_created
  ON orders (customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_driver
  ON orders (assigned_driver_id, status);
CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order
  ON order_status_history (order_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_customer_login_codes_email_created
  ON customer_login_codes (email, created_at);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer_expiry
  ON customer_sessions (customer_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_customer_password_resets_email_created
  ON customer_password_resets (email, created_at);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_customer_status
  ON loyalty_rewards (customer_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_date_name
  ON analytics_events (occurred_at, event_name);
CREATE INDEX IF NOT EXISTS idx_pasta_club_events_date
  ON pasta_club_events (event_date, active);
CREATE INDEX IF NOT EXISTS idx_driver_sessions_expires
  ON driver_sessions (driver_id, expires_at);
