import { supabaseAdmin } from './db/queries';

async function main() {
  console.log('Creating Qwen 3.5 with correct provider...');

  const { data: qwenProvider } = await supabaseAdmin
    .from('providers')
    .select('id, name, slug')
    .ilike('name', '%Qwen%')
    .limit(1);

  if (!qwenProvider || qwenProvider.error) {
    console.log('Error: Qwen provider not found');
    process.exit(1);
  }

  console.log('Qwen provider id:', qwenProvider.id);

  const { data: existing } = await supabaseAdmin
    .from('products')
    .select('id')
    .eq('slug', 'qwen3.5');

  if (existing && existing.data && !existing.error) {
    console.log('qwen3.5 already exists:', existing.data.id);
  } else {
    const { data: newModel, error } = await supabaseAdmin
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
      console.log('  Added Qwen 3.5 (id:', newModel.data.id, 'ELO: 1443');
    } else {
      console.log('  Failed to add Qwen 3.5:', error);
      process.exit(1);
    }
  }

  console.log('Done!');
  process.exit(0);
})().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
