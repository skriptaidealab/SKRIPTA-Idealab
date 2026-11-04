-- Set to 1 by the occupancy tracker when a guest never showed up (the booking is then also set to cancelled).
ALTER TABLE bookings ADD COLUMN no_show INTEGER DEFAULT 0;
