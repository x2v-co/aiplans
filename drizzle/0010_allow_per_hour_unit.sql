-- Allow 'per_hour' (hourly GPU/agent pricing) and 'per_megapixel' (FLUX.2) in every pricing-unit
-- CHECK list. These constraints were created outside this repo, so rebuild each list from its
-- live definition: DROP, then re-ADD the same list plus the missing values.
--
-- Shapes handled:
--   * list:   CHECK ((col)::text = ANY ((ARRAY['per_x'::character varying, ...])::text[]))
--             -> missing values are appended to the ARRAY.
--   * single: CHECK (((col)::text = 'per_1m_tokens'::text))   (e.g. api_channel_price_variants)
--             -> a deliberate one-value pin (token-only table), left untouched.
-- Anything else still raises, so an unknown shape is never silently rewritten.
-- Idempotent: values already present are not re-added; a list holding all of them is skipped.
DO $$
DECLARE
  c record;
  def text;
  cast_type text;
  missing text;
  new_def text;
  v text;
BEGIN
  FOR c IN
    SELECT con.conname, con.conrelid::regclass AS tbl, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_namespace ns ON ns.oid = con.connamespace
    WHERE con.contype = 'c' AND ns.nspname = 'public'
      AND pg_get_constraintdef(con.oid) ~ '''per_(minute|second|1m_tokens|generation|image|request|character)'
  LOOP
    def := c.def;
    IF def !~ 'ARRAY\[' THEN
      -- Single-value pin: exactly one quoted literal compared with '='.
      IF def ~ '^CHECK \(+[a-z_]+\)?(::[a-z ]+)?\)? = ''[a-z0-9_]+''(::[a-z ]+)?\)+$' THEN
        RAISE NOTICE 'skip single-value unit pin %.%: %', c.tbl, c.conname, def;
        CONTINUE;
      END IF;
      RAISE EXCEPTION 'Unexpected unit constraint shape on %.%: %', c.tbl, c.conname, def;
    END IF;
    -- Postgres normalizes IN (...) to = ANY (ARRAY['a'::text, ...]); reuse the element cast.
    cast_type := substring(def from '''per_[a-z0-9_]+''::([a-z ]+)');
    IF cast_type IS NULL THEN
      RAISE EXCEPTION 'Unexpected unit constraint shape on %.%: %', c.tbl, c.conname, def;
    END IF;
    missing := '';
    FOREACH v IN ARRAY ARRAY['per_hour', 'per_megapixel'] LOOP
      IF position('''' || v || '''' IN def) = 0 THEN
        missing := missing || quote_literal(v) || '::' || cast_type || ', ';
      END IF;
    END LOOP;
    CONTINUE WHEN missing = '';
    new_def := regexp_replace(def, 'ARRAY\[', 'ARRAY[' || missing);
    RAISE NOTICE 'extend unit list: %.% -> %', c.tbl, c.conname, new_def;
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', c.tbl, c.conname, new_def);
  END LOOP;
END $$;
