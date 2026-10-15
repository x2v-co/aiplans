-- Allow 'per_hour' in every pricing-unit CHECK list (models_pricing_unit_chk and any sibling
-- such as plans/api_channel_prices/usage_prices unit checks). These constraints were created
-- outside this repo, so rebuild each from its live definition: DROP, then re-ADD the exact
-- same list plus 'per_hour'. Nothing else changes. Idempotent: lists that already contain
-- 'per_hour', or that are not pricing-unit lists, are skipped.
DO $$
DECLARE
  c record;
  def text;
  cast_type text;
  new_def text;
BEGIN
  FOR c IN
    SELECT con.conname, con.conrelid::regclass AS tbl, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_namespace ns ON ns.oid = con.connamespace
    WHERE con.contype = 'c' AND ns.nspname = 'public'
      AND pg_get_constraintdef(con.oid) ~ '''per_(minute|second|1m_tokens|generation|image|request|character)'
      AND pg_get_constraintdef(con.oid) !~ '''per_hour'''
  LOOP
    def := c.def;
    -- Postgres normalizes IN (...) to = ANY (ARRAY['a'::text, ...]); reuse the element cast.
    cast_type := substring(def from '''per_[a-z0-9_]+''::([a-z ]+)');
    IF def !~ 'ARRAY\[' OR cast_type IS NULL THEN
      RAISE EXCEPTION 'Unexpected unit constraint shape on %.%: %', c.tbl, c.conname, def;
    END IF;
    new_def := regexp_replace(def, 'ARRAY\[', 'ARRAY[''per_hour''::' || cast_type || ', ');
    RAISE NOTICE 'allow per_hour: %.% -> %', c.tbl, c.conname, new_def;
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', c.tbl, c.conname, new_def);
  END LOOP;
END $$;
