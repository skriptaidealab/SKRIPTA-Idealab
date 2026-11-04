-- Set by the occupancy tracker when a guest is marked as left; the thank-you e-mail is then sent right away.
ALTER TABLE bookings ADD COLUMN left_at TEXT;
