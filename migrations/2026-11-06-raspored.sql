-- Raspored i popusti: upravlja se sa nadzorne ploče popunjenosti (stranica raspored.html).
-- Pokrenuti jednom u D1 konzoli baze `skripta`. Sigurno za ponovno pokretanje.

-- Radno vrijeme po danu u sedmici. dow: 0 = nedjelja ... 6 = subota. Vrijeme u minutama od ponoći.
CREATE TABLE IF NOT EXISTS hours_weekly (
  dow INTEGER PRIMARY KEY CHECK (dow BETWEEN 0 AND 6),
  closed INTEGER NOT NULL DEFAULT 0,
  open_min INTEGER,
  close_min INTEGER
);

-- Izuzeci za pojedini datum (praznik, skraćeno radno vrijeme, otvoren dan koji inače ne radi). Prednost ima nad sedmičnim.
CREATE TABLE IF NOT EXISTS hours_dates (
  date TEXT PRIMARY KEY,
  closed INTEGER NOT NULL DEFAULT 0,
  open_min INTEGER,
  close_min INTEGER,
  note TEXT
);

-- Popusti po satima. dows: npr. '1,2,3,4,5' (prazno = svi dani). date_from/date_to: neobavezni raspon datuma.
-- zone: 'ind', 'lounge' ili prazno (obje). percent 100 = besplatno.
CREATE TABLE IF NOT EXISTS discounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT,
  percent INTEGER NOT NULL CHECK (percent BETWEEN 1 AND 100),
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL,
  dows TEXT,
  date_from TEXT,
  date_to TEXT,
  zone TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Početne vrijednosti = pravila iz rules.js na dan migracije.
-- Pon-pet 09:00-18:30, subota zatvorena (osim 07.11. 10-15h), nedjelja zatvorena.
INSERT OR IGNORE INTO hours_weekly (dow, closed, open_min, close_min) VALUES
  (0, 1, 540, 1110),
  (1, 0, 540, 1110),
  (2, 0, 540, 1110),
  (3, 0, 540, 1110),
  (4, 0, 540, 1110),
  (5, 0, 540, 1110),
  (6, 1, 600, 900);

-- Open day 4. do 7.11.: besplatno. Radno vrijeme 4.11. 10-21h, 5. i 6.11. 10-18:30h, subota 7.11. 10-15h.
INSERT OR IGNORE INTO hours_dates (date, closed, open_min, close_min, note) VALUES
  ('2026-11-04', 0, 600, 1260, 'Open day'),
  ('2026-11-05', 0, 600, 1110, 'Open day'),
  ('2026-11-06', 0, 600, 1110, 'Open day'),
  ('2026-11-07', 0, 600, 900, 'Open day, subota');

INSERT INTO discounts (label, percent, start_min, end_min, dows, date_from, date_to, zone, active)
SELECT 'Open day', 100, 0, 1440, NULL, '2026-11-04', '2026-11-07', NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM discounts WHERE label = 'Open day');

INSERT OR IGNORE INTO settings (key, value) VALUES ('max_days', '5'), ('open_until', '2026-11-14');
