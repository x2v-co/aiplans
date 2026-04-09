#!/usr/bin/env tsx

import { supabaseAdmin } from './db/queries';

type ModelRow = {
  id: number;
  slug: string | null;
  name: string | null;
  provider_ids: number[] | null;
};

const PRODUCER_IDS = {
  openai: 33,
  anthropic: 34,
  google: 35,
  deepseek: 36,
  grok: 37,
  mistral: 38,
  moonshot: 39,
  minimax: 41,
  zhipu: 43,
  stepfun: 45,
  qwen: 46,
  seed: 47,
  hunyuan: 48,
  baidu: 49,
} as const;

function inferProducerId(slug: string, name = ''): number | null {
  const combined = `${slug} ${name}`.toLowerCase();

  if (
    combined.includes('gpt') ||
    slug.startsWith('o1') ||
    slug.startsWith('o3') ||
    slug.startsWith('o4') ||
    combined.includes('openai')
  ) {
    return PRODUCER_IDS.openai;
  }
  if (combined.includes('claude')) return PRODUCER_IDS.anthropic;
  if (combined.includes('gemini') || combined.includes('gemma') || combined.includes('palm')) {
    return PRODUCER_IDS.google;
  }
  if (combined.includes('deepseek')) return PRODUCER_IDS.deepseek;
  if (combined.includes('grok')) return PRODUCER_IDS.grok;
  if (combined.includes('mistral') || combined.includes('mixtral') || combined.includes('codestral')) {
    return PRODUCER_IDS.mistral;
  }
  if (combined.includes('moonshot') || combined.includes('kimi')) return PRODUCER_IDS.moonshot;
  if (combined.includes('minimax')) return PRODUCER_IDS.minimax;
  if (combined.includes('glm') || combined.includes('chatglm') || combined.includes('z-ai')) {
    return PRODUCER_IDS.zhipu;
  }
  if (combined.includes('step') || combined.includes('stepfun')) return PRODUCER_IDS.stepfun;
  if (combined.includes('qwen') || combined.includes('tongyi') || combined.includes('qwq')) {
    return PRODUCER_IDS.qwen;
  }
  if (combined.includes('seed') || combined.includes('doubao') || combined.includes('bytedance')) {
    return PRODUCER_IDS.seed;
  }
  if (combined.includes('hunyuan') || combined.includes('tencent')) return PRODUCER_IDS.hunyuan;
  if (combined.includes('ernie') || combined.includes('baidu')) return PRODUCER_IDS.baidu;

  return null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const { data: models, error } = await supabaseAdmin
    .from('models')
    .select('id, slug, name, provider_ids')
    .is('provider_ids', null)
    .order('slug')
    .limit(500);

  if (error) throw error;

  const targets = ((models || []) as ModelRow[])
    .map((model) => ({
      ...model,
      producer_id: inferProducerId(model.slug || '', model.name || ''),
    }))
    .filter((model) => model.producer_id);

  const counts: Record<number, number> = {};

  for (const model of targets) {
    counts[model.producer_id!] = (counts[model.producer_id!] || 0) + 1;

    if (dryRun) continue;

    const { error: updateError } = await supabaseAdmin
      .from('models')
      .update({ provider_ids: [model.producer_id] })
      .eq('id', model.id);

    if (updateError) throw updateError;
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        matched: targets.length,
        counts,
        preview: targets.slice(0, 20).map((model) => ({
          slug: model.slug,
          producer_id: model.producer_id,
        })),
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
