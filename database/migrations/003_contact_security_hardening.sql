-- Contact form hardening for Jenifer Pinto Finance Portfolio.
-- Apply only after deploying code that uses the server-only SUPABASE_SERVICE_ROLE_KEY.
-- This intentionally removes direct public-table inserts; the server endpoint becomes the only contact write path.

DROP POLICY IF EXISTS "Anyone can submit contact enquiry" ON public.contact_enquiries;
REVOKE INSERT ON TABLE public.contact_enquiries FROM PUBLIC, anon, authenticated;
GRANT INSERT ON TABLE public.contact_enquiries TO service_role;

CREATE TABLE IF NOT EXISTS public.contact_rate_limits (
  key_hash text PRIMARY KEY CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL CHECK (request_count >= 1)
);

ALTER TABLE public.contact_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.contact_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contact_rate_limits TO service_role;
CREATE INDEX IF NOT EXISTS contact_rate_limits_window_idx
  ON public.contact_rate_limits (window_started_at);

CREATE OR REPLACE FUNCTION public.consume_contact_rate_limit(
  p_key_hash text,
  p_window_seconds integer,
  p_max_requests integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF p_key_hash IS NULL OR p_key_hash !~ '^[0-9a-f]{64}$'
     OR p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 3600
     OR p_max_requests IS NULL OR p_max_requests < 1 OR p_max_requests > 100 THEN
    RAISE EXCEPTION 'Invalid contact rate-limit arguments' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.contact_rate_limits AS counter (key_hash, window_started_at, request_count)
  VALUES (p_key_hash, now(), 1)
  ON CONFLICT (key_hash) DO UPDATE
  SET window_started_at = CASE
        WHEN counter.window_started_at <= now() - make_interval(secs => p_window_seconds)
        THEN now() ELSE counter.window_started_at END,
      request_count = CASE
        WHEN counter.window_started_at <= now() - make_interval(secs => p_window_seconds)
        THEN 1 ELSE counter.request_count + 1 END
  RETURNING request_count INTO v_count;

  -- Low-volume cleanup of stale hashes; raw client IPs are never stored.
  IF random() < 0.02 THEN
    DELETE FROM public.contact_rate_limits
    WHERE window_started_at < now() - interval '1 day';
  END IF;

  RETURN v_count <= p_max_requests;
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_contact_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_contact_rate_limit(text, integer, integer) TO service_role;
