-- Model license metadata. Unknown licenses and source links remain NULL.
ALTER TABLE models ADD COLUMN IF NOT EXISTS license text;
ALTER TABLE models ADD COLUMN IF NOT EXISTS license_url text;
