ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS total_floors integer;

CREATE INDEX IF NOT EXISTS properties_user_created_idx ON public.properties (user_id, created_at DESC);