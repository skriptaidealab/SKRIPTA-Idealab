-- Check-in QR i podsjetnik pred kraj termina. Pokrenuti jednom u D1 konzoli (baza `skripta`).
ALTER TABLE bookings ADD COLUMN checked_in_at TEXT;
ALTER TABLE bookings ADD COLUMN end_reminded INTEGER DEFAULT 0;
