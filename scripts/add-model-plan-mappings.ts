#!/usr/bin/env tsx

import { supabaseAdmin, getModelBySlug } from './db/queries';
import { normalizeSlug } from './utils/model-normalizer';
import { PLAN_MODEL_SLUGS } from './config/plan-model-slugs';

async function main() {
  console.log('Adding model-plan mappings...');

  // Get all plans
  const { data: plans } = await supabaseAdmin
    .from('plans')
    .select('id, slug, name')
    .order('id');

  let added = 0;
  let skipped = 0;
  let notFoundModel = 0;
  let notFoundPlan = 0;

  for (const plan of plans || []) {
    const planSlug = plan.slug;
    const modelSlugs = PLAN_MODEL_SLUGS[planSlug];

    if (!modelSlugs) {
      console.log(`  ⚠️  No models defined for plan: ${planSlug}`);
      continue;
    }

    console.log(`\nProcessing plan: ${plan.name} (${planSlug})`);

    for (const rawModelSlug of modelSlugs) {
      const modelSlug = normalizeSlug(rawModelSlug);

      // Get model by slug
      const model = await getModelBySlug(modelSlug);

      if (!model) {
        console.log(`    ⚠️  Model not found: ${modelSlug}`);
        notFoundModel++;
        continue;
      }

      // Check if mapping already exists
      const { data: existing } = await supabaseAdmin
        .from('model_plan_mapping')
        .select('id')
        .eq('plan_id', plan.id)
        .eq('model_id', model.id);

      if (existing && existing.length > 0) {
        console.log(`    ✓ Mapping exists: plan ${plan.id} -> ${modelSlug}`);
        skipped++;
        continue;
      }

      // Create model-plan mapping
      const { error } = await supabaseAdmin
        .from('model_plan_mapping')
        .insert({
          plan_id: plan.id,
          model_id: model.id,
        });

      if (!error) {
        added++;
        console.log(`    ✅ Added mapping: plan ${plan.id} -> ${modelSlug}`);
      } else {
        console.log(`    ❌ Failed to add mapping: ${modelSlug}`, error);
      }
    }
  }

  console.log(`\n📊 SUMMARY:`);
  console.log(`  ✅ Mappings added: ${added}`);
  console.log(`  ✓ Skipped (already exist): ${skipped}`);
  console.log(`  ⚠️  Model not found: ${notFoundModel}`);
  console.log(`  ⚠️  Plan not found: ${notFoundPlan}`);
}

main()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
