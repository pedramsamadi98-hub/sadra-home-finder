CREATE TABLE public.property_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_shares TO authenticated;
GRANT ALL ON public.property_shares TO service_role;

ALTER TABLE public.property_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view property shares" ON public.property_shares
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert property shares" ON public.property_shares
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Admins can update property shares" ON public.property_shares
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete property shares" ON public.property_shares
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE INDEX property_shares_property_idx ON public.property_shares (property_id, created_at DESC);

CREATE TRIGGER update_property_shares_updated_at
  BEFORE UPDATE ON public.property_shares
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();