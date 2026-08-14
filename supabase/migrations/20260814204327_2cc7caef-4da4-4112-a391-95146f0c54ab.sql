UPDATE public.properties SET user_id = 'ab63d725-260d-40ad-ae81-5236bdfd4365' WHERE user_id IS NULL;

ALTER TABLE public.properties ALTER COLUMN user_id SET NOT NULL;

DROP POLICY IF EXISTS "Users can view own and sample properties" ON public.properties;
CREATE POLICY "Users can view own properties" ON public.properties
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.brokers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  agency text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brokers TO authenticated;
GRANT ALL ON public.brokers TO service_role;

ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own brokers" ON public.brokers
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own brokers" ON public.brokers
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own brokers" ON public.brokers
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own brokers" ON public.brokers
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER update_brokers_updated_at BEFORE UPDATE ON public.brokers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.properties
  ADD COLUMN broker_id uuid REFERENCES public.brokers(id) ON DELETE SET NULL;

CREATE INDEX idx_properties_broker_id ON public.properties(broker_id);
