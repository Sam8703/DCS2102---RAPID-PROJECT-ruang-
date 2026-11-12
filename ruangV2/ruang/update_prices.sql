-- Approximate base nightly prices by location, property type and capacity.
-- Existing bookings retain their original agreed prices.
USE ruang_db;
START TRANSACTION;
UPDATE homestays SET price_per_night = 450.00 WHERE id = 'stay-1' AND name = 'Palm House' AND location = 'Melaka';
UPDATE homestays SET price_per_night = 300.00 WHERE id = 'stay-2' AND name = 'City Loft' AND location = 'Kuala Lumpur';
UPDATE homestays SET price_per_night = 330.00 WHERE id = 'stay-3' AND name = 'Serene Home' AND location = 'Penang';
UPDATE homestays SET price_per_night = 220.00 WHERE id = 'stay-4' AND name = 'Hillside Cabin' AND location = 'Ipoh';
COMMIT;
