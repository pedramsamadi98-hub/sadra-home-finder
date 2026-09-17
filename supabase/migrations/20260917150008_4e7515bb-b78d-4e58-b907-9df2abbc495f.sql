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
    WHERE i.storage_path IS NOT NULL
      AND (
        -- normal work
        (
          i.status IN ('pending', 'error_retry')
          AND (i.next_retry_at IS NULL OR i.next_retry_at <= now())
          AND (i.lease_until IS NULL OR i.lease_until <= now())
        )
        -- crash recovery: a worker died mid-item and its lease has expired.
        -- Requires an expired lease, so an in-flight execution run (which
        -- claims without a lease) is never stolen.
        OR (
          i.status = 'processing'
          AND i.lease_until IS NOT NULL
          AND i.lease_until <= now()
          AND i.property_id IS NULL
        )
      )
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