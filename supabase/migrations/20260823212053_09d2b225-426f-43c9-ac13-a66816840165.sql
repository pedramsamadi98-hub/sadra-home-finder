ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS ownership_type text;

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_ownership_type_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_ownership_type_check
  CHECK (ownership_type IS NULL OR ownership_type IN ('melki', 'owqaf'));

CREATE INDEX IF NOT EXISTS properties_ownership_type_idx
  ON public.properties (ownership_type);