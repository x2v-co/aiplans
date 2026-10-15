import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';

export const HAIKU_SLUG = 'claude-haiku-5.5';
export const HEADLINE_KEY = 'prompt-le-100k';
const SOURCE = 'https://platform.claude.com/docs/en/about-claude/pricing';
type Row = Record<string, unknown> & { id: number };
export interface HeadlineStep { target: string; action: 'insert' | 'update'; changes: Record<string, unknown> }

/** Make the <=100K standard real-time variant (0.10/0.50) Haiku 5.5's only headline. Idempotent. */
export async function seedHaikuHeadline(tx: Sql, apply: boolean): Promise<HeadlineStep[]> {
  const [model] = await tx<Row[]>`SELECT id FROM models WHERE slug = ${HAIKU_SLUG}`;
  const [provider] = await tx<Row[]>`SELECT id FROM providers WHERE slug = 'anthropic'`;
  if (!model || !provider) throw new Error('claude-haiku-5.5 or anthropic provider missing; run p0-pricing first.');
  const variants = await tx<Row[]>`SELECT * FROM api_channel_price_variants WHERE model_id = ${model.id} AND provider_id = ${provider.id}`;
  const steps: HeadlineStep[] = [];
  const desired = {
    model_id: model.id, provider_id: provider.id, variant_key: HEADLINE_KEY, variant_name: '<=100K prompt',
    variant_kind: 'context_band', input_price_per_1m: 0.1, output_price_per_1m: 0.5, currency: 'USD',
    price_unit: 'per_1m_tokens', is_available: true, is_public: true, is_headline: true,
    constraints_json: { prompt_tokens_lte: 100000, processing: 'standard' }, source_url: SOURCE,
    last_verified: new Date('2026-10-15T00:00:00Z'),
  };
  const existing = variants.find(v => v.variant_key === HEADLINE_KEY) ?? null;
  const changes = seedChanges(existing, desired);
  if (Object.keys(changes).length) {
    steps.push({ target: HEADLINE_KEY, action: existing ? 'update' : 'insert', changes });
    if (apply) {
      if (existing) await tx`UPDATE api_channel_price_variants SET ${tx({ ...desired, updated_at: new Date() } as Record<string, unknown>)} WHERE id = ${existing.id}`;
      else await tx`INSERT INTO api_channel_price_variants ${tx(desired as Record<string, unknown>)}`;
    }
  }
  for (const v of variants.filter(v => v.variant_key !== HEADLINE_KEY && v.is_headline === true)) {
    steps.push({ target: String(v.variant_key), action: 'update', changes: { is_headline: { from: true, to: false } } });
    if (apply) await tx`UPDATE api_channel_price_variants SET is_headline = false, updated_at = now() WHERE id = ${v.id}`;
  }
  return steps;
}
