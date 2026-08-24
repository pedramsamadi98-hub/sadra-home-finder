DROP VIEW IF EXISTS public.properties_shared;

CREATE OR REPLACE FUNCTION public.shared_properties()
RETURNS TABLE (
  id uuid,
  title text,
  property_type text,
  ownership_type text,
  transaction_type text,
  status text,
  city text,
  phase text,
  neighborhood text,
  street text,
  area numeric,
  price bigint,
  deposit bigint,
  monthly_rent bigint,
  bedrooms integer,
  floor integer,
  total_floors integer,
  building_age integer,
  parking boolean,
  elevator boolean,
  storage boolean,
  description text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.title, p.property_type, p.ownership_type, p.transaction_type, p.status,
         p.city, p.phase, p.neighborhood, p.street, p.area, p.price, p.deposit, p.monthly_rent,
         p.bedrooms, p.floor, p.total_floors, p.building_age, p.parking, p.elevator, p.storage,
         p.description, p.created_at, p.updated_at
  FROM public.properties p
  WHERE public.can_view_shared(auth.uid())
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.shared_properties() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shared_properties() TO authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.can_view_shared(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_shared(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;