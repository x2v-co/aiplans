-- AUTHORED supported affected-table profile, not a production equivalence certificate.
-- 33-table fixture scaffolding preserves the saved inventory; all exact column types/typmods
-- come from 0428. Only the three affected tables and enumerated read dependencies are gated.
-- All 55 affected columns have explicit authored defaults or explicit absence (see profile).
-- Unknown live defaults/sequence ownership outside evaluated writes are not reconstructed.
-- No function stub, UNIQUE(model_id,provider_id), or production credentials.
-- Unrelated enum is the exact local HEAD migration definition, not live certification.
CREATE TYPE public.third_party_coverage AS ENUM ('none', 'partial', 'full', 'unknown');
CREATE TABLE public."api_channel_price_variants" (
  "id" bigint NOT NULL,
  "model_id" integer,
  "provider_id" integer,
  "variant_key" text NOT NULL,
  "variant_name" text NOT NULL,
  "variant_kind" text,
  "source_group_key" text,
  "source_group_name" text,
  "source_pricing_version" text,
  "source_updated_at" timestamp with time zone,
  "source_url" text,
  "input_price_per_1m" real,
  "output_price_per_1m" real,
  "cached_input_price_per_1m" real,
  "cache_create_price_per_1m" real,
  "currency" character varying,
  "price_unit" character varying,
  "is_available" boolean,
  "is_public" boolean,
  "is_self_service" boolean,
  "is_partner_only" boolean,
  "is_headline" boolean,
  "headline_rank" integer,
  "headline_reason" text,
  "constraints_json" jsonb,
  "raw_json" jsonb,
  "notes" text,
  "last_verified" timestamp with time zone,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "availability_locked" boolean NOT NULL
);
CREATE TABLE public."api_channel_prices" (
  "id" integer NOT NULL,
  "model_id" integer,
  "input_price_per_1m" real,
  "output_price_per_1m" real,
  "cached_input_price_per_1m" real,
  "rate_limit" integer,
  "is_available" boolean,
  "last_verified" timestamp with time zone,
  "notes" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "currency" character varying(3),
  "price_unit" character varying(20),
  "provider_id" integer,
  "promo_ends_at" timestamp with time zone,
  "regular_input_price_per_1m" real,
  "regular_output_price_per_1m" real,
  "regular_cached_input_price_per_1m" real,
  "data_for_discount" boolean,
  "data_for_discount_note" text,
  "quota_unit" text,
  "availability_locked" boolean NOT NULL
);
CREATE TABLE public."audit_alert_state" (
  "fingerprint" text NOT NULL,
  "check_name" text NOT NULL,
  "ref" text,
  "message" text,
  "first_seen" timestamp with time zone NOT NULL,
  "last_seen" timestamp with time zone NOT NULL
);
CREATE TABLE public."benchmark_metrics" (
  "id" bigint NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "name" text,
  "unit" text,
  "description" text,
  "higher_better" boolean
);
CREATE TABLE public."benchmark_tasks" (
  "id" bigint NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "benchmark_version_id" bigint,
  "name" text
);
CREATE TABLE public."benchmark_versions" (
  "id" bigint NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "benchmark_id" bigint,
  "version_label" text,
  "release_date" date,
  "notes" text,
  "is_current" boolean
);
CREATE TABLE public."benchmarks" (
  "id" bigint NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "offical_url" text,
  "type" text,
  "name" text,
  "slug" text,
  "family" bigint
);
CREATE TABLE public."clicks" (
  "id" bigint NOT NULL,
  "utm_source" text NOT NULL,
  "utm_campaign" text NOT NULL,
  "product" text NOT NULL,
  "ts" timestamp with time zone NOT NULL
);
CREATE TABLE public."coding_agent_scores" (
  "id" bigint NOT NULL,
  "source_record_id" text NOT NULL,
  "agent_name" text NOT NULL,
  "agent_display_label" text NOT NULL,
  "variant_of" text,
  "host_model_slug" text NOT NULL,
  "model_id" integer,
  "provider_slug" text,
  "index_version" text NOT NULL,
  "index_score" real NOT NULL,
  "deepswe_score" real,
  "terminalbench_score" real,
  "sweatlas_score" real,
  "cost_per_task_usd" real,
  "wall_time_per_task_sec" real,
  "steps_per_task" real,
  "total_tokens_per_task" real,
  "refusal_rate" real,
  "is_default" boolean,
  "is_highlighted" boolean,
  "is_unavailable" boolean,
  "raw" jsonb NOT NULL,
  "source_materialized_at" timestamp with time zone,
  "observed_date" date NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
CREATE TABLE public."coupons" (
  "id" integer NOT NULL,
  "code" text NOT NULL,
  "provider_id" integer,
  "description" text,
  "discount_type" text,
  "discount_value" real,
  "expires_at" timestamp with time zone,
  "is_verified" boolean,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "offer_url" text,
  "scope" text NOT NULL
);
CREATE TABLE public."data_fix_275_audit" (
  "id" bigint NOT NULL,
  "table_name" text NOT NULL,
  "row_key" jsonb NOT NULL,
  "action" text NOT NULL,
  "before_row" jsonb,
  "after_row" jsonb,
  "source_url" text NOT NULL,
  "last_verified" timestamp with time zone NOT NULL,
  "applied_at" timestamp with time zone NOT NULL
);
CREATE TABLE public."evaluation_run" (
  "id" bigint NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "model_id" integer,
  "benchmark_task_id" bigint,
  "run_date" timestamp with time zone,
  "config" json,
  "provider_id" integer
);
CREATE TABLE public."exchange_rates" (
  "id" integer NOT NULL,
  "from_currency" character varying(3) NOT NULL,
  "to_currency" character varying(3) NOT NULL,
  "rate" numeric(15,8) NOT NULL,
  "source" character varying(50) NOT NULL,
  "is_active" boolean,
  "valid_at" timestamp with time zone,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);
CREATE TABLE public."external_price_references" (
  "id" bigint NOT NULL,
  "source" text NOT NULL,
  "source_model_slug" text NOT NULL,
  "model_id" integer,
  "input_price_per_1m" real,
  "output_price_per_1m" real,
  "cached_input_price_per_1m" real,
  "currency" character(3) NOT NULL,
  "observed_date" date NOT NULL,
  "raw" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
CREATE TABLE public."model_benchmark_scores" (
  "id" bigint NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "model_id" integer,
  "benchmark_task_id" bigint,
  "value" real,
  "release_date" date,
  "metric_id" bigint
);
CREATE TABLE public."model_merge_backup_20261015" (
  "source_table" text NOT NULL,
  "row_key" text NOT NULL,
  "row_data" jsonb NOT NULL,
  "backed_up_at" timestamp with time zone NOT NULL
);
CREATE TABLE public."model_merge_backup_20261022" (
  "source_table" text NOT NULL,
  "row_key" text NOT NULL,
  "row_data" jsonb NOT NULL,
  "backed_up_at" timestamp with time zone NOT NULL
);
CREATE TABLE public."model_offical" (
  "id" bigint NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "model_id" integer,
  "producer_id" integer
);
CREATE TABLE public."model_plan_mapping" (
  "id" integer NOT NULL,
  "model_id" integer,
  "plan_id" integer,
  "priority" integer,
  "created_at" timestamp without time zone,
  "source" text NOT NULL
);
CREATE TABLE public."model_slug_redirects" (
  "old_slug" text NOT NULL,
  "model_id" integer NOT NULL,
  "reason" text,
  "created_at" timestamp with time zone NOT NULL
);
CREATE TABLE public."models" (
  "id" integer NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "type" text NOT NULL,
  "description" text,
  "context_window" integer,
  "released_at" timestamp with time zone,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "max_output_tokens" bigint,
  "open_source" boolean,
  "features" text[],
  "offical_link" text,
  "input_type" text[],
  "output_type" text[],
  "parameters" text,
  "active parameters" text,
  "provider_ids" integer[],
  "model_category" text NOT NULL,
  "input_modalities" text[],
  "output_modalities" text[],
  "capabilities" text[],
  "pricing_unit" text,
  "shutdown_date" date,
  "replacement_model" text,
  "deprecation_source_url" text,
  "deprecated_at" date,
  "license" text,
  "license_url" text
);
CREATE TABLE public."models_slug_backup_20261012" (
  "id" integer,
  "name" text,
  "slug" text,
  "type" text,
  "description" text,
  "context_window" integer,
  "released_at" timestamp with time zone,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "max_output_tokens" bigint,
  "open_source" boolean,
  "features" text[],
  "offical_link" text,
  "input_type" text[],
  "output_type" text[],
  "parameters" text,
  "active parameters" text,
  "provider_ids" integer[],
  "model_category" text,
  "input_modalities" text[],
  "output_modalities" text[],
  "capabilities" text[],
  "pricing_unit" text,
  "backed_up_at" timestamp with time zone
);
CREATE TABLE public."plans" (
  "id" integer NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "pricing_model" text NOT NULL,
  "price" real,
  "price_unit" text,
  "tier" text,
  "daily_message_limit" integer,
  "weekly_message_limit" integer,
  "monthly_message_limit" integer,
  "rate_limit" integer,
  "context_window" integer,
  "access_from_china" boolean,
  "payment_methods" jsonb,
  "features" jsonb,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "annual_price" real,
  "requests_per_minute" integer,
  "requests_per_day" integer,
  "requests_per_month" integer,
  "qps" integer,
  "concurrent_requests" integer,
  "tokens_per_minute" integer,
  "tokens_per_day" bigint,
  "tokens_per_month" bigint,
  "max_tokens_per_request" integer,
  "price_yearly_monthly" real,
  "is_official" boolean,
  "plan_tier" character varying(50),
  "billing_granularity" character varying(30),
  "has_overage_pricing" boolean,
  "overage_input_price_per_1m" real,
  "overage_output_price_per_1m" real,
  "provider_id" integer,
  "region" text,
  "last_verified" timestamp without time zone,
  "currency" character varying(3),
  "5_hours_message_limit" integer,
  "product_id" integer,
  "notes" text,
  "is_contact_sales" boolean,
  "source" text,
  "plan_kind" text NOT NULL,
  "plan_line" text,
  "tier_rank" integer,
  "secondary_kinds" text[],
  "model_selector" jsonb,
  "included_tokens" bigint,
  "included_credits" integer,
  "pack_validity_days" integer,
  "quotas" jsonb,
  "plan_category" text NOT NULL,
  "included_usage_unit" text,
  "included_usage_amount" real,
  "third_party_coverage" third_party_coverage NOT NULL,
  "third_party_coverage_note" text,
  "monthly_api_credit_usd" real,
  "monthly_api_credit_status" text,
  "legacy_ends_on" date,
  "data_for_discount" boolean,
  "data_for_discount_note" text,
  "quota_unit" text,
  "supported_regions" text[],
  "regions_source_url" text,
  "regions_verified_at" timestamp with time zone
);
CREATE TABLE public."price_history" (
  "id" bigint NOT NULL,
  "channel_price_id" integer NOT NULL,
  "old_input_price" real,
  "new_input_price" real,
  "old_output_price" real,
  "new_output_price" real,
  "change_percent" real,
  "currency" character varying(8),
  "source" text,
  "recorded_at" timestamp with time zone NOT NULL
);
CREATE TABLE public."price_history_backup_20261012" (
  "id" bigint,
  "channel_price_id" integer,
  "old_input_price" real,
  "new_input_price" real,
  "old_output_price" real,
  "new_output_price" real,
  "change_percent" real,
  "currency" character varying(8),
  "source" text,
  "recorded_at" timestamp with time zone
);
CREATE TABLE public."providers" (
  "id" integer NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "logo" text,
  "website" text,
  "description" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "region" text,
  "logo_url" text,
  "currency" character varying(3),
  "pricing_url" text,
  "api_docs_url" text,
  "payment_methods" jsonb,
  "priority" integer,
  "type" text,
  "access_from_china" boolean,
  "notes" text,
  "invite_url" text,
  "console_url" text,
  "supported_regions" text[],
  "regions_source_url" text,
  "regions_verified_at" timestamp with time zone
);
CREATE TABLE public."quota_estimates" (
  "id" integer NOT NULL,
  "plan_id" integer,
  "plan_slug" text NOT NULL,
  "served_model" text,
  "window" text NOT NULL,
  "est_tokens_low" bigint NOT NULL,
  "est_tokens_high" bigint NOT NULL,
  "usage_mix_id" text NOT NULL,
  "confidence" text NOT NULL,
  "verified_at" timestamp with time zone,
  "notes" text,
  "is_current" boolean NOT NULL,
  "superseded_by" integer,
  "created_at" timestamp with time zone NOT NULL
);
CREATE TABLE public."quota_evidence" (
  "id" integer NOT NULL,
  "quota_estimate_id" integer,
  "plan_slug" text,
  "evidence_type" text NOT NULL,
  "url" text,
  "captured_at" date NOT NULL,
  "raw_value" text,
  "screenshot_url" text,
  "notes" text,
  "confidence" text NOT NULL,
  "observed_at" timestamp with time zone,
  "source_name" text,
  "author_handle" text,
  "usage_mix_id" text,
  "tokens_input" bigint,
  "tokens_cached" bigint,
  "tokens_output" bigint,
  "quota_pct_before" numeric,
  "quota_pct_after" numeric,
  "window" text,
  "review_status" text,
  "reviewed_at" timestamp with time zone,
  "content_hash" text
);
CREATE TABLE public."quota_text_snapshots" (
  "id" integer NOT NULL,
  "source_id" text NOT NULL,
  "url" text NOT NULL,
  "content_hash" text NOT NULL,
  "extracted_text" text NOT NULL,
  "fetched_at" timestamp with time zone NOT NULL,
  "changed" boolean NOT NULL,
  "alerted_at" timestamp with time zone
);
CREATE TABLE public."quota_usage_samples" (
  "id" integer NOT NULL,
  "plan_slug" text NOT NULL,
  "collector" text NOT NULL,
  "account_label" text NOT NULL,
  "observed_at" timestamp with time zone NOT NULL,
  "window" text NOT NULL,
  "window_minutes" integer,
  "resets_at" timestamp with time zone,
  "used_pct" numeric,
  "tokens_input" bigint,
  "tokens_cached" bigint,
  "tokens_cache_write" bigint,
  "tokens_output" bigint,
  "tokens_reasoning" bigint,
  "model" text,
  "raw" jsonb,
  "confidence" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);
CREATE TABLE public."scrape_logs" (
  "id" integer NOT NULL,
  "source" text NOT NULL,
  "status" text NOT NULL,
  "models_found" integer,
  "prices_updated" integer,
  "errors" text,
  "started_at" timestamp without time zone NOT NULL,
  "completed_at" timestamp without time zone,
  "created_at" timestamp without time zone
);
CREATE TABLE public."usage_mixes" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "cache_read_pct" numeric NOT NULL,
  "input_pct" numeric NOT NULL,
  "output_pct" numeric NOT NULL,
  "description" text,
  "created_at" timestamp with time zone NOT NULL
);
CREATE TABLE public."usage_prices" (
  "id" bigint NOT NULL,
  "model_id" integer,
  "provider_id" integer,
  "plan_id" integer,
  "price_kind" text NOT NULL,
  "unit" text NOT NULL,
  "price" real,
  "currency" character varying,
  "constraints_json" jsonb,
  "source_url" text,
  "is_available" boolean,
  "last_verified" timestamp with time zone,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);
ALTER TABLE public."api_channel_price_variants" ADD CONSTRAINT "api_channel_price_variants_currency_check" CHECK (((currency)::text = ANY ((ARRAY['USD'::character varying, 'CNY'::character varying, 'EUR'::character varying, 'GBP'::character varying, 'JPY'::character varying, 'KRW'::character varying, 'SGD'::character varying])::text[])));
ALTER TABLE public."api_channel_price_variants" ADD CONSTRAINT "api_channel_price_variants_pkey" PRIMARY KEY (id);
ALTER TABLE public."api_channel_price_variants" ADD CONSTRAINT "api_channel_price_variants_price_unit_check" CHECK (((price_unit)::text = 'per_1m_tokens'::text));
ALTER TABLE public."api_channel_price_variants" ADD CONSTRAINT "api_channel_price_variants_provider_id_model_id_variant_key_key" UNIQUE (provider_id, model_id, variant_key);
ALTER TABLE public."api_channel_prices" ADD CONSTRAINT "api_channel_prices_quota_unit_check" CHECK ((quota_unit = ANY (ARRAY['usd'::text, 'requests'::text, 'tokens'::text, 'credits'::text])));
ALTER TABLE public."api_channel_prices" ADD CONSTRAINT "channel_prices_currency_check" CHECK (((currency)::text = ANY ((ARRAY['USD'::character varying, 'CNY'::character varying, 'EUR'::character varying, 'GBP'::character varying, 'JPY'::character varying, 'KRW'::character varying, 'SGD'::character varying])::text[])));
ALTER TABLE public."api_channel_prices" ADD CONSTRAINT "channel_prices_pkey" PRIMARY KEY (id);
ALTER TABLE public."audit_alert_state" ADD CONSTRAINT "audit_alert_state_pkey" PRIMARY KEY (fingerprint);
ALTER TABLE public."benchmark_metrics" ADD CONSTRAINT "benchmark_metrics_pkey" PRIMARY KEY (id);
ALTER TABLE public."benchmark_tasks" ADD CONSTRAINT "benchmark_tasks_pkey" PRIMARY KEY (id);
ALTER TABLE public."benchmark_versions" ADD CONSTRAINT "benchmark_version_pkey" PRIMARY KEY (id);
ALTER TABLE public."benchmarks" ADD CONSTRAINT "benchmarks_name_key" UNIQUE (name);
ALTER TABLE public."benchmarks" ADD CONSTRAINT "benchmarks_pkey" PRIMARY KEY (id);
ALTER TABLE public."benchmarks" ADD CONSTRAINT "benchmarks_slug_key" UNIQUE (slug);
ALTER TABLE public."clicks" ADD CONSTRAINT "clicks_pkey" PRIMARY KEY (id);
ALTER TABLE public."coding_agent_scores" ADD CONSTRAINT "coding_agent_scores_pkey" PRIMARY KEY (id);
ALTER TABLE public."coding_agent_scores" ADD CONSTRAINT "coding_agent_scores_source_record_id_key" UNIQUE (source_record_id);
ALTER TABLE public."coupons" ADD CONSTRAINT "coupons_code_key" UNIQUE (code);
ALTER TABLE public."coupons" ADD CONSTRAINT "coupons_pkey" PRIMARY KEY (id);
ALTER TABLE public."coupons" ADD CONSTRAINT "coupons_scope_check" CHECK ((scope = ANY (ARRAY['plan'::text, 'api'::text])));
ALTER TABLE public."data_fix_275_audit" ADD CONSTRAINT "data_fix_275_audit_pkey" PRIMARY KEY (id);
ALTER TABLE public."evaluation_run" ADD CONSTRAINT "evaluation_run_pkey" PRIMARY KEY (id);
ALTER TABLE public."exchange_rates" ADD CONSTRAINT "exchange_rates_from_currency_check" CHECK (((from_currency)::text = ANY ((ARRAY['USD'::character varying, 'CNY'::character varying, 'EUR'::character varying, 'GBP'::character varying, 'JPY'::character varying, 'KRW'::character varying, 'SGD'::character varying])::text[])));
ALTER TABLE public."exchange_rates" ADD CONSTRAINT "exchange_rates_pkey" PRIMARY KEY (id);
ALTER TABLE public."exchange_rates" ADD CONSTRAINT "exchange_rates_to_currency_check" CHECK (((to_currency)::text = ANY ((ARRAY['USD'::character varying, 'CNY'::character varying, 'EUR'::character varying, 'GBP'::character varying, 'JPY'::character varying, 'KRW'::character varying, 'SGD'::character varying])::text[])));
ALTER TABLE public."external_price_references" ADD CONSTRAINT "external_price_references_pkey" PRIMARY KEY (id);
ALTER TABLE public."external_price_references" ADD CONSTRAINT "external_price_references_source_source_model_slug_key" UNIQUE (source, source_model_slug);
ALTER TABLE public."model_benchmark_scores" ADD CONSTRAINT "model_bench_scores_pkey" PRIMARY KEY (id);
ALTER TABLE public."model_merge_backup_20261015" ADD CONSTRAINT "model_merge_backup_20261015_pkey" PRIMARY KEY (source_table, row_key);
ALTER TABLE public."model_merge_backup_20261022" ADD CONSTRAINT "model_merge_backup_20261022_pkey" PRIMARY KEY (source_table, row_key);
ALTER TABLE public."model_offical" ADD CONSTRAINT "model_offical_pkey" PRIMARY KEY (id);
ALTER TABLE public."model_plan_mapping" ADD CONSTRAINT "model_plan_mapping_model_id_plan_id_key" UNIQUE (model_id, plan_id);
ALTER TABLE public."model_plan_mapping" ADD CONSTRAINT "model_plan_mapping_pkey" PRIMARY KEY (id);
ALTER TABLE public."model_plan_mapping" ADD CONSTRAINT "model_plan_mapping_source_chk" CHECK ((source = ANY (ARRAY['derived'::text, 'manual'::text])));
ALTER TABLE public."model_slug_redirects" ADD CONSTRAINT "model_slug_redirects_pkey" PRIMARY KEY (old_slug);
ALTER TABLE public."models" ADD CONSTRAINT "models_model_category_chk" CHECK ((model_category = ANY (ARRAY['text'::text, 'image'::text, 'video'::text, 'audio'::text, 'music'::text, 'world'::text, 'embedding'::text, 'speech'::text, 'agent'::text, 'decision'::text])));
ALTER TABLE public."models" ADD CONSTRAINT "models_pricing_unit_chk" CHECK ((pricing_unit = ANY (ARRAY['per_1m_tokens'::text, 'per_second'::text, 'per_minute'::text, 'per_generation'::text, 'per_credit'::text, 'per_compute_hour'::text, 'subscription_only'::text, 'unknown'::text, 'per_hour'::text, 'per_megapixel'::text, 'per_image'::text, 'per_1k_characters'::text])));
ALTER TABLE public."models" ADD CONSTRAINT "products_pkey" PRIMARY KEY (id);
ALTER TABLE public."models" ADD CONSTRAINT "products_slug_key" UNIQUE (slug);
ALTER TABLE public."plans" ADD CONSTRAINT "plans_currency_check" CHECK (((currency)::text = ANY ((ARRAY['USD'::character varying, 'CNY'::character varying, 'EUR'::character varying, 'GBP'::character varying, 'JPY'::character varying, 'KRW'::character varying, 'SGD'::character varying])::text[])));
ALTER TABLE public."plans" ADD CONSTRAINT "plans_pkey" PRIMARY KEY (id);
ALTER TABLE public."plans" ADD CONSTRAINT "plans_plan_category_chk" CHECK ((plan_category = ANY (ARRAY['chatbot'::text, 'coding'::text, 'agent'::text, 'creative'::text, 'api'::text, 'enterprise'::text])));
ALTER TABLE public."plans" ADD CONSTRAINT "plans_plan_kind_chk" CHECK ((plan_kind = ANY (ARRAY['chat'::text, 'coding'::text, 'agent'::text, 'creative'::text, 'token_pack'::text, 'api_tier'::text, 'bundle'::text, 'gateway_subscription'::text])));
ALTER TABLE public."plans" ADD CONSTRAINT "plans_provider_id_slug_key" UNIQUE (provider_id, slug);
ALTER TABLE public."plans" ADD CONSTRAINT "plans_quota_unit_check" CHECK ((quota_unit = ANY (ARRAY['usd'::text, 'requests'::text, 'tokens'::text, 'credits'::text])));
ALTER TABLE public."price_history" ADD CONSTRAINT "price_history_pkey" PRIMARY KEY (id);
ALTER TABLE public."providers" ADD CONSTRAINT "providers_pkey" PRIMARY KEY (id);
ALTER TABLE public."providers" ADD CONSTRAINT "providers_slug_key" UNIQUE (slug);
ALTER TABLE public."quota_estimates" ADD CONSTRAINT "quota_estimates_confidence" CHECK ((confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])));
ALTER TABLE public."quota_estimates" ADD CONSTRAINT "quota_estimates_pkey" PRIMARY KEY (id);
ALTER TABLE public."quota_estimates" ADD CONSTRAINT "quota_estimates_supersession" CHECK (((superseded_by IS NULL) OR ((superseded_by <> id) AND (NOT is_current))));
ALTER TABLE public."quota_estimates" ADD CONSTRAINT "quota_estimates_tokens" CHECK (((est_tokens_low >= 0) AND (est_tokens_low <= est_tokens_high)));
ALTER TABLE public."quota_estimates" ADD CONSTRAINT "quota_estimates_window" CHECK (("window" = ANY (ARRAY['5h'::text, 'daily'::text, 'weekly'::text, 'monthly'::text])));
ALTER TABLE public."quota_evidence" ADD CONSTRAINT "quota_evidence_confidence" CHECK ((confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])));
ALTER TABLE public."quota_evidence" ADD CONSTRAINT "quota_evidence_content_hash_unique" UNIQUE (content_hash);
ALTER TABLE public."quota_evidence" ADD CONSTRAINT "quota_evidence_pkey" PRIMARY KEY (id);
ALTER TABLE public."quota_evidence" ADD CONSTRAINT "quota_evidence_review_status" CHECK ((review_status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])));
ALTER TABLE public."quota_evidence" ADD CONSTRAINT "quota_evidence_type" CHECK ((evidence_type = ANY (ARRAY['self_measured'::text, 'official_absolute'::text, 'official_text'::text, 'community'::text, 'derived'::text])));
ALTER TABLE public."quota_text_snapshots" ADD CONSTRAINT "quota_text_snapshots_pkey" PRIMARY KEY (id);
ALTER TABLE public."quota_text_snapshots" ADD CONSTRAINT "quota_text_snapshots_source_hash_unique" UNIQUE (source_id, content_hash);
ALTER TABLE public."quota_usage_samples" ADD CONSTRAINT "quota_usage_samples_account_label" CHECK ((account_label ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'::text));
ALTER TABLE public."quota_usage_samples" ADD CONSTRAINT "quota_usage_samples_collector" CHECK ((collector = ANY (ARRAY['codex-log'::text, 'ccusage'::text, 'cursor-dashboard'::text, 'grok-bot'::text, 'claude-usage'::text])));
ALTER TABLE public."quota_usage_samples" ADD CONSTRAINT "quota_usage_samples_confidence" CHECK ((confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])));
ALTER TABLE public."quota_usage_samples" ADD CONSTRAINT "quota_usage_samples_observation_unique" UNIQUE (collector, account_label, observed_at, "window");
ALTER TABLE public."quota_usage_samples" ADD CONSTRAINT "quota_usage_samples_pkey" PRIMARY KEY (id);
ALTER TABLE public."quota_usage_samples" ADD CONSTRAINT "quota_usage_samples_tokens" CHECK (((tokens_input >= 0) AND (tokens_cached >= 0) AND (tokens_cache_write >= 0) AND (tokens_output >= 0) AND (tokens_reasoning >= 0)));
ALTER TABLE public."quota_usage_samples" ADD CONSTRAINT "quota_usage_samples_used_pct" CHECK (((used_pct >= (0)::numeric) AND (used_pct <= (100)::numeric)));
ALTER TABLE public."quota_usage_samples" ADD CONSTRAINT "quota_usage_samples_window" CHECK (("window" = ANY (ARRAY['5h'::text, 'daily'::text, 'weekly'::text, 'monthly'::text])));
ALTER TABLE public."quota_usage_samples" ADD CONSTRAINT "quota_usage_samples_window_minutes" CHECK ((window_minutes > 0));
ALTER TABLE public."scrape_logs" ADD CONSTRAINT "scrape_logs_pkey" PRIMARY KEY (id);
ALTER TABLE public."usage_mixes" ADD CONSTRAINT "usage_mixes_percentages" CHECK (((cache_read_pct >= (0)::numeric) AND (input_pct >= (0)::numeric) AND (output_pct >= (0)::numeric) AND (((cache_read_pct + input_pct) + output_pct) = (100)::numeric)));
ALTER TABLE public."usage_mixes" ADD CONSTRAINT "usage_mixes_pkey" PRIMARY KEY (id);
ALTER TABLE public."usage_prices" ADD CONSTRAINT "usage_prices_pkey" PRIMARY KEY (id);
ALTER TABLE public."api_channel_price_variants" ADD CONSTRAINT "api_channel_price_variants_model_id_fkey" FOREIGN KEY (model_id) REFERENCES models(id);
ALTER TABLE public."api_channel_price_variants" ADD CONSTRAINT "api_channel_price_variants_provider_id_fkey" FOREIGN KEY (provider_id) REFERENCES providers(id);
ALTER TABLE public."api_channel_prices" ADD CONSTRAINT "channel_prices_model_id_fkey" FOREIGN KEY (model_id) REFERENCES models(id);
ALTER TABLE public."api_channel_prices" ADD CONSTRAINT "channel_prices_provider_id_fkey" FOREIGN KEY (provider_id) REFERENCES providers(id);
ALTER TABLE public."benchmark_tasks" ADD CONSTRAINT "benchmark_tasks_benchmark_version_id_fkey" FOREIGN KEY (benchmark_version_id) REFERENCES benchmark_versions(id);
ALTER TABLE public."benchmark_versions" ADD CONSTRAINT "benchmark_version_benchmark_id_fkey" FOREIGN KEY (benchmark_id) REFERENCES benchmarks(id);
ALTER TABLE public."benchmarks" ADD CONSTRAINT "benchmarks_family_fkey" FOREIGN KEY (family) REFERENCES benchmarks(id);
ALTER TABLE public."coding_agent_scores" ADD CONSTRAINT "coding_agent_scores_model_id_fkey" FOREIGN KEY (model_id) REFERENCES models(id);
ALTER TABLE public."coupons" ADD CONSTRAINT "coupons_provider_id_fkey" FOREIGN KEY (provider_id) REFERENCES providers(id);
ALTER TABLE public."evaluation_run" ADD CONSTRAINT "evaluation_run_benchmark_task_id_fkey" FOREIGN KEY (benchmark_task_id) REFERENCES benchmark_tasks(id);
ALTER TABLE public."evaluation_run" ADD CONSTRAINT "evaluation_run_model_id_fkey" FOREIGN KEY (model_id) REFERENCES models(id);
ALTER TABLE public."evaluation_run" ADD CONSTRAINT "evaluation_run_provider_id_fkey" FOREIGN KEY (provider_id) REFERENCES providers(id);
ALTER TABLE public."external_price_references" ADD CONSTRAINT "external_price_references_model_id_fkey" FOREIGN KEY (model_id) REFERENCES models(id);
ALTER TABLE public."model_benchmark_scores" ADD CONSTRAINT "model_bench_scores_model_id_fkey" FOREIGN KEY (model_id) REFERENCES models(id);
ALTER TABLE public."model_benchmark_scores" ADD CONSTRAINT "model_benchmark_scores_benchmark_task_id_fkey" FOREIGN KEY (benchmark_task_id) REFERENCES benchmark_tasks(id);
ALTER TABLE public."model_benchmark_scores" ADD CONSTRAINT "model_benchmark_scores_metric_id_fkey" FOREIGN KEY (metric_id) REFERENCES benchmark_metrics(id);
ALTER TABLE public."model_offical" ADD CONSTRAINT "model_offical_model_id_fkey" FOREIGN KEY (model_id) REFERENCES models(id);
ALTER TABLE public."model_offical" ADD CONSTRAINT "model_offical_producer_id_fkey" FOREIGN KEY (producer_id) REFERENCES providers(id);
ALTER TABLE public."model_plan_mapping" ADD CONSTRAINT "model_plan_mapping_model_id_fkey" FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE;
ALTER TABLE public."model_plan_mapping" ADD CONSTRAINT "model_plan_mapping_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE;
ALTER TABLE public."model_slug_redirects" ADD CONSTRAINT "model_slug_redirects_model_id_fkey" FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE;
ALTER TABLE public."plans" ADD CONSTRAINT "plans_product_id_fkey" FOREIGN KEY (product_id) REFERENCES providers(id);
ALTER TABLE public."quota_estimates" ADD CONSTRAINT "quota_estimates_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES plans(id);
ALTER TABLE public."quota_estimates" ADD CONSTRAINT "quota_estimates_superseded_by_fkey" FOREIGN KEY (superseded_by) REFERENCES quota_estimates(id);
ALTER TABLE public."quota_estimates" ADD CONSTRAINT "quota_estimates_usage_mix_id_fkey" FOREIGN KEY (usage_mix_id) REFERENCES usage_mixes(id);
ALTER TABLE public."quota_evidence" ADD CONSTRAINT "quota_evidence_quota_estimate_id_fkey" FOREIGN KEY (quota_estimate_id) REFERENCES quota_estimates(id);
ALTER TABLE public."quota_evidence" ADD CONSTRAINT "quota_evidence_usage_mix_id_fkey" FOREIGN KEY (usage_mix_id) REFERENCES usage_mixes(id);
ALTER TABLE public."usage_prices" ADD CONSTRAINT "usage_prices_model_id_fkey" FOREIGN KEY (model_id) REFERENCES models(id);
ALTER TABLE public."usage_prices" ADD CONSTRAINT "usage_prices_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES plans(id);
ALTER TABLE public."usage_prices" ADD CONSTRAINT "usage_prices_provider_id_fkey" FOREIGN KEY (provider_id) REFERENCES providers(id);
CREATE INDEX api_channel_price_variants_headline_idx ON public.api_channel_price_variants USING btree (provider_id, model_id) WHERE (is_headline = true);
CREATE UNIQUE INDEX api_channel_price_variants_one_headline_idx ON public.api_channel_price_variants USING btree (provider_id, model_id) WHERE ((is_headline = true) AND (is_available = true));
CREATE INDEX api_channel_price_variants_provider_model_idx ON public.api_channel_price_variants USING btree (provider_id, model_id);
CREATE UNIQUE INDEX api_channel_price_variants_provider_model_key_idx ON public.api_channel_price_variants USING btree (provider_id, model_id, variant_key);
CREATE INDEX api_channel_price_variants_verified_idx ON public.api_channel_price_variants USING btree (last_verified DESC);
CREATE INDEX idx_channel_prices_currency ON public.api_channel_prices USING btree (currency);
CREATE INDEX idx_channel_prices_last_verified ON public.api_channel_prices USING btree (last_verified DESC);
CREATE INDEX idx_audit_alert_state_check ON public.audit_alert_state USING btree (check_name);
CREATE INDEX idx_clicks_campaign_ts ON public.clicks USING btree (utm_campaign, ts DESC);
CREATE INDEX idx_clicks_product_ts ON public.clicks USING btree (product, ts DESC);
CREATE INDEX coding_agent_scores_model_idx ON public.coding_agent_scores USING btree (model_id);
CREATE INDEX coding_agent_scores_rank_idx ON public.coding_agent_scores USING btree (index_score DESC) WHERE (is_unavailable IS NOT TRUE);
CREATE INDEX idx_exchange_rates_from_to ON public.exchange_rates USING btree (from_currency, to_currency);
CREATE UNIQUE INDEX idx_exchange_rates_unique ON public.exchange_rates USING btree (from_currency, to_currency) WHERE (is_active = true);
CREATE INDEX idx_exchange_rates_updated_at ON public.exchange_rates USING btree (updated_at);
CREATE INDEX ext_price_refs_model_idx ON public.external_price_references USING btree (model_id);
CREATE INDEX ext_price_refs_observed_idx ON public.external_price_references USING btree (source, observed_date);
CREATE UNIQUE INDEX model_plan_mapping_uniq ON public.model_plan_mapping USING btree (plan_id, model_id);
CREATE INDEX models_model_category_idx ON public.models USING btree (model_category, slug);
CREATE INDEX idx_plans_currency ON public.plans USING btree (currency);
CREATE INDEX idx_plans_provider_slug ON public.plans USING btree (provider_id, slug);
CREATE INDEX plans_plan_category_idx ON public.plans USING btree (plan_category, plan_kind, plan_line);
CREATE INDEX plans_plan_kind_idx ON public.plans USING btree (plan_kind, plan_line, tier_rank);
CREATE INDEX idx_price_history_channel_price_id ON public.price_history USING btree (channel_price_id);
CREATE INDEX idx_price_history_recorded_at ON public.price_history USING btree (recorded_at DESC);
CREATE UNIQUE INDEX quota_estimates_current_idx ON public.quota_estimates USING btree (plan_slug, COALESCE(served_model, ''::text), "window", usage_mix_id) WHERE is_current;
CREATE INDEX quota_estimates_history_idx ON public.quota_estimates USING btree (plan_slug, created_at DESC);
CREATE INDEX quota_evidence_estimate_idx ON public.quota_evidence USING btree (quota_estimate_id);
CREATE INDEX quota_text_snapshots_latest_idx ON public.quota_text_snapshots USING btree (source_id, fetched_at DESC, id DESC);
CREATE INDEX quota_usage_samples_plan_observed_idx ON public.quota_usage_samples USING btree (plan_slug, observed_at DESC);
CREATE INDEX idx_scrape_logs_source ON public.scrape_logs USING btree (source);
CREATE INDEX idx_scrape_logs_started_at ON public.scrape_logs USING btree (started_at);
CREATE INDEX usage_prices_model_provider_idx ON public.usage_prices USING btree (model_id, provider_id, price_kind);
CREATE INDEX usage_prices_plan_idx ON public.usage_prices USING btree (plan_id, price_kind);
CREATE SEQUENCE public.o3_profile_models_id START 50000;
CREATE SEQUENCE public.o3_profile_channels_id START 50000;
ALTER TABLE public."models" ALTER COLUMN "id" SET DEFAULT nextval('public.o3_profile_models_id'::regclass);
ALTER TABLE public."models" ALTER COLUMN "model_category" SET DEFAULT 'text'::text;
ALTER TABLE public."models" ALTER COLUMN "input_modalities" SET DEFAULT '{}'::text[];
ALTER TABLE public."models" ALTER COLUMN "output_modalities" SET DEFAULT '{}'::text[];
ALTER TABLE public."models" ALTER COLUMN "capabilities" SET DEFAULT '{}'::text[];
ALTER TABLE public."models" ALTER COLUMN "pricing_unit" SET DEFAULT 'per_1m_tokens'::text;
ALTER TABLE public."api_channel_prices" ALTER COLUMN "id" SET DEFAULT nextval('public.o3_profile_channels_id'::regclass);
ALTER TABLE public."api_channel_prices" ALTER COLUMN "currency" SET DEFAULT 'USD'::character varying;
ALTER TABLE public."api_channel_prices" ALTER COLUMN "price_unit" SET DEFAULT 'per_1m_tokens'::character varying;
ALTER TABLE public."api_channel_prices" ALTER COLUMN "availability_locked" SET DEFAULT false;
ALTER TABLE public."model_slug_redirects" ALTER COLUMN "created_at" SET DEFAULT now();
