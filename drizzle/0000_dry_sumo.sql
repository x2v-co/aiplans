CREATE TABLE "channel_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer,
	"channel_id" integer,
	"input_price_per_1m" real,
	"output_price_per_1m" real,
	"cached_input_price_per_1m" real,
	"rate_limit" integer,
	"is_available" boolean DEFAULT true,
	"last_verified" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"provider_id" integer,
	"type" text NOT NULL,
	"logo" text,
	"website" text,
	"region" text,
	"access_from_china" boolean DEFAULT true,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "channels_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "coupon_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"coupon_id" integer,
	"is_upvote" boolean NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"provider_id" integer,
	"description" text,
	"discount_type" text,
	"discount_value" real,
	"expires_at" timestamp,
	"is_verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "model_plan_mapping" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"plan_id" integer NOT NULL,
	"override_rpm" integer,
	"override_qps" integer,
	"override_input_price_per_1m" real,
	"override_output_price_per_1m" real,
	"override_max_output_tokens" integer,
	"is_available" boolean DEFAULT true,
	"note" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer,
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
	"access_from_china" boolean DEFAULT true,
	"payment_methods" jsonb,
	"features" jsonb,
	"requests_per_minute" integer,
	"requests_per_day" integer,
	"requests_per_month" integer,
	"qps" integer,
	"concurrent_requests" integer,
	"tokens_per_minute" integer,
	"tokens_per_day" integer,
	"tokens_per_month" integer,
	"max_tokens_per_request" integer,
	"max_input_tokens" integer,
	"max_output_tokens" integer,
	"price_yearly_monthly" real,
	"yearly_discount_percent" real,
	"is_official" boolean DEFAULT false,
	"plan_tier" text,
	"billing_granularity" text,
	"has_overage_pricing" boolean DEFAULT false,
	"overage_input_price_per_1m" real,
	"overage_output_price_per_1m" real,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_price_id" integer,
	"input_price_per_1m" real,
	"output_price_per_1m" real,
	"effective_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"provider_id" integer,
	"type" text NOT NULL,
	"description" text,
	"context_window" integer,
	"benchmark_mmlu" real,
	"benchmark_human_eval" real,
	"benchmark_arena_elo" real,
	"released_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"website" text,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "providers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "channel_prices" ADD CONSTRAINT "channel_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_prices" ADD CONSTRAINT "channel_prices_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_votes" ADD CONSTRAINT "coupon_votes_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_plan_mapping" ADD CONSTRAINT "model_plan_mapping_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_plan_mapping" ADD CONSTRAINT "model_plan_mapping_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_channel_price_id_channel_prices_id_fk" FOREIGN KEY ("channel_price_id") REFERENCES "public"."channel_prices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;