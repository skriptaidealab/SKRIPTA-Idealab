-- Cloudflare D1 schema for SKRIPTA Work Café bookings
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','confirmed','rejected','cancelled')),
  zone TEXT NOT NULL,
  persons INTEGER NOT NULL,
  date TEXT NOT NULL,
  start_min INTEGER NOT NULL,
  dur_h INTEGER NOT NULL,
  total INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  table_idx INTEGER,
  event_id TEXT,
  newsletter INTEGER DEFAULT 0,
  reminded INTEGER DEFAULT 0,
  checked_in_at TEXT,        -- UTC ISO time of the QR check-in scan
  end_reminded INTEGER DEFAULT 0, -- 1 once the thank-you e-mail was sent or skipped
  left_at TEXT,              -- UTC ISO time the guest was marked as left (occupancy tracker)
  no_show INTEGER DEFAULT 0,  -- 1 when the guest never showed up (status is then cancelled)
  promo TEXT                  -- promo code used for this booking (see PROMOS in functions/_lib/rules.js)
);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date, status);
-- Newsletter subscribers: only people who tick the optional checkbox in the booking form.
CREATE TABLE IF NOT EXISTS subscribers (
  email TEXT PRIMARY KEY,
  name TEXT,
  created_at TEXT NOT NULL,
  source TEXT
);
-- Whole-space rentals. Insert one row per confirmed rental (the code adds the prep buffer).
CREATE TABLE IF NOT EXISTS blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_blocks_date ON blocks(date);

-- Emails left on the "rezervacije uskoro" notice (api/obavijest.js also creates this table on first use).
CREATE TABLE IF NOT EXISTS waitlist (email TEXT PRIMARY KEY, created_at TEXT NOT NULL, note TEXT);
