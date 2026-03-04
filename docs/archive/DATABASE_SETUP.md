# Database Setup Required

## Status
The compare/plans feature has been fully implemented, but the database needs to be migrated and seeded with data.

## Issue
The API endpoint `/api/compare/plans` returns a 500 error because:
1. The database tables don't have the new schema fields yet
2. The `model_plan_mapping` table doesn't exist
3. There's no seed data for plans

## What Was Built
✅ Updated database schema (`src/db/schema/index.ts`)
✅ Created API endpoint (`src/app/api/compare/plans/route.ts`)
✅ Built comparison UI pages
✅ Created all necessary components

## What's Needed

### 1. Run Database Migrations
You need to run Drizzle migrations to add the new fields to the plans table:

```bash
# Generate migration
npx drizzle-kit generate

# Push to database
npx drizzle-kit push
```

### 2. Create Seed Data
Create a seed script or manually add data for:
- Plans with the new fields (rpm, qps, yearly pricing, etc.)
- Model-plan mappings
- At least one model like "claude-3-5-sonnet" to test with

### 3. Alternative: Use Mock Data
For now, you can use the mock endpoint by renaming files:
```bash
mv src/app/api/compare/plans/route.ts src/app/api/compare/plans/route-real.ts
mv src/app/api/compare/plans/route-backup.ts src/app/api/compare/plans/route.ts
```

This will return mock data so you can see the UI working.

## New Schema Fields Added

### Plans Table
- `requests_per_minute`, `requests_per_day`, `requests_per_month`
- `qps`, `concurrent_requests`
- `tokens_per_minute`, `tokens_per_day`, `tokens_per_month`
- `max_tokens_per_request`, `max_input_tokens`, `max_output_tokens`
- `price_yearly_monthly`, `yearly_discount_percent`
- `is_official`, `plan_tier`, `billing_granularity`
- `has_overage_pricing`, `overage_input_price_per_1m`, `overage_output_price_per_1m`

### New Table: model_plan_mapping
Many-to-many relationship between products and plans with override fields.

## Temporary Workaround
The API has been updated to work with the existing schema where possible, but it will return empty results until data is seeded.

## Next Steps
1. Set up Drizzle migrations
2. Seed the database with actual plan data
3. Test the comparison pages with real data

See `PLAN_COMPARE.md` for the full feature specification.
