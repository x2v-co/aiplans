#!/usr/bin/env tsx

import { supabaseAdmin } from './db/queries';

const GOOGLE_PROVIDER_ID = 35;

async function main() {
  const { data: models, error: modelsError } = await supabaseAdmin
    .from('models')
    .select('id, name, slug, provider_ids')
    .ilike('slug', 'gemini%')
    .order('slug');

  if (modelsError) {
    throw modelsError;
  }

  let updatedModels = 0;

  for (const model of models || []) {
    const providerIds = model.provider_ids || [];
    if (!providerIds.includes(GOOGLE_PROVIDER_ID)) {
      const { error } = await supabaseAdmin
        .from('models')
        .update({ provider_ids: [...providerIds, GOOGLE_PROVIDER_ID] })
        .eq('id', model.id);

      if (error) {
        throw error;
      }

      updatedModels += 1;
      console.log(`updated model provider_ids: ${model.slug}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        totalModels: models?.length || 0,
        updatedModels,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
