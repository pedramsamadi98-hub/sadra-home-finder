ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS deposited_amount numeric,
  ADD COLUMN IF NOT EXISTS company_payable_amount numeric,
  ADD COLUMN IF NOT EXISTS company_payment_terms text,
  ADD COLUMN IF NOT EXISTS unit_number text,
  ADD COLUMN IF NOT EXISTS payment_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_terms text;