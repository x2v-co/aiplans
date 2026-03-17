import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Check models table columns by getting one row
  const { data: models, error: e1 } = await supabase
    .from('models')
    .select('*')
    .limit(1);
  
  console.log('=== MODELS TABLE (sample) ===');
  console.log('Columns:', models?.[0] ? Object.keys(models[0]) : 'No data');
  console.log(JSON.stringify(models, null, 2));
  if (e1) console.log('Error:', e1);
  
  // Check if there's a score column on model_benchmark_scores
  // Using raw SQL to describe the table
  const { data: tableInfo, error: e2 } = await supabase.rpc('exec_sql', { 
    query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'model_benchmark_scores'" 
  }).catch(() => ({ data: null, error: 'RPC not available' }));
  
  console.log('\n=== MODEL_BENCHMARK_SCORES COLUMNS ===');
  console.log(tableInfo || 'Could not fetch via RPC');
  
  // Try alternative: check table structure via select
  const { data: scoreCheck, error: e3 } = await supabase
    .from('model_benchmark_scores')
    .select('id, model_id, score, value, benchmark_task_id')
    .limit(1);
  
  console.log('\n=== SAMPLE QUERY (id, model_id, score, value, benchmark_task_id) ===');
  console.log('Data:', scoreCheck);
  console.log('Error:', e3);
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
