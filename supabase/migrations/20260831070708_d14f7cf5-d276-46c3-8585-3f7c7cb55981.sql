ALTER TABLE public.brokers
  ADD COLUMN IF NOT EXISTS last_contact_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_contact_note text,
  ADD COLUMN IF NOT EXISTS update_interval_days integer NOT NULL DEFAULT 14;

UPDATE public.brokers SET last_contact_at = COALESCE(last_contact_at, updated_at);