#!/bin/bash

# Drizzle Setup Helper
# This script helps you configure the DATABASE_URL for Drizzle migrations

echo "🔧 Drizzle Database URL Setup"
echo "================================"
echo ""

# Extract project ref from Supabase URL
if [ -f .env.local ]; then
  SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d '=' -f2)
  PROJECT_REF=$(echo $SUPABASE_URL | sed 's/https:\/\///' | cut -d '.' -f1)
  echo "✓ Found Supabase project: $PROJECT_REF"
else
  echo "✗ .env.local not found!"
  exit 1
fi

# Check if DATABASE_URL already exists
if grep -q "DATABASE_URL" .env.local; then
  echo "⚠️  DATABASE_URL already exists in .env.local"
  echo ""
  echo "Current value:"
  grep "DATABASE_URL" .env.local
  echo ""
  read -p "Do you want to update it? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
  fi
fi

echo ""
echo "📋 To get your database password:"
echo "   1. Go to https://supabase.com/dashboard"
echo "   2. Select your project"
echo "   3. Go to Settings → Database"
echo "   4. Find 'Connection string' section"
echo "   5. Copy the password from the URI"
echo ""

read -p "Enter your Supabase database password: " -s DB_PASSWORD
echo ""

if [ -z "$DB_PASSWORD" ]; then
  echo "✗ Password cannot be empty"
  exit 1
fi

# Try to detect region (default to us-east-1)
REGION="us-east-1"
echo "Using region: $REGION (pooler)"

# Construct the DATABASE_URL
DATABASE_URL="postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-${REGION}.pooler.supabase.com:6543/postgres"

# Add or update DATABASE_URL in .env.local
if grep -q "DATABASE_URL" .env.local; then
  # Update existing
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=\"${DATABASE_URL}\"|" .env.local
  else
    # Linux
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"${DATABASE_URL}\"|" .env.local
  fi
  echo "✓ Updated DATABASE_URL in .env.local"
else
  # Add new
  echo "" >> .env.local
  echo "DATABASE_URL=\"${DATABASE_URL}\"" >> .env.local
  echo "✓ Added DATABASE_URL to .env.local"
fi

echo ""
echo "✅ Database URL configured!"
echo ""
echo "Next steps:"
echo "  1. Test connection:  npx drizzle-kit push --dry-run"
echo "  2. Apply schema:     npx drizzle-kit push"
echo "  3. Generate types:   npx drizzle-kit generate"
echo ""
