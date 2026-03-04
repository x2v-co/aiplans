#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Checking plans table structure...\n');

  // Get one plan to see all columns
  const { data: plan, error } = await supabase
    .from('plans')
    .select('*')
    .eq('provider_id', 33)
    .limit(1)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Plan columns:');
  console.log(Object.keys(plan || {}));
  console.log('\nPlan data:');
  console.log(JSON.stringify(plan, null, 2));
}

main().catch(console.error);
