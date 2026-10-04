-- Manager-selected cover image. NULL = category default image (app asset).
-- Idempotent: the column already exists in Production; no data is changed.
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS cover_photo text NULL;
