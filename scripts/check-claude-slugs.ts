#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const slugs = ['claude-opus-4.6', 'claude-sonnet-4.6', 'claude-3-7-sonnet'];

  console.log('Checking exact slug matches:\n');
  for (const slug of slugs) {
    const { data } = await supabase
      .from('products')
      .select('id, slug')
      .eq('slug', slug)
      .single();
    console.log(`Looking for '${slug}': ${data ? 'FOUND - ID=' + data.id : 'NOT FOUND'}`);
  }
}

main().catch(console.error);
