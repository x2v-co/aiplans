import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '/Users/kl/workspace/x2v/planprice/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

(async () => {
  console.log('Fixing data issues...');

  // Issue 1: Move minimax models from Moonshot to Minimax provider
  const { data: minimaxModels } = await supabase
    .from('products')
    .select('id, name, slug')
    .ilike('slug', 'minimax-%');

  console.log('Found ' + (minimaxModels?.length || 0) + ' minimax models under wrong provider');

  let fixed = 0;
  for (const m of minimaxModels || []) {
    const { error } = await supabase
      .from('products')
      .update({ provider_id: 48 })
      .eq('id', m.id);

    if (!error) {
      fixed++;
      console.log('  Fixed ' + m.name + ' (id=' + m.id + '): Moonshot -> Minimax');
    } else {
      console.log('  Failed to fix ' + m.name + ': ', error);
    }
  }

  console.log('  Fixed ' + fixed + ' minimax models');

  // Issue 2: Add Qwen 3.5 model (latest)
  console.log('--- Issue 2: Adding Qwen 3.5 model ---');

  const { data: existing } = await supabase
    .from('products')
    .select('id, name, slug, provider_id')
    .eq('slug', 'qwen3.5');

  if (existing && existing.data && !existing.error) {
    console.log('  Warning: qwen3.5 already exists: ' + existing.data.name + ' (id=' + existing.data.id + ')');
  } else {
    const { data: providers } = await supabase
      .from('providers')
      .select('id, name, slug')
      .eq('slug', 'qwen');

    const qwenProvider = providers.data && providers.data[0];

    if (!qwenProvider) {
      console.log('  Error: Qwen provider not found');
    } else {
      const { data: newModel, error } = await supabase
        .from('products')
        .insert({
          name: 'Qwen 3.5',
          slug: 'qwen3.5',
          provider_id: qwenProvider.id,
          type: 'llm',
          benchmark_arena_elo: 1443,
        })
        .select()
        .single();

      if (!error && newModel) {
        console.log('  Added Qwen 3.5 (id=' + newModel.data.id + '): ELO 1443');
      } else {
        console.log('  Failed to add Qwen 3.5: ', error);
      }
    }
  }

  console.log('Done!');
})().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
