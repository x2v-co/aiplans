# Fix "Tenant or user not found" Error

## The Problem
The DATABASE_URL connection string has incorrect credentials or format.

## Solution: Get the Correct Connection String from Supabase

### Step-by-Step:

1. **Open Supabase Dashboard**
   ```
   https://supabase.com/dashboard/project/drouqxwismuvzquslkiu/settings/database
   ```

2. **Find "Connection string" section**
   - Scroll down to the "Connection string" section
   - Click on the **"URI"** tab (not "JDBC" or others)

3. **Enable Connection Pooling**
   - Toggle **"Use connection pooling"** to ON
   - Select **"Transaction"** mode
   - This uses port **6543**

4. **Copy the Connection String**
   - You'll see something like:
   ```
   postgresql://postgres.drouqxwismuvzquslkiu:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
   - The `[YOUR-PASSWORD]` will be shown (but hidden with dots)
   - Click "Copy" button or click the eye icon to reveal it

5. **Update .env.local**
   Replace the current DATABASE_URL with the exact string you copied:
   ```bash
   DATABASE_URL="postgresql://postgres.drouqxwismuvzquslkiu:[ACTUAL-PASSWORD]@aws-0-[ACTUAL-REGION].pooler.supabase.com:6543/postgres"
   ```

6. **Try Again**
   ```bash
   npx drizzle-kit push
   ```

## Alternative: Use Direct Connection (Not Pooled)

If pooler doesn't work, try the direct connection:

1. In Supabase Dashboard → Database settings
2. Look for "Connection string" → "URI" tab
3. **Disable** "Use connection pooling"
4. Copy that connection string (uses port 5432, different hostname)
5. Should look like:
   ```
   postgresql://postgres:[PASSWORD]@db.drouqxwismuvzquslkiu.supabase.co:5432/postgres
   ```

## Quick Fix Script

Run the helper script:
```bash
./fix-connection.sh
```

This will prompt you to paste the correct connection string from Supabase.

## Common Issues

### Wrong Password
- The password in the connection string must match your Supabase database password
- If you don't remember it, reset it in Supabase Dashboard → Database → "Reset database password"

### Wrong Region
- The region in the URL must match your project's region
- Common regions: `us-east-1`, `us-west-1`, `eu-west-1`, `ap-southeast-1`
- Check in Supabase Dashboard → Settings → General → "Region"

### Wrong Format
- Make sure you're copying from the "URI" tab, not "JDBC" or "psql"
- Must start with `postgresql://`
- No quotes inside the URL itself

## Test Connection

After fixing, test with:
```bash
# Dry run to see what will change
npx drizzle-kit push --dry-run

# If that works, apply changes
npx drizzle-kit push
```

## Still Having Issues?

If it still doesn't work:
1. Double-check you're copying the entire connection string
2. Make sure there are no extra spaces or line breaks
3. Verify the password is correct (reset if needed)
4. Try the direct connection instead of pooler
5. Check if your Supabase project is paused (unpause it)
