#!/usr/bin/env tsx

/**
 * 查看每个计划包含哪些模型
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('📋 查看计划包含的模型\n');

  // Query through model_plan_mapping junction table
  const { data: modelRelations, error } = await supabase
    .from('model_plan_mapping')
    .select(`
      plan_id,
      model_id,
      priority,
      plans:plan_id (
        name, slug, price, tier, provider_id,
        providers:provider_id (name, slug)
      ),
      models:model_id (name, slug)
    `)
    .order('plan_id, priority');

  if (error) {
    console.error('Error:', error);
    return;
  }

  // 按计划分组
  const planGroups: Record<number, any[]> = {};
  for (const rel of modelRelations || []) {
    const planId = rel.plan_id;
    if (!planGroups[planId]) {
      planGroups[planId] = [];
    }
    planGroups[planId].push({
      modelName: rel.models?.name,
      modelSlug: rel.models?.slug,
      planName: rel.plans?.name,
      planSlug: rel.plans?.slug,
      planPrice: rel.plans?.price,
      planTier: rel.plans?.tier,
      providerName: rel.plans?.providers?.name,
      priority: rel.priority,
    });
  }

  console.log('='.repeat(60));

  for (const [planId, relations] of Object.entries(planGroups)) {
    const first = relations[0];
    if (relations.length === 0) continue;

    console.log(`\n【${first.planName}】${first.planTier !== 'free' ? ` ($${first.planPrice}/月)` : ' (免费)'}`);
    console.log(`  提供商: ${first.providerName}`);
    console.log(`  Slug: ${first.planSlug}`);
    console.log(`  包含模型 (${relations.length} 个):`);

    relations.forEach((r, i) => {
      console.log(`    ${i + 1}. ${r.modelName} (${r.modelSlug})`);
    });
  }

  console.log(`\n共 ${Object.keys(planGroups).length} 个计划包含模型关联`);

  // 显示没有关联模型的计划
  const { data: allPlans } = await supabase
    .from('plans')
    .select('id, name, slug, price, tier')
    .order('id');

  if (allPlans) {
    const planIdsWithModels = new Set(Object.keys(planGroups).map(Number));
    const plansWithoutModels = allPlans.filter(p => !planIdsWithModels.has(p.id));

    if (plansWithoutModels.length > 0) {
      console.log('\n没有关联模型的计划:');
      for (const plan of plansWithoutModels) {
        console.log(`  - ${plan.name} (${plan.slug})`);
      }
    }
  }
}

main().catch(console.error);