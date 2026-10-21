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
  event_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date, status);
-- Whole-space rentals. Insert one row per confirmed rental (the code adds the prep buffer).
CREATE TABLE IF NOT EXISTS blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_blocks_date ON blocks(date);
