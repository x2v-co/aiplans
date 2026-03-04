# Drizzle Push Error - Missing DATABASE_URL

## Issue
`drizzle-kit push` needs a direct PostgreSQL connection string, but only the Supabase HTTP URL is configured.

## Solution

### Step 1: Get Your Supabase Database Password
1. Go to https://supabase.com/dashboard
2. Select your project: `drouqxwismuvzquslkiu`
3. Go to **Settings** → **Database**
4. Copy the **Connection string** (Direct connection)
5. It should look like: `postgresql://postgres.drouqxwismuvzquslkiu:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

### Step 2: Add to .env.local

Add this line to your `.env.local` file:

```bash
DATABASE_URL="postgresql://postgres.drouqxwismuvzquslkiu:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
```

Replace `[YOUR-PASSWORD]` with your actual database password from Supabase.

### Step 3: Run Drizzle Push

```bash
npx drizzle-kit push
```

## Alternative: Use Supabase Connection Pooler

If you want to use connection pooling (recommended for production):

```bash
# Transaction mode (port 6543)
DATABASE_URL="postgresql://postgres.drouqxwismuvzquslkiu:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

# OR Session mode (port 5432)
DATABASE_URL="postgresql://postgres.drouqxwismuvzquslkiu:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
```

Transaction mode (6543) is recommended for migrations and Drizzle operations.

## Quick Test

After adding DATABASE_URL, test the connection:

```bash
# This should now work
npx drizzle-kit push

# Or generate migration files
npx drizzle-kit generate
```

## Finding Your Connection String in Supabase

1. Dashboard → Project Settings
2. Database tab
3. Look for "Connection string" section
4. Choose "URI" format
5. Toggle "Display connection pooler" for pooled connection
6. Make sure to use the password you set when creating the project

## Troubleshooting

**If you don't have the password:**
1. Go to Supabase Dashboard → Settings → Database
2. Click "Reset database password"
3. Copy the new password
4. Update your DATABASE_URL in .env.local

**Connection modes:**
- **Transaction mode (port 6543)**: Use for migrations, Drizzle Kit (recommended)
- **Session mode (port 5432)**: Use for long-running connections
- **Direct connection (port 5432, different host)**: Bypass pooler (not recommended)

## After Adding DATABASE_URL

Your .env.local should look like:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://drouqxwismuvzquslkiu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
DATABASE_URL="postgresql://postgres.drouqxwismuvzquslkiu:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
```

Then run:
```bash
npx drizzle-kit push
```

This will add all the new schema fields to your Supabase database!
