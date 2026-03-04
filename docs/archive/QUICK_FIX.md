# 🚀 Quick Fix: Bypass Drizzle and Run Migrations Directly

Since `drizzle-kit push` is having connection issues, here's the **easiest workaround**:

## Option 1: Copy-Paste SQL (EASIEST - 2 minutes)

1. **Open Supabase SQL Editor:**
   ```
   https://supabase.com/dashboard/project/drouqxwismuvzquslkiu/sql/new
   ```

2. **Copy the entire SQL from:**
   ```
   migrations/manual-migration.sql
   ```

3. **Paste and Run** in the SQL Editor (click "Run" button)

4. **Done!** Your schema is updated.

## Option 2: Test Connection First

If you want to fix the Drizzle connection for future use:

```bash
# Test which connection string works
node test-connection.mjs YOUR_PASSWORD

# Use the working connection string in .env.local
# Then try: npx drizzle-kit push
```

## Option 3: Use Supabase Service Role Key

Try using service role key instead of anon key for migrations:

1. Get your service role key from Supabase Dashboard → Settings → API
2. Add to .env.local:
   ```
   SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
   ```
3. Try `drizzle-kit push` again

## What the Migration Does

The SQL adds these to your database:
- ✅ Request limits (RPM, RPD, QPM)
- ✅ Token limits (TPM, max tokens)
- ✅ Yearly pricing fields
- ✅ Plan metadata (official, tier)
- ✅ Overage pricing
- ✅ model_plan_mapping table

## After Running Migration

Your API should work better (though it still needs seed data):

```bash
# Test the API
curl http://localhost:3000/api/compare/plans?model=claude-3-5-sonnet
```

## Why Drizzle Connection Failed

The "Tenant or user not found" error usually means:
- Wrong password format
- Special characters in password need URL encoding
- Using pooler when direct connection would work better
- Project paused or credentials cached incorrectly

## Recommendation

**Just use the SQL Editor method** - it's faster and more reliable than debugging connection issues!

1. Open Supabase SQL Editor
2. Copy `migrations/manual-migration.sql`
3. Paste and run
4. Done ✅

Then you can work on adding actual plan data to test the comparison features.
