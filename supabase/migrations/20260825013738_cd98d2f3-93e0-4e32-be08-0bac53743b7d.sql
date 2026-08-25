ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS land_category text,
  ADD COLUMN IF NOT EXISTS land_zone text,
  ADD COLUMN IF NOT EXISTS plot_number text;

CREATE INDEX IF NOT EXISTS properties_land_category_idx ON public.properties (land_category);
CREATE INDEX IF NOT EXISTS properties_land_zone_idx ON public.properties (land_zone);

DROP FUNCTION IF EXISTS public.shared_properties();

CREATE OR REPLACE FUNCTION public.shared_properties()
 RETURNS TABLE(id uuid, title text, property_type text, ownership_type text, transaction_type text, status text, city text, phase text, neighborhood text, street text, land_category text, land_zone text, plot_number text, area numeric, price bigint, deposit bigint, monthly_rent bigint, bedrooms integer, floor integer, total_floors integer, building_age integer, parking boolean, elevator boolean, storage boolean, description text, photos text[], created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.title, p.property_type, p.ownership_type, p.transaction_type, p.status,
         p.city, p.phase, p.neighborhood, p.street,
         p.land_category, p.land_zone, p.plot_number,
         p.area, p.price, p.deposit, p.monthly_rent,
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
$function$;

REVOKE ALL ON FUNCTION public.shared_properties() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shared_properties() TO authenticated;
