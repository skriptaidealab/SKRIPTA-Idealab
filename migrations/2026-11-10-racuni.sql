-- Korisnički računi (prijava, portal "Moj račun", FLEXI veza).
-- Pokrenuti JEDNOM u D1 konzoli baze `skripta`, PRIJE objave koda s grane feature/korisnicki-racuni.
-- Nema lozinki: prijava je Google, Microsoft, Apple ili jednokratni kod na email.
-- Vremena u novim tabelama su unix sekunde (UTC).

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,      -- mala slova; račun postoji samo za potvrđen email
  name TEXT,
  phone TEXT,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

-- Veza računa s Google/Microsoft/Apple identitetom. `subject` je stabilan ID kod pružaoca, ne email.
CREATE TABLE IF NOT EXISTS identities (
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (provider, subject)
);
CREATE INDEX IF NOT EXISTS idx_identities_user ON identities(user_id);

-- Sesije. U bazi je samo SHA-256 otiska tokena: curenje baze ne daje upotrebljive sesije.
CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Jednokratni kodovi s emaila. Čuva se HMAC koda (ne sam kod), vrijedi 10 minuta, najviše 5 pokušaja.
CREATE TABLE IF NOT EXISTS login_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  pending_id TEXT,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_codes_email ON login_codes(email);

-- Stanje OAuth prijave (state, nonce, PKCE). Jednokratno, vrijedi 10 minuta.
CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  nonce TEXT NOT NULL,
  verifier TEXT NOT NULL,
  ret TEXT,                        -- kamo se vratiti nakon prijave (samo provjerene vrijednosti)
  created_at INTEGER NOT NULL
);

-- Identitet čiji email pružalac ne garantuje (npr. Microsoft poslovni nalog): račun se veže tek nakon koda s emaila.
CREATE TABLE IF NOT EXISTS oauth_pending (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  created_at INTEGER NOT NULL
);

-- Ograničenje broja pokušaja. Ključ je HMAC (email ili IP se ne čuvaju u čitljivom obliku).
CREATE TABLE IF NOT EXISTS rate_limits (
  k TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);

-- Sigurnosni dnevnik: samo radnja i ID računa, bez IP adresa i sadržaja.
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL,
  detail TEXT
);

-- Rezervacije i FLEXI paketi dobijaju vezu na račun.
ALTER TABLE bookings ADD COLUMN user_id TEXT;
ALTER TABLE bookings ADD COLUMN flexi_paket_id INTEGER;
ALTER TABLE bookings ADD COLUMN lang TEXT;
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, date);

-- Tabele FLEXI paketa prave se inače same u nadzornoj ploči; ovdje ih osiguravamo prije ALTER-a.
CREATE TABLE IF NOT EXISTS flexi_paketi (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, ime TEXT NOT NULL, email TEXT, telefon TEXT, sati INTEGER NOT NULL, dolazaka INTEGER NOT NULL, cijena REAL NOT NULL, placeno_at TEXT, napomena TEXT);
CREATE TABLE IF NOT EXISTS flexi_posjete (id INTEGER PRIMARY KEY AUTOINCREMENT, paket_id INTEGER NOT NULL, datum TEXT NOT NULL, napomena TEXT, created_at TEXT NOT NULL);
ALTER TABLE flexi_paketi ADD COLUMN user_id TEXT;         -- veza s računom (paket se inače nalazi i po emailu)
ALTER TABLE flexi_paketi ADD COLUMN expires_at TEXT;      -- datum (YYYY-MM-DD) do kojeg paket važi; postavlja se pri prvoj rezervaciji s paketom
ALTER TABLE flexi_posjete ADD COLUMN booking_id TEXT;     -- rezervacija čiji je check-in skinuo posjetu
