#!/bin/bash

# Supabase Connection String Finder
# This helps you get the correct DATABASE_URL for Drizzle

echo "🔍 Finding Correct Supabase Connection String"
echo "=============================================="
echo ""

PROJECT_REF="drouqxwismuvzquslkiu"

echo "Your Supabase project ref: $PROJECT_REF"
echo ""
echo "📝 Steps to get the correct connection string:"
echo ""
echo "1. Go to: https://supabase.com/dashboard/project/$PROJECT_REF/settings/database"
echo ""
echo "2. Scroll down to 'Connection string' section"
echo ""
echo "3. Select 'URI' tab"
echo ""
echo "4. Toggle 'Use connection pooling' ON"
echo ""
echo "5. Select 'Transaction' mode (port 6543)"
echo ""
echo "6. Copy the ENTIRE connection string"
echo "   It should look like:"
echo "   postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres"
echo ""
echo "7. Paste it here:"
read -p "Connection string: " CONNECTION_STRING

if [ -z "$CONNECTION_STRING" ]; then
  echo "✗ Connection string cannot be empty"
  exit 1
fi

# Validate format
if [[ ! $CONNECTION_STRING =~ ^postgresql:// ]]; then
  echo "✗ Invalid format. Must start with postgresql://"
  exit 1
fi

# Update .env.local
if grep -q "DATABASE_URL" .env.local; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=\"${CONNECTION_STRING}\"|" .env.local
  else
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"${CONNECTION_STRING}\"|" .env.local
  fi
  echo "✓ Updated DATABASE_URL in .env.local"
else
  echo "" >> .env.local
  echo "DATABASE_URL=\"${CONNECTION_STRING}\"" >> .env.local
  echo "✓ Added DATABASE_URL to .env.local"
fi

echo ""
echo "✅ Connection string updated!"
echo ""
echo "Now try: npx drizzle-kit push"
echo ""
