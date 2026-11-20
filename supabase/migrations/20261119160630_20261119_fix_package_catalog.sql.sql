-- Fix package catalog to match spec:
-- 1. باقات مضاعفة must contain ONLY the 4 double packs (50 + 5, 150 + 15, 250 + 25, 500 + 65).
--    The 20 non-double packs wrongly seeded there belong to باقات أساسية.
-- 2. باقات أساسية must contain all 31 packages ascending.
-- 3. Bundles: Arabic card labels "حزمة أسبوعية" = 55 and "حزمة شهرية" = 250 (no English names).

UPDATE packages SET tab = 'basic'
WHERE game = 'ml' AND tab = 'double' AND label !~ '\+';

UPDATE packages SET label = 'حزمة أسبوعية', price = 55
WHERE game = 'ml' AND tab = 'bundles' AND sub_section = 'حزمة أسبوعية' AND label = 'Weekly Pass';

UPDATE packages SET label = 'حزمة شهرية'
WHERE game = 'ml' AND tab = 'bundles' AND sub_section = 'حزمة شهرية' AND label = 'Monthly Pass';

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY label::integer) AS rn
  FROM packages
  WHERE game = 'ml' AND tab = 'basic' AND label ~ '^\d+$'
)
UPDATE packages SET sort_order = numbered.rn
FROM numbered WHERE packages.id = numbered.id;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order) AS rn
  FROM packages
  WHERE game = 'ml' AND tab = 'double'
)
UPDATE packages SET sort_order = numbered.rn
FROM numbered WHERE packages.id = numbered.id;