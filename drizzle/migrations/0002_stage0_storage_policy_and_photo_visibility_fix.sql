-- Stage 0 (Part A): Storage Security Gaps Resolution
-- 1. Tighten 4 own-folder Storage policies to enforce active account status (can_view_shared).
-- 2. Privatize exactly 8 orphaned public_listing photo_visibility records with a strict row-count safeguard.

DO $$
DECLARE
  target_paths text[] := ARRAY[
    'ab63d725-260d-40ad-ae81-5236bdfd4365/public/713376e1-0f21-420f-af7c-5bb2f36e3ea6.jpg',
    'ab63d725-260d-40ad-ae81-5236bdfd4365/public/2468a253-d30b-4629-8e1d-57137680b043.png',
    'ab63d725-260d-40ad-ae81-5236bdfd4365/public/35dd7138-c456-4640-9c13-49b09af76653.jpg',
    'ab63d725-260d-40ad-ae81-5236bdfd4365/public/ae7bdfc6-ce02-4a5e-a01d-dcb11df8499b.jpg',
    'ab63d725-260d-40ad-ae81-5236bdfd4365/public/330d48cb-a961-45c1-89a9-09cae9b55cf4.png',
    'ab63d725-260d-40ad-ae81-5236bdfd4365/public/205f1237-1a55-42f1-8ae3-6c65d3aa1fb9.jpg',
    'ab63d725-260d-40ad-ae81-5236bdfd4365/public/920437d3-28d8-4d88-b295-b5a59089f626.jpg',
    'ab63d725-260d-40ad-ae81-5236bdfd4365/public/ccaa90a5-42c7-4851-86fa-3953b9349920.jpg'
  ];
  pre_count int;
  owner_count int;
  distinct_count int;
  updated_count int;
BEGIN
  -- Safeguard: ensure exactly 8 target records exist with visibility = 'public_listing' and property_id IS NULL
  SELECT count(*) INTO pre_count
  FROM public.photo_visibility
  WHERE storage_path = ANY(target_paths)
    AND visibility = 'public_listing'
    AND property_id IS NULL;

  IF pre_count <> 8 THEN
    RAISE EXCEPTION 'Stage 0 Aborted: expected exactly 8 target records with visibility public_listing and NULL property_id, found %', pre_count;
  END IF;

  -- Additional safeguard: all 8 targets owned by the expected admin, and 8 distinct paths
  SELECT count(*), count(DISTINCT storage_path) INTO owner_count, distinct_count
  FROM public.photo_visibility
  WHERE storage_path = ANY(target_paths)
    AND visibility = 'public_listing'
    AND property_id IS NULL
    AND user_id = 'ab63d725-260d-40ad-ae81-5236bdfd4365'::uuid;

  IF owner_count <> 8 THEN
    RAISE EXCEPTION 'Stage 0 Aborted: expected all 8 target records to have user_id ab63d725-260d-40ad-ae81-5236bdfd4365, found %', owner_count;
  END IF;

  IF distinct_count <> 8 THEN
    RAISE EXCEPTION 'Stage 0 Aborted: expected count(DISTINCT storage_path) = 8, found %', distinct_count;
  END IF;

  -- Update exactly the 8 target records to private_ocr
  UPDATE public.photo_visibility
  SET visibility = 'private_ocr',
      updated_at = now()
  WHERE storage_path = ANY(target_paths)
    AND visibility = 'public_listing'
    AND property_id IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count <> 8 THEN
    RAISE EXCEPTION 'Stage 0 Aborted: expected to update exactly 8 records, updated %', updated_count;
  END IF;

  -- 1. Update own-folder SELECT policy
  DROP POLICY IF EXISTS "Users can view own property photos" ON storage.objects;
  CREATE POLICY "Users can view own property photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'property-photos'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND public.can_view_shared(auth.uid())
  );

  -- 2. Update own-folder INSERT policy
  DROP POLICY IF EXISTS "Users can upload own property photos" ON storage.objects;
  CREATE POLICY "Users can upload own property photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'property-photos'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND public.can_view_shared(auth.uid())
  );

  -- 3. Update own-folder UPDATE policy with both USING and WITH CHECK
  DROP POLICY IF EXISTS "Users can update own property photos" ON storage.objects;
  CREATE POLICY "Users can update own property photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'property-photos'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND public.can_view_shared(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'property-photos'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND public.can_view_shared(auth.uid())
  );

  -- 4. Update own-folder DELETE policy
  DROP POLICY IF EXISTS "Users can delete own property photos" ON storage.objects;
  CREATE POLICY "Users can delete own property photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'property-photos'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND public.can_view_shared(auth.uid())
  );
END $$;