#!/usr/bin/env node

/**
 * Test Supabase Connection
 * This script tests different connection strings to find the right one
 */

import postgres from 'postgres';

const projectRef = 'drouqxwismuvzquslkiu';

// Get password from command line or env
const password = process.argv[2] || process.env.DB_PASSWORD;

if (!password) {
  console.error('❌ Please provide database password:');
  console.error('   node test-connection.mjs YOUR_PASSWORD');
  console.error('   or set DB_PASSWORD environment variable');
  process.exit(1);
}

const connectionStrings = [
  // Direct connection (most reliable for migrations)
  {
    name: 'Direct Connection (Recommended for migrations)',
    url: `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`,
  },
  // Pooler with transaction mode
  {
    name: 'Pooler Transaction Mode (ap-southeast-1)',
    url: `postgresql://postgres.${projectRef}:${password}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
  },
  // Try us-east-1 in case region was wrong
  {
    name: 'Pooler Transaction Mode (us-east-1)',
    url: `postgresql://postgres.${projectRef}:${password}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  },
];

console.log('🔍 Testing Supabase connections...\n');

async function testConnection(config) {
  console.log(`Testing: ${config.name}`);
  console.log(`URL: ${config.url.replace(password, '***')}`);

  try {
    const sql = postgres(config.url, {
      max: 1,
      idle_timeout: 5,
      connect_timeout: 10,
    });

    // Try a simple query
    const result = await sql`SELECT version()`;
    console.log('✅ SUCCESS! PostgreSQL version:', result[0].version.split(' ')[0]);
    console.log('');
    console.log('✨ Use this connection string in your .env.local:');
    console.log(`DATABASE_URL="${config.url}"`);
    console.log('');

    await sql.end();
    return true;
  } catch (error) {
    console.log('❌ FAILED:', error.message);
    console.log('');
    return false;
  }
}

async function testAll() {
  for (const config of connectionStrings) {
    const success = await testConnection(config);
    if (success) {
      console.log('✅ Found working connection! Update your .env.local and try drizzle-kit push again.');
      process.exit(0);
    }
  }

  console.log('❌ None of the connection strings worked.');
  console.log('');
  console.log('Possible issues:');
  console.log('1. Wrong password - Reset it in Supabase Dashboard → Settings → Database');
  console.log('2. Project is paused - Check Supabase Dashboard');
  console.log('3. Network/firewall issue - Check your internet connection');
  console.log('');
  process.exit(1);
}

testAll().catch(console.error);
