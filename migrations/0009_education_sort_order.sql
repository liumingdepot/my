-- Add sort_order to education_sources
ALTER TABLE education_sources ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_education_sources_sort ON education_sources (sort_order ASC, name ASC);

-- Known seed order: 儿童早教 → 小学 → 初中 → 高中
UPDATE education_sources SET sort_order = 1 WHERE name = '儿童早教' COLLATE NOCASE;
UPDATE education_sources SET sort_order = 2 WHERE name = '一年级 二年级' COLLATE NOCASE;
UPDATE education_sources SET sort_order = 3 WHERE name = '初中' COLLATE NOCASE;
UPDATE education_sources SET sort_order = 4 WHERE name = '高中' COLLATE NOCASE;
