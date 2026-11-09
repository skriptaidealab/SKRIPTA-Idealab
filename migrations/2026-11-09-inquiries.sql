-- Upiti za najam prostora. Nije obavezno pokretati: api/upit.js i ploča tabelu prave sami pri prvom upotrebom.
CREATE TABLE IF NOT EXISTS inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  ime TEXT, email TEXT, tel TEXT, datum TEXT, trajanje TEXT, broj TEXT, vrsta TEXT, napomena TEXT,
  status TEXT NOT NULL DEFAULT 'novo',
  biljeska TEXT
);
