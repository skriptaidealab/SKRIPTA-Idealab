-- Promo code used for the booking (NULL = none). Run once in the D1 console before the first promo booking.
ALTER TABLE bookings ADD COLUMN promo TEXT;
