#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import fs from 'fs';

config({ path: '/Users/kl/workspace/x2v/planprice/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

async function main() {
  console.log('\n=== Deleting old Claude 3 Opus model ===');

  const sql = fs.readFileSync('/Users/kl/workspace/x2v/planprice/scripts/delete-old-model.sql', 'utf-8');

  const { data, error } = await supabase.rpc('execute_sql', {
    sql: sql
  });

  if (error) {
    console.log('  ❌ RPC error:', error);
  } else {
    console.log('  ✅ Deleted successfully');
  }
}

main()
  .then(() => {
    console.log('\n=== Done ===');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
