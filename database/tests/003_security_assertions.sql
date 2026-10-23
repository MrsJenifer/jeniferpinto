-- Read-only verification. Run in Supabase SQL Editor after migration 003.
DO $$
DECLARE
  missing_rls text;
BEGIN
  SELECT string_agg(t.table_name, ', ')
  INTO missing_rls
  FROM information_schema.tables t
  JOIN information_schema.schemata s ON s.schema_name = t.table_schema
  WHERE t.table_schema = 'public'
    AND t.table_name IN (
      'admin_users','content_items','media_assets','contact_enquiries',
      'content_versions','audit_events','integration_connections','contact_rate_limits'
    )
    AND t.table_type = 'BASE TABLE'
    AND NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t.table_name AND c.relrowsecurity
    );

  IF missing_rls IS NOT NULL THEN
    RAISE EXCEPTION 'RLS not enabled on: %', missing_rls;
  END IF;

  IF has_table_privilege('anon', 'public.contact_enquiries', 'INSERT') THEN
    RAISE EXCEPTION 'anon still has INSERT privilege on contact_enquiries';
  END IF;

  IF has_table_privilege('authenticated', 'public.contact_enquiries', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated still has INSERT privilege on contact_enquiries';
  END IF;

  IF has_table_privilege('anon', 'public.contact_rate_limits', 'SELECT')
     OR has_table_privilege('authenticated', 'public.contact_rate_limits', 'SELECT') THEN
    RAISE EXCEPTION 'Contact rate-limit table is visible to public/authenticated roles';
  END IF;

  IF has_function_privilege('anon', 'public.consume_contact_rate_limit(text,integer,integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.consume_contact_rate_limit(text,integer,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Contact rate-limit RPC is executable by public/authenticated roles';
  END IF;
END;
$$;

SELECT 'PASS: expected RLS, contact insert grants, and rate-limit RPC privileges verified.' AS result;
