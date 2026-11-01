DO $v$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='properties' AND column_name IN ('last_activity_at','seller_status'))
     OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='property_price_events' AND column_name='seller_status') THEN
    RAISE EXCEPTION 'abort: feature columns already exist';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN ('properties_seller_status_check','property_price_events_seller_status_check')) THEN
    RAISE EXCEPTION 'abort: constraint name already exists';
  END IF;
  IF to_regprocedure('public.add_property_price_event(uuid,text,bigint,bigint,bigint,timestamptz,text,text,boolean,text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'abort: function already exists';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='properties') <> 48
     OR (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='property_price_events') <> 13 THEN
    RAISE EXCEPTION 'abort: unexpected column count';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='property_price_events' AND column_name='kind' AND data_type='text' AND is_nullable='NO')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='property_price_events' AND column_name='price' AND data_type='bigint' AND is_nullable='YES')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='properties' AND column_name='price_verified_at' AND data_type='timestamp with time zone')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='properties' AND column_name='initial_price' AND data_type='bigint' AND is_nullable='YES') THEN
    RAISE EXCEPTION 'abort: existing column shape mismatch';
  END IF;
END $v$;

ALTER TABLE public.properties ADD COLUMN last_activity_at timestamptz NULL;
ALTER TABLE public.properties ADD COLUMN seller_status text NULL;
ALTER TABLE public.property_price_events ADD COLUMN seller_status text NULL;

ALTER TABLE public.properties ADD CONSTRAINT properties_seller_status_check
  CHECK (seller_status IS NULL OR seller_status IN ('available','unavailable'));
ALTER TABLE public.property_price_events ADD CONSTRAINT property_price_events_seller_status_check
  CHECK (seller_status IS NULL OR seller_status IN ('available','unavailable'));

CREATE FUNCTION public.add_property_price_event(
  _property_id uuid,
  _kind text,
  _price bigint DEFAULT NULL,
  _deposit bigint DEFAULT NULL,
  _monthly_rent bigint DEFAULT NULL,
  _event_at timestamptz DEFAULT NULL,
  _note text DEFAULT NULL,
  _seller_status text DEFAULT NULL,
  _verify boolean DEFAULT true,
  _source text DEFAULT 'manual',
  _confidence text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $f$
DECLARE
  _uid uuid := auth.uid();
  _prop public.properties%ROWTYPE;
  _now timestamptz;
  _at timestamptz;
  _note_clean text := NULLIF(btrim(_note), '');
  _has_values boolean := (_price IS NOT NULL OR _deposit IS NOT NULL OR _monthly_rent IS NOT NULL OR _seller_status IS NOT NULL);
  _event_id uuid;
  _new_status text;
  _do_price boolean;
  _rows integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_admin(_uid) THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
  IF _property_id IS NULL THEN RAISE EXCEPTION 'property id required'; END IF;
  IF _kind IS NULL THEN RAISE EXCEPTION 'kind required'; END IF;
  IF _kind NOT IN ('price','update','note') THEN RAISE EXCEPTION 'invalid kind'; END IF;
  IF _seller_status IS NOT NULL AND _seller_status NOT IN ('available','unavailable') THEN
    RAISE EXCEPTION 'invalid seller status';
  END IF;
  IF NOT _has_values AND _note_clean IS NULL THEN RAISE EXCEPTION 'empty event'; END IF;
  IF _kind = 'note' AND _has_values THEN RAISE EXCEPTION 'note event cannot carry values'; END IF;
  IF _price IS NOT NULL AND _price < 0 OR _deposit IS NOT NULL AND _deposit < 0 OR _monthly_rent IS NOT NULL AND _monthly_rent < 0 THEN
    RAISE EXCEPTION 'negative amount';
  END IF;

  SELECT * INTO _prop FROM public.properties WHERE id = _property_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'property not found'; END IF;

  _now := clock_timestamp();
  _at := COALESCE(_event_at, _now);
  IF _at > _now + interval '5 minutes' THEN RAISE EXCEPTION 'event date in the future'; END IF;

  INSERT INTO public.property_price_events
    (property_id, user_id, kind, price, deposit, monthly_rent, event_at, source, confidence, note, seller_status)
  VALUES
    (_property_id, _uid, _kind, _price, _deposit, _monthly_rent, _at, COALESCE(_source,'manual'), _confidence, _note_clean, _seller_status)
  RETURNING id INTO _event_id;

  -- note-only events never touch the property row
  IF NOT _has_values THEN RETURN _event_id; END IF;

  SELECT e.seller_status INTO _new_status
  FROM public.property_price_events e
  WHERE e.property_id = _property_id AND e.seller_status IS NOT NULL
  ORDER BY e.event_at DESC, e.created_at DESC, e.id DESC
  LIMIT 1;

  _do_price := COALESCE(_verify, true) AND _price IS NOT NULL
    AND (_prop.price_verified_at IS NULL OR _at >= _prop.price_verified_at);

  UPDATE public.properties SET
    last_activity_at = GREATEST(COALESCE(last_activity_at, _now), _now),
    seller_status = CASE WHEN _seller_status IS NOT NULL THEN _new_status ELSE seller_status END,
    verified_price = CASE WHEN _do_price THEN _price ELSE verified_price END,
    price_verified_at = CASE WHEN _do_price THEN _at ELSE price_verified_at END,
    price = CASE WHEN _do_price THEN _price ELSE price END,
    deposit = CASE WHEN _do_price AND _deposit IS NOT NULL THEN _deposit ELSE deposit END,
    monthly_rent = CASE WHEN _do_price AND _monthly_rent IS NOT NULL THEN _monthly_rent ELSE monthly_rent END,
    initial_price = CASE WHEN _do_price AND initial_price IS NULL THEN _price ELSE initial_price END
  WHERE id = _property_id;
  GET DIAGNOSTICS _rows = ROW_COUNT;
  IF _rows <> 1 THEN RAISE EXCEPTION 'property update affected % rows', _rows; END IF;

  RETURN _event_id;
END $f$;

REVOKE ALL ON FUNCTION public.add_property_price_event(uuid,text,bigint,bigint,bigint,timestamptz,text,text,boolean,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_property_price_event(uuid,text,bigint,bigint,bigint,timestamptz,text,text,boolean,text,text) FROM anon;
REVOKE ALL ON FUNCTION public.add_property_price_event(uuid,text,bigint,bigint,bigint,timestamptz,text,text,boolean,text,text) FROM service_role;
GRANT EXECUTE ON FUNCTION public.add_property_price_event(uuid,text,bigint,bigint,bigint,timestamptz,text,text,boolean,text,text) TO authenticated;