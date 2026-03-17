import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Check benchmarks
  const { data: benchmarks, error: e1 } = await supabase
    .from('benchmarks')
    .select('*')
    .limit(5);
  
  console.log('=== BENCHMARKS ===');
  console.log(JSON.stringify(benchmarks, null, 2));
  if (e1) console.log('Error:', e1);
  
  // Check benchmark_tasks
  const { data: tasks, error: e2 } = await supabase
    .from('benchmark_tasks')
    .select('*')
    .limit(5);
  
  console.log('\n=== BENCHMARK_TASKS ===');
  console.log(JSON.stringify(tasks, null, 2));
  if (e2) console.log('Error:', e2);
  
  // Check model_benchmark_scores columns
  const { data: scores, error: e3 } = await supabase
    .from('model_benchmark_scores')
    .select('*')
    .limit(3);
  
  console.log('\n=== MODEL_BENCHMARK_SCORES ===');
  console.log(JSON.stringify(scores, null, 2));
  if (e3) console.log('Error:', e3);
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
