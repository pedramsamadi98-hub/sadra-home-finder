-- Customers
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  phone text,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can insert customers" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_admin(auth.uid()));
CREATE POLICY "Owners and admins can view customers" ON public.customers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_admin(auth.uid()));
CREATE POLICY "Owners and admins can update customers" ON public.customers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.is_admin(auth.uid()));
CREATE POLICY "Owners and admins can delete customers" ON public.customers
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.is_admin(auth.uid()));

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX customers_user_id_idx ON public.customers(user_id);
CREATE INDEX customers_status_idx ON public.customers(status);

-- Customer requirements (a customer may have many)
CREATE TABLE public.customer_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  transaction_type text NOT NULL DEFAULT 'sale',
  ownership_type text NOT NULL DEFAULT 'any',
  city text,
  phase text,
  neighborhood text,
  min_area numeric,
  max_area numeric,
  bedrooms integer,
  min_budget bigint,
  max_budget bigint,
  needs_parking boolean NOT NULL DEFAULT false,
  needs_elevator boolean NOT NULL DEFAULT false,
  needs_storage boolean NOT NULL DEFAULT false,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_requirements TO authenticated;
GRANT ALL ON public.customer_requirements TO service_role;
ALTER TABLE public.customer_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can insert customer requirements" ON public.customer_requirements
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_admin(auth.uid()));
CREATE POLICY "Owners and admins can view customer requirements" ON public.customer_requirements
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_admin(auth.uid()));
CREATE POLICY "Owners and admins can update customer requirements" ON public.customer_requirements
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.is_admin(auth.uid()));
CREATE POLICY "Owners and admins can delete customer requirements" ON public.customer_requirements
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.is_admin(auth.uid()));

CREATE TRIGGER update_customer_requirements_updated_at BEFORE UPDATE ON public.customer_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX customer_requirements_customer_id_idx ON public.customer_requirements(customer_id);

-- Follow-ups can now attach to a customer as well as a property
ALTER TABLE public.follow_ups
  ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE;

ALTER TABLE public.follow_ups ALTER COLUMN property_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.follow_ups_target_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.property_id IS NULL AND NEW.customer_id IS NULL THEN
    RAISE EXCEPTION 'follow_ups must reference a property or a customer';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER follow_ups_target_check_trigger
  BEFORE INSERT OR UPDATE ON public.follow_ups
  FOR EACH ROW EXECUTE FUNCTION public.follow_ups_target_check();

CREATE INDEX follow_ups_customer_id_idx ON public.follow_ups(customer_id);