ALTER TABLE public.bulk_import_items
  ADD COLUMN IF NOT EXISTS decision text,
  ADD COLUMN IF NOT EXISTS decision_property_id uuid,
  ADD COLUMN IF NOT EXISTS decided_at timestamp with time zone;

ALTER TABLE public.bulk_import_items
  ADD CONSTRAINT bulk_import_items_decision_check
  CHECK (decision IS NULL OR decision IN ('register_new', 'connect_existing', 'defer'));