-- UNSIGNED / UNEXECUTED SRE PROPOSAL. Never production authorization.
-- Fixed pair 3014 -> 3192, provider59, channels15031/15334 only.
-- Generated from reviewed structure.ts/profile; unknown definitions stay in DB.
-- No default lookup/evaluation, function bodies/configs, dynamic execution or writes.
-- Run only after parent/SRE review with psql -X -v ON_ERROR_STOP=1 -f THIS_FILE.
\set ON_ERROR_STOP on
\set ECHO none
\set VERBOSITY terse
\set SHOW_CONTEXT never
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,public;
SET LOCAL timezone='UTC';
SET LOCAL datestyle='ISO, YMD';
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='1s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL row_security=off;
SELECT current_setting('server_version_num')::integer BETWEEN 170000 AND 179999
  AND current_setting('session_replication_role')='origin' AS environment_ok \gset o3_
\echo environment :o3_environment_ok
\if :o3_environment_ok
\else
  ROLLBACK;
  \quit 3
\endif
WITH RECURSIVE columns_raw AS (
SELECT c.relname AS "table",a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,
    NOT a.attnotnull AS nullable,a.attidentity::text AS identity,a.attgenerated::text AS generated,
    coalesce(co.collname,'') AS collation,
    NOT a.attisdropped AND tn.nspname='pg_catalog' AND pi.pronamespace='pg_catalog'::regnamespace
      AND po.pronamespace='pg_catalog'::regnamespace AND t.typtype<>'d'
      AND (co.oid IS NULL OR co.collnamespace='pg_catalog'::regnamespace AND co.collisdeterministic) AS safe
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_type t ON t.oid=a.atttypid JOIN pg_namespace tn ON tn.oid=t.typnamespace
    JOIN pg_proc pi ON pi.oid=t.typinput JOIN pg_proc po ON po.oid=t.typoutput
    LEFT JOIN pg_collation co ON co.oid=a.attcollation
    WHERE n.nspname='public' AND c.relname=ANY(ARRAY['models','api_channel_prices','model_slug_redirects','api_channel_price_variants','coding_agent_scores','evaluation_run','external_price_references','model_benchmark_scores','model_offical','model_plan_mapping','usage_prices','price_history','quota_estimates','usage_mixes','providers']::text[]) AND a.attnum>0 ORDER BY c.relname,a.attnum
),
constraints_raw AS (
SELECT c.relname AS "table",k.conname AS name,k.contype::text AS kind,
    pg_get_constraintdef(k.oid) AS definition,
    k.convalidated AND NOT k.condeferrable AND NOT k.condeferred AS safe
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
    WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY(ARRAY['models','api_channel_prices','model_slug_redirects']::text[]) ORDER BY c.relname,k.conname
),
indexes_raw AS (
SELECT c.relname AS "table",ic.relname AS name,pg_get_indexdef(i.indexrelid) AS definition,
    i.indisvalid AND i.indisready AND i.indislive AND am.amname='btree' AND am.amhandler='bthandler'::regproc
    AND NOT EXISTS(SELECT 1 FROM unnest(i.indclass::oid[]) op(oid) JOIN pg_opclass oc ON oc.oid=op.oid
      WHERE oc.opcnamespace<>'pg_catalog'::regnamespace)
    AND NOT EXISTS(SELECT 1 FROM unnest(i.indclass::oid[]) op(oid) JOIN pg_opclass oc ON oc.oid=op.oid
      JOIN pg_amproc ap ON ap.amprocfamily=oc.opcfamily JOIN pg_proc p ON p.oid=ap.amproc
      WHERE p.pronamespace<>'pg_catalog'::regnamespace)
    AND NOT EXISTS(SELECT 1 FROM unnest(i.indclass::oid[]) op(oid) JOIN pg_opclass oc ON oc.oid=op.oid
      JOIN pg_amop ao ON ao.amopfamily=oc.opcfamily JOIN pg_operator o ON o.oid=ao.amopopr
      JOIN pg_proc p ON p.oid=o.oprcode WHERE o.oprnamespace<>'pg_catalog'::regnamespace OR p.pronamespace<>'pg_catalog'::regnamespace)
      AS safe
    FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_class ic ON ic.oid=i.indexrelid
    JOIN pg_am am ON am.oid=ic.relam
    WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY(ARRAY['models','api_channel_prices','model_slug_redirects','api_channel_price_variants','coding_agent_scores','evaluation_run','external_price_references','model_benchmark_scores','model_offical','model_plan_mapping','usage_prices','price_history','quota_estimates','usage_mixes','providers']::text[]) ORDER BY c.relname,ic.relname
),
incoming_raw AS (
SELECT c.relname AS "table",k.conname AS name,k.contype::text AS kind,
    pg_get_constraintdef(k.oid) AS definition,r.relname AS target,
    c.relnamespace='public'::regnamespace AND k.convalidated AND NOT k.condeferrable AND NOT k.condeferred
    AND NOT EXISTS(SELECT 1 FROM unnest(k.conpfeqop || k.conppeqop || k.conffeqop) ops(oid)
      JOIN pg_operator o ON o.oid=ops.oid JOIN pg_proc p ON p.oid=o.oprcode
      WHERE o.oprnamespace<>'pg_catalog'::regnamespace OR p.pronamespace<>'pg_catalog'::regnamespace) AS safe
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_class r ON r.oid=k.confrelid
    WHERE k.contype='f' AND r.relnamespace='public'::regnamespace AND r.relname=ANY(ARRAY['models','api_channel_prices','model_slug_redirects']::text[])
    ORDER BY c.relname,k.conname
),
relations_raw AS (
SELECT c.relname AS name,
    c.relkind='r' AND c.relpersistence='p' AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity AND NOT c.relispartition
    AND NOT EXISTS(SELECT 1 FROM pg_inherits WHERE inhrelid=c.oid OR inhparent=c.oid)
    AND (c.relname<>ALL(ARRAY['models','api_channel_prices','model_slug_redirects','model_plan_mapping']::text[]) OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=c.oid AND (NOT tgisinternal OR tgfoid NOT IN
      (SELECT oid FROM pg_proc WHERE pronamespace='pg_catalog'::regnamespace AND proname LIKE 'RI_FKey_%'))))
    AND NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=c.oid)
    AND NOT EXISTS(SELECT 1 FROM pg_rewrite WHERE ev_class=c.oid) AS safe
    FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY(ARRAY['models','api_channel_prices','model_slug_redirects','api_channel_price_variants','coding_agent_scores','evaluation_run','external_price_references','model_benchmark_scores','model_offical','model_plan_mapping','usage_prices','price_history','quota_estimates','usage_mixes','providers']::text[])
),
effects_raw AS (
WITH RECURSIVE roots(classid,objid) AS (
    SELECT 'pg_constraint'::regclass::oid,k.oid FROM pg_constraint k
      WHERE k.conrelid=ANY(SELECT c.oid FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY(ARRAY['models','api_channel_prices','model_slug_redirects']::text[]))
    UNION SELECT 'pg_class'::regclass::oid,i.indexrelid FROM pg_index i
      WHERE i.indrelid=ANY(SELECT c.oid FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY(ARRAY['models','api_channel_prices','model_slug_redirects','api_channel_price_variants','coding_agent_scores','evaluation_run','external_price_references','model_benchmark_scores','model_offical','model_plan_mapping','usage_prices','price_history','quota_estimates','usage_mixes','providers']::text[]))
    ), deps(classid,objid) AS (SELECT * FROM roots UNION
      SELECT d.refclassid,d.refobjid FROM deps x JOIN pg_depend d ON d.classid=x.classid AND d.objid=x.objid
      WHERE d.refclassid<>'pg_attrdef'::regclass AND d.refclassid<>'pg_class'::regclass)
    SELECT NOT EXISTS(SELECT 1 FROM deps x JOIN pg_proc p ON x.classid='pg_proc'::regclass AND x.objid=p.oid
      WHERE p.pronamespace<>'pg_catalog'::regnamespace) AS safe
),
columns_expected AS (SELECT value AS e FROM jsonb_array_elements('[{"table":"api_channel_prices","name":"id","type":"integer","nullable":false,"identity":"","generated":"","collation":""},{"table":"api_channel_prices","name":"model_id","type":"integer","nullable":true,"identity":"","generated":"","collation":""},{"table":"api_channel_prices","name":"input_price_per_1m","type":"real","nullable":true,"identity":"","generated":"","collation":""},{"table":"api_channel_prices","name":"output_price_per_1m","type":"real","nullable":true,"identity":"","generated":"","collation":""},{"table":"api_channel_prices","name":"cached_input_price_per_1m","type":"real","nullable":true,"identity":"","generated":"","collation":""},{"table":"api_channel_prices","name":"rate_limit","type":"integer","nullable":true,"identity":"","generated":"","collation":""},{"table":"api_channel_prices","name":"is_available","type":"boolean","nullable":true,"identity":"","generated":"","collation":""},{"table":"api_channel_prices","name":"last_verified","type":"timestamp with time zone","nullable":true,"identity":"","generated":"","collation":""},{"table":"api_channel_prices","name":"notes","type":"text","nullable":true,"identity":"","generated":"","collation":"default"},{"table":"api_channel_prices","name":"created_at","type":"timestamp with time zone","nullable":true,"identity":"","generated":"","collation":""},{"table":"api_channel_prices","name":"updated_at","type":"timestamp with time zone","nullable":true,"identity":"","generated":"","collation":""},{"table":"api_channel_prices","name":"currency","type":"character varying(3)","nullable":true,"identity":"","generated":"","collation":"default"},{"table":"api_channel_prices","name":"price_unit","type":"character varying(20)","nullable":true,"identity":"","generated":"","collation":"default"},{"table":"api_channel_prices","name":"provider_id","type":"integer","nullable":true,"identity":"","generated":"","collation":""},{"table":"api_channel_prices","name":"promo_ends_at","type":"timestamp with time zone","nullable":true,"identity":"","generated":"","collation":""},{"table":"api_channel_prices","name":"regular_input_price_per_1m","type":"real","nullable":true,"identity":"","generated":"","collation":""},{"table":"api_channel_prices","name":"regular_output_price_per_1m","type":"real","nullable":true,"identity":"","generated":"","collation":""},{"table":"api_channel_prices","name":"regular_cached_input_price_per_1m","type":"real","nullable":true,"identity":"","generated":"","collation":""},{"table":"api_channel_prices","name":"data_for_discount","type":"boolean","nullable":true,"identity":"","generated":"","collation":""},{"table":"api_channel_prices","name":"data_for_discount_note","type":"text","nullable":true,"identity":"","generated":"","collation":"default"},{"table":"api_channel_prices","name":"quota_unit","type":"text","nullable":true,"identity":"","generated":"","collation":"default"},{"table":"api_channel_prices","name":"availability_locked","type":"boolean","nullable":false,"identity":"","generated":"","collation":""},{"table":"model_slug_redirects","name":"old_slug","type":"text","nullable":false,"identity":"","generated":"","collation":"default"},{"table":"model_slug_redirects","name":"model_id","type":"integer","nullable":false,"identity":"","generated":"","collation":""},{"table":"model_slug_redirects","name":"reason","type":"text","nullable":true,"identity":"","generated":"","collation":"default"},{"table":"model_slug_redirects","name":"created_at","type":"timestamp with time zone","nullable":false,"identity":"","generated":"","collation":""},{"table":"models","name":"id","type":"integer","nullable":false,"identity":"","generated":"","collation":""},{"table":"models","name":"name","type":"text","nullable":false,"identity":"","generated":"","collation":"default"},{"table":"models","name":"slug","type":"text","nullable":false,"identity":"","generated":"","collation":"default"},{"table":"models","name":"type","type":"text","nullable":false,"identity":"","generated":"","collation":"default"},{"table":"models","name":"description","type":"text","nullable":true,"identity":"","generated":"","collation":"default"},{"table":"models","name":"context_window","type":"integer","nullable":true,"identity":"","generated":"","collation":""},{"table":"models","name":"released_at","type":"timestamp with time zone","nullable":true,"identity":"","generated":"","collation":""},{"table":"models","name":"created_at","type":"timestamp with time zone","nullable":true,"identity":"","generated":"","collation":""},{"table":"models","name":"updated_at","type":"timestamp with time zone","nullable":true,"identity":"","generated":"","collation":""},{"table":"models","name":"max_output_tokens","type":"bigint","nullable":true,"identity":"","generated":"","collation":""},{"table":"models","name":"open_source","type":"boolean","nullable":true,"identity":"","generated":"","collation":""},{"table":"models","name":"features","type":"text[]","nullable":true,"identity":"","generated":"","collation":"default"},{"table":"models","name":"offical_link","type":"text","nullable":true,"identity":"","generated":"","collation":"default"},{"table":"models","name":"input_type","type":"text[]","nullable":true,"identity":"","generated":"","collation":"default"},{"table":"models","name":"output_type","type":"text[]","nullable":true,"identity":"","generated":"","collation":"default"},{"table":"models","name":"parameters","type":"text","nullable":true,"identity":"","generated":"","collation":"default"},{"table":"models","name":"active parameters","type":"text","nullable":true,"identity":"","generated":"","collation":"default"},{"table":"models","name":"provider_ids","type":"integer[]","nullable":true,"identity":"","generated":"","collation":""},{"table":"models","name":"model_category","type":"text","nullable":false,"identity":"","generated":"","collation":"default"},{"table":"models","name":"input_modalities","type":"text[]","nullable":true,"identity":"","generated":"","collation":"default"},{"table":"models","name":"output_modalities","type":"text[]","nullable":true,"identity":"","generated":"","collation":"default"},{"table":"models","name":"capabilities","type":"text[]","nullable":true,"identity":"","generated":"","collation":"default"},{"table":"models","name":"pricing_unit","type":"text","nullable":true,"identity":"","generated":"","collation":"default"},{"table":"models","name":"shutdown_date","type":"date","nullable":true,"identity":"","generated":"","collation":""},{"table":"models","name":"replacement_model","type":"text","nullable":true,"identity":"","generated":"","collation":"default"},{"table":"models","name":"deprecation_source_url","type":"text","nullable":true,"identity":"","generated":"","collation":"default"},{"table":"models","name":"deprecated_at","type":"date","nullable":true,"identity":"","generated":"","collation":""},{"table":"models","name":"license","type":"text","nullable":true,"identity":"","generated":"","collation":"default"},{"table":"models","name":"license_url","type":"text","nullable":true,"identity":"","generated":"","collation":"default"},{"table":"api_channel_price_variants","name":"model_id","type":"integer","identity":"","generated":"","collation":"","nullable":true},{"table":"coding_agent_scores","name":"model_id","type":"integer","identity":"","generated":"","collation":"","nullable":true},{"table":"evaluation_run","name":"model_id","type":"integer","identity":"","generated":"","collation":"","nullable":true},{"table":"external_price_references","name":"model_id","type":"integer","identity":"","generated":"","collation":"","nullable":true},{"table":"model_benchmark_scores","name":"model_id","type":"integer","identity":"","generated":"","collation":"","nullable":true},{"table":"model_offical","name":"model_id","type":"integer","identity":"","generated":"","collation":"","nullable":true},{"table":"model_plan_mapping","name":"model_id","type":"integer","identity":"","generated":"","collation":"","nullable":true},{"table":"price_history","name":"id","type":"bigint","identity":"","generated":"","collation":"","nullable":false},{"table":"price_history","name":"channel_price_id","type":"integer","identity":"","generated":"","collation":"","nullable":false},{"table":"providers","name":"id","type":"integer","identity":"","generated":"","collation":"","nullable":false},{"table":"providers","name":"slug","type":"text","identity":"","generated":"","collation":"default","nullable":false},{"table":"quota_estimates","name":"id","type":"integer","identity":"","generated":"","collation":"","nullable":false},{"table":"quota_estimates","name":"plan_id","type":"integer","identity":"","generated":"","collation":"","nullable":true},{"table":"quota_estimates","name":"plan_slug","type":"text","identity":"","generated":"","collation":"default","nullable":false},{"table":"quota_estimates","name":"served_model","type":"text","identity":"","generated":"","collation":"default","nullable":true},{"table":"quota_estimates","name":"window","type":"text","identity":"","generated":"","collation":"default","nullable":false},{"table":"quota_estimates","name":"usage_mix_id","type":"text","identity":"","generated":"","collation":"default","nullable":false},{"table":"quota_estimates","name":"notes","type":"text","identity":"","generated":"","collation":"default","nullable":true},{"table":"quota_estimates","name":"is_current","type":"boolean","identity":"","generated":"","collation":"","nullable":false},{"table":"usage_mixes","name":"id","type":"text","identity":"","generated":"","collation":"default","nullable":false},{"table":"usage_mixes","name":"cache_read_pct","type":"numeric","identity":"","generated":"","collation":"","nullable":false},{"table":"usage_mixes","name":"input_pct","type":"numeric","identity":"","generated":"","collation":"","nullable":false},{"table":"usage_mixes","name":"output_pct","type":"numeric","identity":"","generated":"","collation":"","nullable":false},{"table":"usage_prices","name":"model_id","type":"integer","identity":"","generated":"","collation":"","nullable":true}]'::jsonb)),
columns_actual AS (SELECT to_jsonb(a) AS a FROM columns_raw a WHERE a."table"=ANY(ARRAY['models','api_channel_prices','model_slug_redirects']::text[]) OR EXISTS(SELECT 1 FROM columns_expected e WHERE e.e->>'table'=a."table" AND e.e->>'name'=a.name)),
constraints_expected AS (SELECT value AS e FROM jsonb_array_elements('[{"table":"api_channel_prices","name":"api_channel_prices_quota_unit_check","kind":"c","definition":"CHECK ((quota_unit = ANY (ARRAY[''usd''::text, ''requests''::text, ''tokens''::text, ''credits''::text])))"},{"table":"api_channel_prices","name":"channel_prices_currency_check","kind":"c","definition":"CHECK (((currency)::text = ANY ((ARRAY[''USD''::character varying, ''CNY''::character varying, ''EUR''::character varying, ''GBP''::character varying, ''JPY''::character varying, ''KRW''::character varying, ''SGD''::character varying])::text[])))"},{"table":"api_channel_prices","name":"channel_prices_model_id_fkey","kind":"f","definition":"FOREIGN KEY (model_id) REFERENCES models(id)"},{"table":"api_channel_prices","name":"channel_prices_pkey","kind":"p","definition":"PRIMARY KEY (id)"},{"table":"api_channel_prices","name":"channel_prices_provider_id_fkey","kind":"f","definition":"FOREIGN KEY (provider_id) REFERENCES providers(id)"},{"table":"model_slug_redirects","name":"model_slug_redirects_model_id_fkey","kind":"f","definition":"FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE"},{"table":"model_slug_redirects","name":"model_slug_redirects_pkey","kind":"p","definition":"PRIMARY KEY (old_slug)"},{"table":"models","name":"models_model_category_chk","kind":"c","definition":"CHECK ((model_category = ANY (ARRAY[''text''::text, ''image''::text, ''video''::text, ''audio''::text, ''music''::text, ''world''::text, ''embedding''::text, ''speech''::text, ''agent''::text, ''decision''::text])))"},{"table":"models","name":"models_pricing_unit_chk","kind":"c","definition":"CHECK ((pricing_unit = ANY (ARRAY[''per_1m_tokens''::text, ''per_second''::text, ''per_minute''::text, ''per_generation''::text, ''per_credit''::text, ''per_compute_hour''::text, ''subscription_only''::text, ''unknown''::text, ''per_hour''::text, ''per_megapixel''::text, ''per_image''::text, ''per_1k_characters''::text])))"},{"table":"models","name":"products_pkey","kind":"p","definition":"PRIMARY KEY (id)"},{"table":"models","name":"products_slug_key","kind":"u","definition":"UNIQUE (slug)"}]'::jsonb)),
constraints_actual AS (SELECT CASE WHEN a."table"='api_channel_prices' AND a.name='channel_prices_currency_check' AND a.definition='CHECK (((currency)::text = ANY (ARRAY[(''USD''::character varying)::text, (''CNY''::character varying)::text, (''EUR''::character varying)::text, (''GBP''::character varying)::text, (''JPY''::character varying)::text, (''KRW''::character varying)::text, (''SGD''::character varying)::text])))' THEN jsonb_set(to_jsonb(a),'{definition}',to_jsonb('CHECK (((currency)::text = ANY ((ARRAY[''USD''::character varying, ''CNY''::character varying, ''EUR''::character varying, ''GBP''::character varying, ''JPY''::character varying, ''KRW''::character varying, ''SGD''::character varying])::text[])))'::text)) ELSE to_jsonb(a) END AS a FROM constraints_raw a),
indexes_expected AS (SELECT value AS e FROM jsonb_array_elements('[{"table":"api_channel_prices","name":"channel_prices_pkey","definition":"CREATE UNIQUE INDEX channel_prices_pkey ON public.api_channel_prices USING btree (id)"},{"table":"api_channel_prices","name":"idx_channel_prices_currency","definition":"CREATE INDEX idx_channel_prices_currency ON public.api_channel_prices USING btree (currency)"},{"table":"api_channel_prices","name":"idx_channel_prices_last_verified","definition":"CREATE INDEX idx_channel_prices_last_verified ON public.api_channel_prices USING btree (last_verified DESC)"},{"table":"model_slug_redirects","name":"model_slug_redirects_pkey","definition":"CREATE UNIQUE INDEX model_slug_redirects_pkey ON public.model_slug_redirects USING btree (old_slug)"},{"table":"models","name":"models_model_category_idx","definition":"CREATE INDEX models_model_category_idx ON public.models USING btree (model_category, slug)"},{"table":"models","name":"products_pkey","definition":"CREATE UNIQUE INDEX products_pkey ON public.models USING btree (id)"},{"table":"models","name":"products_slug_key","definition":"CREATE UNIQUE INDEX products_slug_key ON public.models USING btree (slug)"},{"table":"api_channel_price_variants","name":"api_channel_price_variants_headline_idx","definition":"CREATE INDEX api_channel_price_variants_headline_idx ON public.api_channel_price_variants USING btree (provider_id, model_id) WHERE (is_headline = true)"},{"table":"api_channel_price_variants","name":"api_channel_price_variants_one_headline_idx","definition":"CREATE UNIQUE INDEX api_channel_price_variants_one_headline_idx ON public.api_channel_price_variants USING btree (provider_id, model_id) WHERE ((is_headline = true) AND (is_available = true))"},{"table":"api_channel_price_variants","name":"api_channel_price_variants_pkey","definition":"CREATE UNIQUE INDEX api_channel_price_variants_pkey ON public.api_channel_price_variants USING btree (id)"},{"table":"api_channel_price_variants","name":"api_channel_price_variants_provider_id_model_id_variant_key_key","definition":"CREATE UNIQUE INDEX api_channel_price_variants_provider_id_model_id_variant_key_key ON public.api_channel_price_variants USING btree (provider_id, model_id, variant_key)"},{"table":"api_channel_price_variants","name":"api_channel_price_variants_provider_model_idx","definition":"CREATE INDEX api_channel_price_variants_provider_model_idx ON public.api_channel_price_variants USING btree (provider_id, model_id)"},{"table":"api_channel_price_variants","name":"api_channel_price_variants_provider_model_key_idx","definition":"CREATE UNIQUE INDEX api_channel_price_variants_provider_model_key_idx ON public.api_channel_price_variants USING btree (provider_id, model_id, variant_key)"},{"table":"api_channel_price_variants","name":"api_channel_price_variants_verified_idx","definition":"CREATE INDEX api_channel_price_variants_verified_idx ON public.api_channel_price_variants USING btree (last_verified DESC)"},{"table":"coding_agent_scores","name":"coding_agent_scores_model_idx","definition":"CREATE INDEX coding_agent_scores_model_idx ON public.coding_agent_scores USING btree (model_id)"},{"table":"coding_agent_scores","name":"coding_agent_scores_pkey","definition":"CREATE UNIQUE INDEX coding_agent_scores_pkey ON public.coding_agent_scores USING btree (id)"},{"table":"coding_agent_scores","name":"coding_agent_scores_rank_idx","definition":"CREATE INDEX coding_agent_scores_rank_idx ON public.coding_agent_scores USING btree (index_score DESC) WHERE (is_unavailable IS NOT TRUE)"},{"table":"coding_agent_scores","name":"coding_agent_scores_source_record_id_key","definition":"CREATE UNIQUE INDEX coding_agent_scores_source_record_id_key ON public.coding_agent_scores USING btree (source_record_id)"},{"table":"evaluation_run","name":"evaluation_run_pkey","definition":"CREATE UNIQUE INDEX evaluation_run_pkey ON public.evaluation_run USING btree (id)"},{"table":"external_price_references","name":"ext_price_refs_model_idx","definition":"CREATE INDEX ext_price_refs_model_idx ON public.external_price_references USING btree (model_id)"},{"table":"external_price_references","name":"ext_price_refs_observed_idx","definition":"CREATE INDEX ext_price_refs_observed_idx ON public.external_price_references USING btree (source, observed_date)"},{"table":"external_price_references","name":"external_price_references_pkey","definition":"CREATE UNIQUE INDEX external_price_references_pkey ON public.external_price_references USING btree (id)"},{"table":"external_price_references","name":"external_price_references_source_source_model_slug_key","definition":"CREATE UNIQUE INDEX external_price_references_source_source_model_slug_key ON public.external_price_references USING btree (source, source_model_slug)"},{"table":"model_benchmark_scores","name":"model_bench_scores_pkey","definition":"CREATE UNIQUE INDEX model_bench_scores_pkey ON public.model_benchmark_scores USING btree (id)"},{"table":"model_offical","name":"model_offical_pkey","definition":"CREATE UNIQUE INDEX model_offical_pkey ON public.model_offical USING btree (id)"},{"table":"model_plan_mapping","name":"model_plan_mapping_model_id_plan_id_key","definition":"CREATE UNIQUE INDEX model_plan_mapping_model_id_plan_id_key ON public.model_plan_mapping USING btree (model_id, plan_id)"},{"table":"model_plan_mapping","name":"model_plan_mapping_pkey","definition":"CREATE UNIQUE INDEX model_plan_mapping_pkey ON public.model_plan_mapping USING btree (id)"},{"table":"model_plan_mapping","name":"model_plan_mapping_uniq","definition":"CREATE UNIQUE INDEX model_plan_mapping_uniq ON public.model_plan_mapping USING btree (plan_id, model_id)"},{"table":"price_history","name":"idx_price_history_channel_price_id","definition":"CREATE INDEX idx_price_history_channel_price_id ON public.price_history USING btree (channel_price_id)"},{"table":"price_history","name":"idx_price_history_recorded_at","definition":"CREATE INDEX idx_price_history_recorded_at ON public.price_history USING btree (recorded_at DESC)"},{"table":"price_history","name":"price_history_pkey","definition":"CREATE UNIQUE INDEX price_history_pkey ON public.price_history USING btree (id)"},{"table":"providers","name":"providers_pkey","definition":"CREATE UNIQUE INDEX providers_pkey ON public.providers USING btree (id)"},{"table":"providers","name":"providers_slug_key","definition":"CREATE UNIQUE INDEX providers_slug_key ON public.providers USING btree (slug)"},{"table":"quota_estimates","name":"quota_estimates_current_idx","definition":"CREATE UNIQUE INDEX quota_estimates_current_idx ON public.quota_estimates USING btree (plan_slug, COALESCE(served_model, ''''::text), \"window\", usage_mix_id) WHERE is_current"},{"table":"quota_estimates","name":"quota_estimates_history_idx","definition":"CREATE INDEX quota_estimates_history_idx ON public.quota_estimates USING btree (plan_slug, created_at DESC)"},{"table":"quota_estimates","name":"quota_estimates_pkey","definition":"CREATE UNIQUE INDEX quota_estimates_pkey ON public.quota_estimates USING btree (id)"},{"table":"usage_mixes","name":"usage_mixes_pkey","definition":"CREATE UNIQUE INDEX usage_mixes_pkey ON public.usage_mixes USING btree (id)"},{"table":"usage_prices","name":"usage_prices_model_provider_idx","definition":"CREATE INDEX usage_prices_model_provider_idx ON public.usage_prices USING btree (model_id, provider_id, price_kind)"},{"table":"usage_prices","name":"usage_prices_pkey","definition":"CREATE UNIQUE INDEX usage_prices_pkey ON public.usage_prices USING btree (id)"},{"table":"usage_prices","name":"usage_prices_plan_idx","definition":"CREATE INDEX usage_prices_plan_idx ON public.usage_prices USING btree (plan_id, price_kind)"}]'::jsonb)),
indexes_actual AS (SELECT to_jsonb(a) AS a FROM indexes_raw a),
incoming_expected AS (SELECT value AS e FROM jsonb_array_elements('[{"table":"api_channel_price_variants","name":"api_channel_price_variants_model_id_fkey","kind":"f","definition":"FOREIGN KEY (model_id) REFERENCES models(id)","target":"models"},{"table":"api_channel_prices","name":"channel_prices_model_id_fkey","kind":"f","definition":"FOREIGN KEY (model_id) REFERENCES models(id)","target":"models"},{"table":"coding_agent_scores","name":"coding_agent_scores_model_id_fkey","kind":"f","definition":"FOREIGN KEY (model_id) REFERENCES models(id)","target":"models"},{"table":"evaluation_run","name":"evaluation_run_model_id_fkey","kind":"f","definition":"FOREIGN KEY (model_id) REFERENCES models(id)","target":"models"},{"table":"external_price_references","name":"external_price_references_model_id_fkey","kind":"f","definition":"FOREIGN KEY (model_id) REFERENCES models(id)","target":"models"},{"table":"model_benchmark_scores","name":"model_bench_scores_model_id_fkey","kind":"f","definition":"FOREIGN KEY (model_id) REFERENCES models(id)","target":"models"},{"table":"model_offical","name":"model_offical_model_id_fkey","kind":"f","definition":"FOREIGN KEY (model_id) REFERENCES models(id)","target":"models"},{"table":"model_plan_mapping","name":"model_plan_mapping_model_id_fkey","kind":"f","definition":"FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE","target":"models"},{"table":"model_slug_redirects","name":"model_slug_redirects_model_id_fkey","kind":"f","definition":"FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE","target":"models"},{"table":"usage_prices","name":"usage_prices_model_id_fkey","kind":"f","definition":"FOREIGN KEY (model_id) REFERENCES models(id)","target":"models"}]'::jsonb)),
incoming_actual AS (SELECT to_jsonb(a) AS a FROM incoming_raw a),
checks AS (SELECT (NOT EXISTS(SELECT 1 FROM columns_expected e WHERE (SELECT count(*) FROM columns_actual a WHERE a.a=e.e || '{"safe":true}'::jsonb)<>1) AND NOT EXISTS(SELECT 1 FROM columns_actual a WHERE NOT EXISTS(SELECT 1 FROM columns_expected e WHERE a.a=e.e || '{"safe":true}'::jsonb))) AS columns_ok,
(NOT EXISTS(SELECT 1 FROM constraints_expected e WHERE (SELECT count(*) FROM constraints_actual a WHERE a.a=e.e || '{"safe":true}'::jsonb)<>1) AND NOT EXISTS(SELECT 1 FROM constraints_actual a WHERE NOT EXISTS(SELECT 1 FROM constraints_expected e WHERE a.a=e.e || '{"safe":true}'::jsonb))) AS constraints_ok,
(NOT EXISTS(SELECT 1 FROM indexes_expected e WHERE (SELECT count(*) FROM indexes_actual a WHERE a.a=e.e || '{"safe":true}'::jsonb)<>1) AND NOT EXISTS(SELECT 1 FROM indexes_actual a WHERE NOT EXISTS(SELECT 1 FROM indexes_expected e WHERE a.a=e.e || '{"safe":true}'::jsonb))) AS indexes_ok,
(NOT EXISTS(SELECT 1 FROM incoming_expected e WHERE (SELECT count(*) FROM incoming_actual a WHERE a.a=e.e || '{"safe":true}'::jsonb)<>1) AND NOT EXISTS(SELECT 1 FROM incoming_actual a WHERE NOT EXISTS(SELECT 1 FROM incoming_expected e WHERE a.a=e.e || '{"safe":true}'::jsonb))) AS incoming_ok,
(SELECT count(*)=15 AND bool_and(safe) FROM relations_raw) AS relations_ok,
(SELECT safe FROM effects_raw) AS effects_ok)
SELECT *, (columns_ok AND constraints_ok AND indexes_ok AND incoming_ok AND relations_ok AND effects_ok) AS structure_ok FROM checks \gset o3_
\echo columns :o3_columns_ok
\echo constraints :o3_constraints_ok
\echo indexes :o3_indexes_ok
\echo incoming :o3_incoming_ok
\echo relations :o3_relations_ok
\echo effects :o3_effects_ok
\echo structure :o3_structure_ok
\if :o3_structure_ok
\else
  ROLLBACK;
  \quit 3
\endif
-- Only audited builtin types/operators and known structure may reach row reads.
SELECT 'source_reference.api_channel_price_variants' AS object_label,count(*) AS row_count FROM public."api_channel_price_variants" WHERE model_id=3014
UNION ALL
SELECT 'source_reference.api_channel_prices' AS object_label,count(*) AS row_count FROM public."api_channel_prices" WHERE model_id=3014
UNION ALL
SELECT 'source_reference.coding_agent_scores' AS object_label,count(*) AS row_count FROM public."coding_agent_scores" WHERE model_id=3014
UNION ALL
SELECT 'source_reference.evaluation_run' AS object_label,count(*) AS row_count FROM public."evaluation_run" WHERE model_id=3014
UNION ALL
SELECT 'source_reference.external_price_references' AS object_label,count(*) AS row_count FROM public."external_price_references" WHERE model_id=3014
UNION ALL
SELECT 'source_reference.model_benchmark_scores' AS object_label,count(*) AS row_count FROM public."model_benchmark_scores" WHERE model_id=3014
UNION ALL
SELECT 'source_reference.model_offical' AS object_label,count(*) AS row_count FROM public."model_offical" WHERE model_id=3014
UNION ALL
SELECT 'source_reference.model_plan_mapping' AS object_label,count(*) AS row_count FROM public."model_plan_mapping" WHERE model_id=3014
UNION ALL
SELECT 'source_reference.model_slug_redirects' AS object_label,count(*) AS row_count FROM public."model_slug_redirects" WHERE model_id=3014
UNION ALL
SELECT 'source_reference.usage_prices' AS object_label,count(*) AS row_count FROM public."usage_prices" WHERE model_id=3014;
SELECT
 (SELECT count(*) FROM public.models WHERE id IN (3014,3192) OR slug IN ('o3-(batch)','openai-o3-batch'))=2
 AND (SELECT count(*)=2 AND bool_and(CASE id WHEN 3014 THEN slug='o3-(batch)' WHEN 3192 THEN slug='openai-o3-batch' ELSE false END) FROM public.models WHERE id IN (3014,3192))
 AND (SELECT count(*)=2 AND bool_and(coalesce(provider_id=59 AND CASE id WHEN 15031 THEN model_id=3014 AND is_available=false WHEN 15334 THEN model_id=3192 AND is_available=true ELSE false END,false))
 FROM public.api_channel_prices WHERE id IN (15031,15334) OR model_id IN (3014,3192))
 AND (SELECT count(*)=1 AND bool_and(slug='openrouter') FROM public.providers WHERE id=59)
 AND NOT EXISTS(SELECT 1 FROM public.model_slug_redirects WHERE old_slug IN ('o3-(batch)','openai-o3-batch') OR model_id IN (3014,3192))
 AND NOT EXISTS(SELECT 1 FROM public.price_history WHERE channel_price_id=15031)
 AND NOT EXISTS(SELECT 1 FROM public."api_channel_price_variants" WHERE model_id=3014)
 AND NOT EXISTS(SELECT 1 FROM public."coding_agent_scores" WHERE model_id=3014)
 AND NOT EXISTS(SELECT 1 FROM public."evaluation_run" WHERE model_id=3014)
 AND NOT EXISTS(SELECT 1 FROM public."external_price_references" WHERE model_id=3014)
 AND NOT EXISTS(SELECT 1 FROM public."model_benchmark_scores" WHERE model_id=3014)
 AND NOT EXISTS(SELECT 1 FROM public."model_offical" WHERE model_id=3014)
 AND NOT EXISTS(SELECT 1 FROM public."model_plan_mapping" WHERE model_id=3014)
 AND NOT EXISTS(SELECT 1 FROM public."model_slug_redirects" WHERE model_id=3014)
 AND NOT EXISTS(SELECT 1 FROM public."usage_prices" WHERE model_id=3014)
 AS pair_ok \gset o3_
\echo pair :o3_pair_ok
SELECT 'pair.third_offer' AS object_label,count(*) AS row_count FROM public.api_channel_prices
 WHERE model_id IN (3014,3192) AND id NOT IN (15031,15334)
UNION ALL SELECT 'pair.redirect_collision',count(*) FROM public.model_slug_redirects
 WHERE old_slug IN ('o3-(batch)','openai-o3-batch') OR model_id IN (3014,3192)
UNION ALL SELECT 'source_channel.history',count(*) FROM public.price_history WHERE channel_price_id=15031
UNION ALL SELECT 'target_channel.history',count(*) FROM public.price_history WHERE channel_price_id=15334;
\if :o3_pair_ok
\else
  ROLLBACK;
  \quit 3
\endif
-- Notes never leave DB, including unknown values/digests. JSON syntax is checked
-- before a cast; only exact public source ID and prelisted kind/version classify.
WITH scoped AS (
 SELECT is_current,served_model,plan_id,plan_slug,"window",usage_mix_id,
 CASE WHEN notes IS JSON OBJECT THEN notes::jsonb ELSE NULL END AS note
 FROM public.quota_estimates WHERE served_model IN ('o3-(batch)','openai-o3-batch')
), checked AS (
 SELECT *,coalesce(note->>'kind'='payg-list-price' AND note->'version'='1'::jsonb,false) AS known_kind,
 coalesce(note #> '{source,api_channel_price_id}'='15334'::jsonb,false) AS source15334
 FROM scoped
)
SELECT coalesce(bool_and(known_kind),false) AND count(*) FILTER(WHERE served_model='o3-(batch)')=0
 AND count(*) FILTER(WHERE served_model='openai-o3-batch' AND is_current)=2
 AND count(DISTINCT usage_mix_id) FILTER(WHERE served_model='openai-o3-batch' AND is_current)=2
 AND coalesce(bool_and(coalesce(plan_id IS NULL AND plan_slug='payg:openrouter' AND "window"='monthly'
 AND usage_mix_id IN ('coding-high-cache','chat') AND source15334 AND known_kind,false))
 FILTER(WHERE served_model='openai-o3-batch' AND is_current),false) AS quota_rows_ok,
 count(*) FILTER(WHERE served_model='o3-(batch)') AS old_label_count,
 count(*) FILTER(WHERE served_model='openai-o3-batch' AND is_current) AS canonical_current_count,
 count(*) FILTER(WHERE is_current AND NOT known_kind) AS current_unknown_kind_count,
 count(*) FILTER(WHERE is_current AND NOT source15334) AS current_wrong_source_count,
 CASE WHEN coalesce(bool_and(known_kind),false) THEN 'known_payg_list_price_v1' ELSE 'unknown_no_export' END AS notes_class
 FROM checked \gset o3_
\echo quota_rows :o3_quota_rows_ok old_label :o3_old_label_count canonical_current :o3_canonical_current_count current_unknown_kind :o3_current_unknown_kind_count current_wrong_source :o3_current_wrong_source_count notes_class :o3_notes_class
\if :o3_quota_rows_ok
\else
  ROLLBACK;
  \quit 3
\endif
SELECT count(*)=2 AND bool_and(coalesce(CASE id
 WHEN 'coding-high-cache' THEN cache_read_pct=97 AND input_pct=2.5 AND output_pct=0.5
 WHEN 'chat' THEN cache_read_pct=0 AND input_pct=75 AND output_pct=25 ELSE false END,false)) AS mixes_ok
 FROM public.usage_mixes WHERE id IN ('coding-high-cache','chat') \gset o3_
\echo mixes :o3_mixes_ok
\if :o3_mixes_ok
\else
  ROLLBACK;
  \quit 3
\endif
-- Historical baseline only. Absent/changed metadata forces a new explicit reviewed baseline.
SELECT 'model3192.id' AS object_label,CASE WHEN coalesce((SELECT "id" IS NOT DISTINCT FROM '3192'::integer FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."id" IS NOT DISTINCT FROM t."id" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.name' AS object_label,CASE WHEN coalesce((SELECT "name" IS NOT DISTINCT FROM 'o3-batch'::text FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."name" IS NOT DISTINCT FROM t."name" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.slug' AS object_label,CASE WHEN coalesce((SELECT "slug" IS NOT DISTINCT FROM 'openai-o3-batch'::text FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."slug" IS NOT DISTINCT FROM t."slug" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.type' AS object_label,CASE WHEN coalesce((SELECT "type" IS NOT DISTINCT FROM 'llm'::text FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."type" IS NOT DISTINCT FROM t."type" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.description' AS object_label,'not_prelisted_stop'::text AS expected_class,coalesce((SELECT s."description" IS NOT DISTINCT FROM t."description" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.context_window' AS object_label,CASE WHEN coalesce((SELECT "context_window" IS NOT DISTINCT FROM '200000'::integer FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."context_window" IS NOT DISTINCT FROM t."context_window" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.released_at' AS object_label,CASE WHEN coalesce((SELECT "released_at" IS NOT DISTINCT FROM '2025-04-16T17:10:57+00:00'::timestamp with time zone FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."released_at" IS NOT DISTINCT FROM t."released_at" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.created_at' AS object_label,'not_prelisted_stop'::text AS expected_class,coalesce((SELECT s."created_at" IS NOT DISTINCT FROM t."created_at" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.updated_at' AS object_label,CASE WHEN coalesce((SELECT "updated_at" IS NOT DISTINCT FROM '2026-09-11T02:12:53.407+00:00'::timestamp with time zone FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."updated_at" IS NOT DISTINCT FROM t."updated_at" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.max_output_tokens' AS object_label,CASE WHEN coalesce((SELECT "max_output_tokens" IS NOT DISTINCT FROM NULL::bigint FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."max_output_tokens" IS NOT DISTINCT FROM t."max_output_tokens" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.open_source' AS object_label,CASE WHEN coalesce((SELECT "open_source" IS NOT DISTINCT FROM NULL::boolean FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."open_source" IS NOT DISTINCT FROM t."open_source" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.features' AS object_label,CASE WHEN coalesce((SELECT "features" IS NOT DISTINCT FROM NULL::text[] FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."features" IS NOT DISTINCT FROM t."features" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.offical_link' AS object_label,'not_prelisted_stop'::text AS expected_class,coalesce((SELECT s."offical_link" IS NOT DISTINCT FROM t."offical_link" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.input_type' AS object_label,CASE WHEN coalesce((SELECT "input_type" IS NOT DISTINCT FROM NULL::text[] FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."input_type" IS NOT DISTINCT FROM t."input_type" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.output_type' AS object_label,CASE WHEN coalesce((SELECT "output_type" IS NOT DISTINCT FROM NULL::text[] FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."output_type" IS NOT DISTINCT FROM t."output_type" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.parameters' AS object_label,CASE WHEN coalesce((SELECT "parameters" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."parameters" IS NOT DISTINCT FROM t."parameters" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.active parameters' AS object_label,CASE WHEN coalesce((SELECT "active parameters" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."active parameters" IS NOT DISTINCT FROM t."active parameters" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.provider_ids' AS object_label,CASE WHEN coalesce((SELECT "provider_ids" IS NOT DISTINCT FROM ARRAY['33']::integer[] FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."provider_ids" IS NOT DISTINCT FROM t."provider_ids" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.model_category' AS object_label,CASE WHEN coalesce((SELECT "model_category" IS NOT DISTINCT FROM 'text'::text FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."model_category" IS NOT DISTINCT FROM t."model_category" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.input_modalities' AS object_label,CASE WHEN coalesce((SELECT "input_modalities" IS NOT DISTINCT FROM ARRAY[]::text[] FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."input_modalities" IS NOT DISTINCT FROM t."input_modalities" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.output_modalities' AS object_label,CASE WHEN coalesce((SELECT "output_modalities" IS NOT DISTINCT FROM ARRAY[]::text[] FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."output_modalities" IS NOT DISTINCT FROM t."output_modalities" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.capabilities' AS object_label,CASE WHEN coalesce((SELECT "capabilities" IS NOT DISTINCT FROM ARRAY[]::text[] FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."capabilities" IS NOT DISTINCT FROM t."capabilities" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.pricing_unit' AS object_label,CASE WHEN coalesce((SELECT "pricing_unit" IS NOT DISTINCT FROM 'per_1m_tokens'::text FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."pricing_unit" IS NOT DISTINCT FROM t."pricing_unit" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.shutdown_date' AS object_label,CASE WHEN coalesce((SELECT "shutdown_date" IS NOT DISTINCT FROM NULL::date FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."shutdown_date" IS NOT DISTINCT FROM t."shutdown_date" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.replacement_model' AS object_label,CASE WHEN coalesce((SELECT "replacement_model" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."replacement_model" IS NOT DISTINCT FROM t."replacement_model" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.deprecation_source_url' AS object_label,CASE WHEN coalesce((SELECT "deprecation_source_url" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."deprecation_source_url" IS NOT DISTINCT FROM t."deprecation_source_url" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.deprecated_at' AS object_label,CASE WHEN coalesce((SELECT "deprecated_at" IS NOT DISTINCT FROM NULL::date FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."deprecated_at" IS NOT DISTINCT FROM t."deprecated_at" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.license' AS object_label,CASE WHEN coalesce((SELECT "license" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."license" IS NOT DISTINCT FROM t."license" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3192.license_url' AS object_label,CASE WHEN coalesce((SELECT "license_url" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3192),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."license_url" IS NOT DISTINCT FROM t."license_url" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.id' AS object_label,CASE WHEN coalesce((SELECT "id" IS NOT DISTINCT FROM '3014'::integer FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."id" IS NOT DISTINCT FROM t."id" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.name' AS object_label,CASE WHEN coalesce((SELECT "name" IS NOT DISTINCT FROM 'o3-(batch)'::text FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."name" IS NOT DISTINCT FROM t."name" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.slug' AS object_label,CASE WHEN coalesce((SELECT "slug" IS NOT DISTINCT FROM 'o3-(batch)'::text FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."slug" IS NOT DISTINCT FROM t."slug" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.type' AS object_label,CASE WHEN coalesce((SELECT "type" IS NOT DISTINCT FROM 'llm'::text FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."type" IS NOT DISTINCT FROM t."type" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.description' AS object_label,'not_prelisted_stop'::text AS expected_class,coalesce((SELECT s."description" IS NOT DISTINCT FROM t."description" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.context_window' AS object_label,CASE WHEN coalesce((SELECT "context_window" IS NOT DISTINCT FROM '200000'::integer FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."context_window" IS NOT DISTINCT FROM t."context_window" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.released_at' AS object_label,CASE WHEN coalesce((SELECT "released_at" IS NOT DISTINCT FROM '2025-04-16T17:10:57+00:00'::timestamp with time zone FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."released_at" IS NOT DISTINCT FROM t."released_at" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.created_at' AS object_label,'not_prelisted_stop'::text AS expected_class,coalesce((SELECT s."created_at" IS NOT DISTINCT FROM t."created_at" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.updated_at' AS object_label,CASE WHEN coalesce((SELECT "updated_at" IS NOT DISTINCT FROM '2026-09-03T19:22:05.769+00:00'::timestamp with time zone FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."updated_at" IS NOT DISTINCT FROM t."updated_at" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.max_output_tokens' AS object_label,CASE WHEN coalesce((SELECT "max_output_tokens" IS NOT DISTINCT FROM NULL::bigint FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."max_output_tokens" IS NOT DISTINCT FROM t."max_output_tokens" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.open_source' AS object_label,CASE WHEN coalesce((SELECT "open_source" IS NOT DISTINCT FROM NULL::boolean FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."open_source" IS NOT DISTINCT FROM t."open_source" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.features' AS object_label,CASE WHEN coalesce((SELECT "features" IS NOT DISTINCT FROM NULL::text[] FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."features" IS NOT DISTINCT FROM t."features" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.offical_link' AS object_label,'not_prelisted_stop'::text AS expected_class,coalesce((SELECT s."offical_link" IS NOT DISTINCT FROM t."offical_link" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.input_type' AS object_label,CASE WHEN coalesce((SELECT "input_type" IS NOT DISTINCT FROM NULL::text[] FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."input_type" IS NOT DISTINCT FROM t."input_type" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.output_type' AS object_label,CASE WHEN coalesce((SELECT "output_type" IS NOT DISTINCT FROM NULL::text[] FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."output_type" IS NOT DISTINCT FROM t."output_type" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.parameters' AS object_label,CASE WHEN coalesce((SELECT "parameters" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."parameters" IS NOT DISTINCT FROM t."parameters" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.active parameters' AS object_label,CASE WHEN coalesce((SELECT "active parameters" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."active parameters" IS NOT DISTINCT FROM t."active parameters" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.provider_ids' AS object_label,CASE WHEN coalesce((SELECT "provider_ids" IS NOT DISTINCT FROM ARRAY['33']::integer[] FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."provider_ids" IS NOT DISTINCT FROM t."provider_ids" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.model_category' AS object_label,CASE WHEN coalesce((SELECT "model_category" IS NOT DISTINCT FROM 'text'::text FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."model_category" IS NOT DISTINCT FROM t."model_category" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.input_modalities' AS object_label,CASE WHEN coalesce((SELECT "input_modalities" IS NOT DISTINCT FROM ARRAY[]::text[] FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."input_modalities" IS NOT DISTINCT FROM t."input_modalities" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.output_modalities' AS object_label,CASE WHEN coalesce((SELECT "output_modalities" IS NOT DISTINCT FROM ARRAY[]::text[] FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."output_modalities" IS NOT DISTINCT FROM t."output_modalities" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.capabilities' AS object_label,CASE WHEN coalesce((SELECT "capabilities" IS NOT DISTINCT FROM ARRAY[]::text[] FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."capabilities" IS NOT DISTINCT FROM t."capabilities" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.pricing_unit' AS object_label,CASE WHEN coalesce((SELECT "pricing_unit" IS NOT DISTINCT FROM 'per_1m_tokens'::text FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."pricing_unit" IS NOT DISTINCT FROM t."pricing_unit" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.shutdown_date' AS object_label,CASE WHEN coalesce((SELECT "shutdown_date" IS NOT DISTINCT FROM NULL::date FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."shutdown_date" IS NOT DISTINCT FROM t."shutdown_date" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.replacement_model' AS object_label,CASE WHEN coalesce((SELECT "replacement_model" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."replacement_model" IS NOT DISTINCT FROM t."replacement_model" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.deprecation_source_url' AS object_label,CASE WHEN coalesce((SELECT "deprecation_source_url" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."deprecation_source_url" IS NOT DISTINCT FROM t."deprecation_source_url" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.deprecated_at' AS object_label,CASE WHEN coalesce((SELECT "deprecated_at" IS NOT DISTINCT FROM NULL::date FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."deprecated_at" IS NOT DISTINCT FROM t."deprecated_at" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.license' AS object_label,CASE WHEN coalesce((SELECT "license" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."license" IS NOT DISTINCT FROM t."license" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal
UNION ALL
SELECT 'model3014.license_url' AS object_label,CASE WHEN coalesce((SELECT "license_url" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3014),false) THEN 'matches_prelisted' ELSE 'different_stop' END AS expected_class,coalesce((SELECT s."license_url" IS NOT DISTINCT FROM t."license_url" FROM public.models s CROSS JOIN public.models t WHERE s.id=3014 AND t.id=3192),false) AS pair_equal;
SELECT coalesce((SELECT "id" IS NOT DISTINCT FROM '3192'::integer FROM public.models WHERE id=3192),false)
 AND coalesce((SELECT "name" IS NOT DISTINCT FROM 'o3-batch'::text FROM public.models WHERE id=3192),false)
 AND coalesce((SELECT "slug" IS NOT DISTINCT FROM 'openai-o3-batch'::text FROM public.models WHERE id=3192),false)
 AND coalesce((SELECT "type" IS NOT DISTINCT FROM 'llm'::text FROM public.models WHERE id=3192),false)
 AND false
 AND coalesce((SELECT "context_window" IS NOT DISTINCT FROM '200000'::integer FROM public.models WHERE id=3192),false)
 AND coalesce((SELECT "released_at" IS NOT DISTINCT FROM '2025-04-16T17:10:57+00:00'::timestamp with time zone FROM public.models WHERE id=3192),false)
 AND false
 AND coalesce((SELECT "updated_at" IS NOT DISTINCT FROM '2026-09-11T02:12:53.407+00:00'::timestamp with time zone FROM public.models WHERE id=3192),false)
 AND coalesce((SELECT "max_output_tokens" IS NOT DISTINCT FROM NULL::bigint FROM public.models WHERE id=3192),false)
 AND coalesce((SELECT "open_source" IS NOT DISTINCT FROM NULL::boolean FROM public.models WHERE id=3192),false)
 AND coalesce((SELECT "features" IS NOT DISTINCT FROM NULL::text[] FROM public.models WHERE id=3192),false)
 AND false
 AND coalesce((SELECT "input_type" IS NOT DISTINCT FROM NULL::text[] FROM public.models WHERE id=3192),false)
 AND coalesce((SELECT "output_type" IS NOT DISTINCT FROM NULL::text[] FROM public.models WHERE id=3192),false)
 AND coalesce((SELECT "parameters" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3192),false)
 AND coalesce((SELECT "active parameters" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3192),false)
 AND coalesce((SELECT "provider_ids" IS NOT DISTINCT FROM ARRAY['33']::integer[] FROM public.models WHERE id=3192),false)
 AND coalesce((SELECT "model_category" IS NOT DISTINCT FROM 'text'::text FROM public.models WHERE id=3192),false)
 AND coalesce((SELECT "input_modalities" IS NOT DISTINCT FROM ARRAY[]::text[] FROM public.models WHERE id=3192),false)
 AND coalesce((SELECT "output_modalities" IS NOT DISTINCT FROM ARRAY[]::text[] FROM public.models WHERE id=3192),false)
 AND coalesce((SELECT "capabilities" IS NOT DISTINCT FROM ARRAY[]::text[] FROM public.models WHERE id=3192),false)
 AND coalesce((SELECT "pricing_unit" IS NOT DISTINCT FROM 'per_1m_tokens'::text FROM public.models WHERE id=3192),false)
 AND coalesce((SELECT "shutdown_date" IS NOT DISTINCT FROM NULL::date FROM public.models WHERE id=3192),false)
 AND coalesce((SELECT "replacement_model" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3192),false)
 AND coalesce((SELECT "deprecation_source_url" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3192),false)
 AND coalesce((SELECT "deprecated_at" IS NOT DISTINCT FROM NULL::date FROM public.models WHERE id=3192),false)
 AND coalesce((SELECT "license" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3192),false)
 AND coalesce((SELECT "license_url" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3192),false)
 AND coalesce((SELECT "id" IS NOT DISTINCT FROM '3014'::integer FROM public.models WHERE id=3014),false)
 AND coalesce((SELECT "name" IS NOT DISTINCT FROM 'o3-(batch)'::text FROM public.models WHERE id=3014),false)
 AND coalesce((SELECT "slug" IS NOT DISTINCT FROM 'o3-(batch)'::text FROM public.models WHERE id=3014),false)
 AND coalesce((SELECT "type" IS NOT DISTINCT FROM 'llm'::text FROM public.models WHERE id=3014),false)
 AND false
 AND coalesce((SELECT "context_window" IS NOT DISTINCT FROM '200000'::integer FROM public.models WHERE id=3014),false)
 AND coalesce((SELECT "released_at" IS NOT DISTINCT FROM '2025-04-16T17:10:57+00:00'::timestamp with time zone FROM public.models WHERE id=3014),false)
 AND false
 AND coalesce((SELECT "updated_at" IS NOT DISTINCT FROM '2026-09-03T19:22:05.769+00:00'::timestamp with time zone FROM public.models WHERE id=3014),false)
 AND coalesce((SELECT "max_output_tokens" IS NOT DISTINCT FROM NULL::bigint FROM public.models WHERE id=3014),false)
 AND coalesce((SELECT "open_source" IS NOT DISTINCT FROM NULL::boolean FROM public.models WHERE id=3014),false)
 AND coalesce((SELECT "features" IS NOT DISTINCT FROM NULL::text[] FROM public.models WHERE id=3014),false)
 AND false
 AND coalesce((SELECT "input_type" IS NOT DISTINCT FROM NULL::text[] FROM public.models WHERE id=3014),false)
 AND coalesce((SELECT "output_type" IS NOT DISTINCT FROM NULL::text[] FROM public.models WHERE id=3014),false)
 AND coalesce((SELECT "parameters" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3014),false)
 AND coalesce((SELECT "active parameters" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3014),false)
 AND coalesce((SELECT "provider_ids" IS NOT DISTINCT FROM ARRAY['33']::integer[] FROM public.models WHERE id=3014),false)
 AND coalesce((SELECT "model_category" IS NOT DISTINCT FROM 'text'::text FROM public.models WHERE id=3014),false)
 AND coalesce((SELECT "input_modalities" IS NOT DISTINCT FROM ARRAY[]::text[] FROM public.models WHERE id=3014),false)
 AND coalesce((SELECT "output_modalities" IS NOT DISTINCT FROM ARRAY[]::text[] FROM public.models WHERE id=3014),false)
 AND coalesce((SELECT "capabilities" IS NOT DISTINCT FROM ARRAY[]::text[] FROM public.models WHERE id=3014),false)
 AND coalesce((SELECT "pricing_unit" IS NOT DISTINCT FROM 'per_1m_tokens'::text FROM public.models WHERE id=3014),false)
 AND coalesce((SELECT "shutdown_date" IS NOT DISTINCT FROM NULL::date FROM public.models WHERE id=3014),false)
 AND coalesce((SELECT "replacement_model" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3014),false)
 AND coalesce((SELECT "deprecation_source_url" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3014),false)
 AND coalesce((SELECT "deprecated_at" IS NOT DISTINCT FROM NULL::date FROM public.models WHERE id=3014),false)
 AND coalesce((SELECT "license" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3014),false)
 AND coalesce((SELECT "license_url" IS NOT DISTINCT FROM NULL::text FROM public.models WHERE id=3014),false) AS metadata_ok \gset o3_
\echo metadata :o3_metadata_ok
\if :o3_metadata_ok
\else
  ROLLBACK;
  \quit 3
\endif
\echo result proposal_checks_match_pending_parent_SRE_freeze
ROLLBACK;
