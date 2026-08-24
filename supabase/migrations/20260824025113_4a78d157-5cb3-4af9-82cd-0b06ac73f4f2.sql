-- 1. Private OCR photo list, separate from the displayable photos array.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS private_photos text[] NOT NULL DEFAULT '{}'::text[];

-- 2. Explicit per-image classification.
CREATE TABLE IF NOT EXISTS public.photo_visibility (
  storage_path text PRIMARY KEY,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  visibility text NOT NULL CHECK (visibility IN ('public_listing', 'private_ocr')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_visibility TO authenticated;
GRANT ALL ON public.photo_visibility TO service_role;

ALTER TABLE public.photo_visibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners and admins view photo visibility" ON public.photo_visibility;
CREATE POLICY "Owners and admins view photo visibility"
  ON public.photo_visibility FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Owners and admins insert photo visibility" ON public.photo_visibility;
CREATE POLICY "Owners and admins insert photo visibility"
  ON public.photo_visibility FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Owners and admins update photo visibility" ON public.photo_visibility;
CREATE POLICY "Owners and admins update photo visibility"
  ON public.photo_visibility FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Owners and admins delete photo visibility" ON public.photo_visibility;
CREATE POLICY "Owners and admins delete photo visibility"
  ON public.photo_visibility FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS update_photo_visibility_updated_at ON public.photo_visibility;
CREATE TRIGGER update_photo_visibility_updated_at
  BEFORE UPDATE ON public.photo_visibility
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS photo_visibility_property_idx
  ON public.photo_visibility (property_id);

-- 3. Definer helper: is this storage object explicitly marked as displayable?
CREATE OR REPLACE FUNCTION public.photo_is_public_listing(_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.photo_visibility v
    WHERE v.storage_path = _path
      AND v.visibility = 'public_listing'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE _path = ANY (p.private_photos)
  );
$$;

REVOKE ALL ON FUNCTION public.photo_is_public_listing(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.photo_is_public_listing(text) TO authenticated;

-- 4. Storage access: admins see everything, collaborators only displayable images.
DROP POLICY IF EXISTS "Admins can view all property photos" ON storage.objects;
CREATE POLICY "Admins can view all property photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'property-photos' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Collaborators can view displayable property photos" ON storage.objects;
CREATE POLICY "Collaborators can view displayable property photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'property-photos'
    AND public.can_view_shared(auth.uid())
    AND public.photo_is_public_listing(name)
  );

-- 5. Shared listing view for collaborators now exposes displayable photos only.
DROP FUNCTION IF EXISTS public.shared_properties();
CREATE OR REPLACE FUNCTION public.shared_properties()
RETURNS TABLE(
  id uuid, title text, property_type text, ownership_type text, transaction_type text,
  status text, city text, phase text, neighborhood text, street text, area numeric,
  price bigint, deposit bigint, monthly_rent bigint, bedrooms integer, floor integer,
  total_floors integer, building_age integer, parking boolean, elevator boolean,
  storage boolean, description text, photos text[],
  created_at timestamp with time zone, updated_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.title, p.property_type, p.ownership_type, p.transaction_type, p.status,
         p.city, p.phase, p.neighborhood, p.street, p.area, p.price, p.deposit, p.monthly_rent,
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

REVOKE ALL ON FUNCTION public.shared_properties() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shared_properties() TO authenticated;