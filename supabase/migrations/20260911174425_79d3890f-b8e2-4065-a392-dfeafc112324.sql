-- 1) properties: file code, initial/verified price tracking
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS file_code integer,
  ADD COLUMN IF NOT EXISTS initial_date timestamptz,
  ADD COLUMN IF NOT EXISTS initial_price bigint,
  ADD COLUMN IF NOT EXISTS verified_price bigint,
  ADD COLUMN IF NOT EXISTS price_verified_at timestamptz;

-- 2) pool of released file codes (reusable after a real delete)
CREATE TABLE IF NOT EXISTS public.file_code_pool (
  code integer PRIMARY KEY,
  released_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.file_code_pool TO authenticated;
GRANT ALL ON public.file_code_pool TO service_role;
ALTER TABLE public.file_code_pool ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins manage file code pool" ON public.file_code_pool
    FOR ALL TO authenticated
    USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SEQUENCE IF NOT EXISTS public.property_file_code_seq AS integer START 1;
GRANT USAGE, SELECT ON SEQUENCE public.property_file_code_seq TO authenticated, service_role;

-- 3) backfill existing rows in registration order
DO $$
DECLARE r record; next_code integer := 1;
BEGIN
  FOR r IN SELECT id FROM public.properties WHERE file_code IS NULL ORDER BY created_at ASC LOOP
    UPDATE public.properties SET file_code = next_code WHERE id = r.id;
    next_code := next_code + 1;
  END LOOP;
  PERFORM setval('public.property_file_code_seq', GREATEST(next_code - 1, 1), true);
END $$;

-- initial date / price default to the values already stored
UPDATE public.properties SET initial_date = created_at WHERE initial_date IS NULL;
UPDATE public.properties SET initial_price = price WHERE initial_price IS NULL AND price IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS properties_file_code_key ON public.properties (file_code);

CREATE OR REPLACE FUNCTION public.assign_property_file_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE reused integer;
BEGIN
  IF NEW.file_code IS NULL THEN
    DELETE FROM public.file_code_pool
      WHERE code = (SELECT min(code) FROM public.file_code_pool)
      RETURNING code INTO reused;
    IF reused IS NOT NULL THEN
      NEW.file_code := reused;
    ELSE
      NEW.file_code := nextval('public.property_file_code_seq')::integer;
    END IF;
  END IF;
  IF NEW.initial_date IS NULL THEN NEW.initial_date := now(); END IF;
  IF NEW.initial_price IS NULL THEN NEW.initial_price := NEW.price; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS properties_assign_file_code ON public.properties;
CREATE TRIGGER properties_assign_file_code
  BEFORE INSERT ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.assign_property_file_code();

CREATE OR REPLACE FUNCTION public.release_property_file_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.file_code IS NOT NULL THEN
    INSERT INTO public.file_code_pool (code) VALUES (OLD.file_code)
      ON CONFLICT (code) DO NOTHING;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS properties_release_file_code ON public.properties;
CREATE TRIGGER properties_release_file_code
  AFTER DELETE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.release_property_file_code();

-- 4) price / update history
CREATE TABLE IF NOT EXISTS public.property_price_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'price',
  price bigint,
  deposit bigint,
  monthly_rent bigint,
  event_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'manual',
  confidence text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_price_events TO authenticated;
GRANT ALL ON public.property_price_events TO service_role;
ALTER TABLE public.property_price_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Owners and admins view price events" ON public.property_price_events
    FOR SELECT TO authenticated USING ((user_id = auth.uid()) OR public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins insert price events" ON public.property_price_events
    FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()) AND public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Owners and admins update price events" ON public.property_price_events
    FOR UPDATE TO authenticated
    USING ((user_id = auth.uid()) OR public.is_admin(auth.uid()))
    WITH CHECK ((user_id = auth.uid()) OR public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Owners and admins delete price events" ON public.property_price_events
    FOR DELETE TO authenticated USING ((user_id = auth.uid()) OR public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS update_property_price_events_updated_at ON public.property_price_events;
CREATE TRIGGER update_property_price_events_updated_at
  BEFORE UPDATE ON public.property_price_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS property_price_events_property_idx
  ON public.property_price_events (property_id, event_at DESC);

-- 5) follow_ups become general reminders
ALTER TABLE public.follow_ups
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS broker_id uuid REFERENCES public.brokers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS all_day boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.follow_ups_target_check()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- A reminder may stand alone (personal task) or link to a customer,
  -- property or broker. It only needs a title when it has no target.
  IF NEW.property_id IS NULL AND NEW.customer_id IS NULL AND NEW.broker_id IS NULL
     AND COALESCE(btrim(NEW.title), '') = '' THEN
    RAISE EXCEPTION 'reminder needs a title or a linked customer/property/broker';
  END IF;
  RETURN NEW;
END $$;

CREATE INDEX IF NOT EXISTS follow_ups_user_next_idx
  ON public.follow_ups (user_id, status, next_at);
CREATE INDEX IF NOT EXISTS follow_ups_broker_idx ON public.follow_ups (broker_id);

-- 6) per-user settings (global default broker update interval)
CREATE TABLE IF NOT EXISTS public.app_settings (
  user_id uuid PRIMARY KEY,
  broker_default_interval_days integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users view own settings" ON public.app_settings
    FOR SELECT TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users insert own settings" ON public.app_settings
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users update own settings" ON public.app_settings
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) search / filter indexes for scale
CREATE INDEX IF NOT EXISTS properties_status_created_idx ON public.properties (status, created_at DESC);
CREATE INDEX IF NOT EXISTS properties_type_idx ON public.properties (property_type);
CREATE INDEX IF NOT EXISTS properties_verified_price_idx ON public.properties (verified_price);

-- 8) shared (collaborator) view gains file code + price freshness, no owner data
DROP FUNCTION IF EXISTS public.shared_properties();
CREATE FUNCTION public.shared_properties()
RETURNS TABLE(id uuid, file_code integer, title text, property_type text, ownership_type text,
  transaction_type text, status text, city text, phase text, neighborhood text, street text,
  land_category text, land_zone text, plot_number text, area numeric, price bigint,
  initial_price bigint, verified_price bigint, price_verified_at timestamp with time zone,
  initial_date timestamp with time zone, deposit bigint, monthly_rent bigint, bedrooms integer,
  floor integer, total_floors integer, building_age integer, parking boolean, elevator boolean,
  storage boolean, description text, photos text[], created_at timestamp with time zone,
  updated_at timestamp with time zone)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.file_code, p.title, p.property_type, p.ownership_type, p.transaction_type, p.status,
         p.city, p.phase, p.neighborhood, p.street,
         p.land_category, p.land_zone, p.plot_number,
         p.area, p.price, p.initial_price, p.verified_price, p.price_verified_at, p.initial_date,
         p.deposit, p.monthly_rent,
         p.bedrooms, p.floor, p.total_floors, p.building_age, p.parking, p.elevator, p.storage,
         p.description,
         ARRAY(
           SELECT path FROM unnest(p.photos) AS path
           WHERE path <> ALL (p.private_photos)
             AND EXISTS (
               SELECT 1 FROM public.photo_visibility v
               WHERE v.storage_path = path AND v.visibility = 'public_listing'
             )
         ) AS photos,
         p.created_at, p.updated_at
  FROM public.properties p
  WHERE public.can_view_shared(auth.uid())
  ORDER BY p.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.shared_properties() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shared_properties() TO authenticated, service_role;