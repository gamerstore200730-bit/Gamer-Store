/*
# Seed packages table with all ML and Starlight packages

1. Scope
- Inserts the complete package catalog into `packages`:
  - ML "double" tab (باقات مضاعفة): 24 packages, double packs first (50 + 5 ... 500 + 65), then the rest.
  - ML "basic" tab (باقات أساسية): 11 packages.
  - ML "bundles" tab (حزم واشتراكات): 4 sub-sections (ويكلي باس، حزمة أسبوعية، حزمة شهرية، حزمة ميا) with 1-3 packages each.
  - Starlight: 9 duration packages.
- Prices are FINAL selling prices in EGP as provided by the owner. Starlight prices are placeholders.

2. Behavior
- Idempotent: each package is identified by its stable (game, tab, sub_section, label) tuple via NOT EXISTS guard.
- On DB rebuild (empty table) the seed inserts everything in the specified order.
- Does not modify or delete existing rows.

3. Security
- No security changes (table + policies already exist).
*/

-- ML — باقات مضاعفة (double)
INSERT INTO packages (game, tab, sub_section, label, price, sort_order)
SELECT 'ml', 'double', NULL, v.label, v.price, v.ord FROM (VALUES
  ('50 + 5', 55, 1),
  ('150 + 15', 155, 2),
  ('250 + 25', 255, 3),
  ('500 + 65', 510, 4),
  ('429', 410, 5),
  ('514', 485, 6),
  ('878', 810, 7),
  ('963', 895, 8),
  ('1135', 1060, 9),
  ('1220', 1150, 10),
  ('1412', 1300, 11),
  ('1584', 1470, 12),
  ('1670', 1530, 13),
  ('1926', 1780, 14),
  ('3073', 2750, 15),
  ('4068', 3600, 16),
  ('6238', 5500, 17),
  ('7727', 6800, 18),
  ('8433', 7400, 19),
  ('10080', 8700, 20),
  ('12976', 11300, 21),
  ('15077', 12950, 22),
  ('20074', 17000, 23),
  ('30059', 25000, 24)
) AS v(label, price, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM packages p WHERE p.game = 'ml' AND p.tab = 'double' AND p.label = v.label
);

-- ML — باقات أساسية (basic)
INSERT INTO packages (game, tab, sub_section, label, price, sort_order)
SELECT 'ml', 'basic', NULL, v.label, v.price, v.ord FROM (VALUES
  ('86', 85, 1),
  ('172', 165, 2),
  ('257', 245, 3),
  ('343', 325, 4),
  ('600', 570, 5),
  ('706', 650, 6),
  ('1050', 980, 7),
  ('2195', 1930, 8),
  ('3688', 3250, 9),
  ('5532', 4880, 10),
  ('9288', 8000, 11)
) AS v(label, price, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM packages p WHERE p.game = 'ml' AND p.tab = 'basic' AND p.label = v.label
);

-- ML — حزم واشتراكات (bundles) sub-sections
INSERT INTO packages (game, tab, sub_section, label, price, sort_order)
SELECT 'ml', 'bundles', v.sub, v.label, v.price, v.ord FROM (VALUES
  ('ويكلي باس', 'اشتراك واحد', 90, 1),
  ('ويكلي باس', '3 اشتراكات', 270, 2),
  ('ويكلي باس', '10 اشتراكات', 900, 3),
  ('حزمة أسبوعية', 'Weekly Pass', 50, 1),
  ('حزمة شهرية', 'Monthly Pass', 250, 1),
  ('حزمة ميا', 'MIYA SKIN', 530, 1)
) AS v(sub, label, price, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM packages p WHERE p.game = 'ml' AND p.tab = 'bundles' AND p.sub_section = v.sub AND p.label = v.label
);

-- Starlight (placeholder prices)
INSERT INTO packages (game, tab, sub_section, label, price, sort_order)
SELECT 'starlight', 'starlight', NULL, v.label, v.price, v.ord FROM (VALUES
  ('Starlight — شهر واحد', 180, 1),
  ('Starlight — شهرين', 350, 2),
  ('Starlight — 3 أشهر', 510, 3),
  ('Starlight — 4 أشهر', 670, 4),
  ('Starlight — 5 أشهر', 825, 5),
  ('Starlight — 6 أشهر', 980, 6),
  ('Starlight — 7 أشهر', 1130, 7),
  ('Starlight — 8 أشهر', 1280, 8),
  ('Starlight — 10 أشهر', 1580, 9)
) AS v(label, price, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM packages p WHERE p.game = 'starlight' AND p.label = v.label
);
