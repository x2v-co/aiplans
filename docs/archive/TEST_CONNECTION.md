# Testing Database Connection

The "Tenant or user not found" error usually means incorrect credentials. Let's test different connection strings to find the right one.

## Quick Test

Run this command with your **actual database password**:

```bash
node test-connection.mjs YOUR_ACTUAL_PASSWORD
```

This will test multiple connection string formats and tell you which one works.

## Get Your Real Password

1. Go to: https://supabase.com/dashboard/project/drouqxwismuvzquslkiu/settings/database
2. Scroll to "Database Password" section
3. Either:
   - Copy your existing password (if you saved it)
   - Click **"Reset database password"** to generate a new one
   - **IMPORTANT**: Save the new password somewhere safe!

## What the Test Does

The script will try:
1. ✅ **Direct connection** (most reliable, recommended)
   - `postgres:PASSWORD@db.PROJECT.supabase.co:5432`
2. Pooler with ap-southeast-1 region
3. Pooler with us-east-1 region

## After Finding the Right Connection

Once the test succeeds, it will show you the exact DATABASE_URL to use. Copy it and update your `.env.local`:

```bash
# Replace this line in .env.local
DATABASE_URL="the_working_connection_string_from_test"
```

Then run:
```bash
npx drizzle-kit push
```

## Common Issues

### "Password contains special characters"
If your password has special characters like `@`, `#`, `!`, you may need to URL-encode them:
- `@` → `%40`
- `#` → `%23`
- `!` → `%21`

Or just reset to a simpler password.

### "Project is paused"
- Check if your Supabase project is active
- Unpause it in the dashboard if needed

### "Still not working"
Try using the **direct connection** (not pooler):
```bash
# Get this format from Supabase Dashboard
# Settings → Database → Connection string → Disable "Use connection pooling"
DATABASE_URL="postgresql://postgres:PASSWORD@db.drouqxwismuvzquslkiu.supabase.co:5432/postgres"
```

## Example

```bash
# If your password is "MyP@ssw0rd"
node test-connection.mjs "MyP@ssw0rd"

# The quotes are important if password has special characters
```

Good luck! 🍀
