CREATE TABLE public.bulk_import_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  total integer NOT NULL DEFAULT 0,
  skipped jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  last_processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bulk_import_batches TO authenticated;
GRANT ALL ON public.bulk_import_batches TO service_role;
ALTER TABLE public.bulk_import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view bulk import batches" ON public.bulk_import_batches
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins insert bulk import batches" ON public.bulk_import_batches
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) AND user_id = auth.uid());
CREATE POLICY "Admins update bulk import batches" ON public.bulk_import_batches
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete bulk import batches" ON public.bulk_import_batches
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_bulk_import_batches_updated_at
  BEFORE UPDATE ON public.bulk_import_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.bulk_import_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id uuid NOT NULL REFERENCES public.bulk_import_batches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  folder text NOT NULL DEFAULT '',
  size bigint NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'file',
  storage_path text,
  image_hash text,
  status text NOT NULL DEFAULT 'pending',
  retry_count integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  last_error text,
  ocr_result jsonb,
  matching_result jsonb,
  property_id uuid,
  file_code integer,
  idempotency_key text NOT NULL,
  lease_owner text,
  lease_until timestamptz,
  fence integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bulk_import_items_idempotency_key_unique UNIQUE (idempotency_key)
);

CREATE INDEX bulk_import_items_batch_status_idx ON public.bulk_import_items (batch_id, status);
CREATE INDEX bulk_import_items_claimable_idx ON public.bulk_import_items (status, next_retry_at, lease_until);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bulk_import_items TO authenticated;
GRANT ALL ON public.bulk_import_items TO service_role;
ALTER TABLE public.bulk_import_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view bulk import items" ON public.bulk_import_items
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins insert bulk import items" ON public.bulk_import_items
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) AND user_id = auth.uid());
CREATE POLICY "Admins update bulk import items" ON public.bulk_import_items
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete bulk import items" ON public.bulk_import_items
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_bulk_import_items_updated_at
  BEFORE UPDATE ON public.bulk_import_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomic claim with a time-boxed lease and a fencing counter.
CREATE OR REPLACE FUNCTION public.claim_bulk_import_items(
  _worker text,
  _limit integer DEFAULT 5,
  _lease_seconds integer DEFAULT 180
)
RETURNS SETOF public.bulk_import_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT i.id
    FROM public.bulk_import_items i
    WHERE i.status IN ('pending', 'error_retry')
      AND (i.next_retry_at IS NULL OR i.next_retry_at <= now())
      AND (i.lease_until IS NULL OR i.lease_until <= now())
      AND i.storage_path IS NOT NULL
    ORDER BY i.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(_limit, 25))
  )
  UPDATE public.bulk_import_items t
  SET status = 'processing',
      lease_owner = _worker,
      lease_until = now() + make_interval(secs => GREATEST(30, LEAST(_lease_seconds, 900))),
      fence = t.fence + 1,
      updated_at = now()
  FROM picked
  WHERE t.id = picked.id
  RETURNING t.*;
END $$;

REVOKE ALL ON FUNCTION public.claim_bulk_import_items(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_bulk_import_items(text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.claim_bulk_import_items(text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_bulk_import_items(text, integer, integer) TO service_role;