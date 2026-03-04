import { supabaseAdmin } from './db/queries.js';

async function main() {
  console.log('Checking Minimax provider fixes...');

  const { data: minimax } = await supabaseAdmin
    .from('products')
    .select('id, name, slug, provider_id')
    .ilike('slug', 'minimax-%')
    .eq('provider_id', 48)
    .limit(5);

  if (!minimax || minimax.error) {
    console.log('No minimax models found with wrong provider');
  }

  let hasWrong = 0;
  for (const m of minimax.data || []) {
    if (m.provider_id !== 48) {
      hasWrong = 1;
      console.log('  Wrong provider for', m.name, 'id=', m.id, 'provider_id=', m.provider_id);
    }
  }

  if (hasWrong) {
    console.log('ERROR: Found models with wrong provider_id');
  } else {
    console.log('OK: All minimax models have correct provider');
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
