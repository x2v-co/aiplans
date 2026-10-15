-- Announcement day is distinct from the API shutdown day. Unknown stays NULL.
ALTER TABLE models ADD COLUMN IF NOT EXISTS deprecated_at date;
