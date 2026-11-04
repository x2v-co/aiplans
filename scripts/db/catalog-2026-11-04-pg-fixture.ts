import type { Sql } from 'postgres';
import { LONGCAT_SOURCE } from '../data/catalog-2026-11-04';

/**
 * Production-shaped rows the 2026-11-04 seed reads, reconstructed from the production dry-run
 * (2026-11-04 12:01 SGT: 74 changes, 61 insert / 13 update). Only for a local, migrated Postgres:
 * the real CHECK constraints are what the in-memory fake cannot catch (pricing_unit, currency).
 */
export async function loadCatalog1104ProductionFixture(sql: Sql) {
  const id = async (table: string, row: Record<string, unknown>) =>
    (await sql`INSERT INTO ${sql(table)} ${sql(row)} RETURNING id`)[0].id as number;
  const provider = (slug: string, name: string, type: string, extra: Record<string, unknown> = {}) =>
    id('providers', { slug, name, type, ...extra });
  const openai = await provider('openai', 'OpenAI', 'official');
  const google = await provider('google', 'Google', 'producer');
  const xai = await provider('xai', 'xAI', 'producer');
  const meituan = await provider('meituan', 'Meituan', 'official', {
    access_from_china: null, pricing_url: LONGCAT_SOURCE,
    notes: 'Identity from OpenRouter model namespace; provider metadata needs verification.',
  });
  const elevenlabs = await provider('elevenlabs', 'ElevenLabs', 'official');
  const mureka = await provider('mureka', 'Mureka', 'official');

  const older = new Date('2026-10-28T05:01:23.897Z');
  const plan = (slug: string, owner: number, extra: Record<string, unknown>) => id('plans', {
    slug, name: slug, provider_id: owner, product_id: owner, pricing_model: 'subscription', price_unit: 'per_month', ...extra,
  });
  await plan('chatgpt-go', openai, { access_from_china: true, price: null, currency: 'USD', last_verified: null,
    notes: '[needs-verification] No current USD amount could be verified from the official Help Center.' });
  for (const [slug, price] of [['chatgpt-pro-100', 100], ['chatgpt-pro-200', 200], ['chatgpt-pro-500', 500], ['chatgpt-business', 30], ['chatgpt-business-premium', 60]] as const) {
    await plan(slug, openai, { price, currency: 'USD', last_verified: older, notes: 'Monthly billing. Included allowances vary by model and tier; API billing is separate.' });
  }
  await plan('google-ai-plus', google, { price: null, currency: null, last_verified: null,
    notes: '[needs-verification] Plus/Pro US price not identified on the page; prices withheld.' });

  const arena = 'Version-level text-to-video leaderboard entry from Arena AI. Status: available. Pricing confidence: unknown.';
  const model = (row: Record<string, unknown>) => id('models', row);
  await model({ slug: 'gemini-3.5-transcribe', name: 'gemini-3.5-transcribe', type: 'llm', model_category: 'text', provider_ids: [google],
    input_modalities: [], output_modalities: [], capabilities: [] });
  await model({ slug: 'grok-imagine-video-720p', name: 'grok-imagine-video-720p', type: 'video', model_category: 'video', provider_ids: [xai],
    input_modalities: ['text'], output_modalities: ['video'], capabilities: ['leaderboard-version', 'text-to-video'], pricing_unit: 'unknown',
    offical_link: 'https://docs.x.ai/docs/guides/video-generations', description: `${arena} Arena AI rank #17.` });
  await model({ slug: 'grok-imagine-video-1-5-agent', name: 'grok-imagine-video-1.5-agent', type: 'video', model_category: 'video', provider_ids: [xai],
    input_modalities: ['text'], output_modalities: ['video'], capabilities: ['leaderboard-version', 'text-to-video'], pricing_unit: 'unknown',
    offical_link: 'https://x.com/grok/status/2096298105213952178', description: `${arena} Arena AI rank #5.` });
  await model({ slug: 'mureka', name: 'Mureka', type: 'multimodal', model_category: 'music', provider_ids: [mureka],
    input_type: ['text', 'audio'], output_type: ['music', 'audio'], input_modalities: ['text', 'audio'], output_modalities: ['music', 'audio'],
    capabilities: ['music generation', 'vocals', 'lyrics', 'instrumentals'], pricing_unit: 'unknown',
    offical_link: 'https://www.mureka.ai/subscribe', description: 'Full song generation with vocals, lyrics and instrumentals from text prompts.' });
  const terra = await model({ slug: 'gpt-6.1-terra', name: 'GPT-6.1 Terra', type: 'llm', model_category: 'text', provider_ids: [openai] });
  await model({ slug: 'meituan-longcat-2-5', name: 'LongCat-2.5', type: 'llm', model_category: 'text', provider_ids: [meituan],
    description: 'Meituan LongCat-2.5, released 2026-11-02 on the LongCat API Open Platform.' });
  // Terra's channel was already refreshed the same day, so the seed leaves it unchanged (0 channel updates in production).
  await id('api_channel_prices', { model_id: terra, provider_id: openai, input_price_per_1m: 1, output_price_per_1m: 5, cached_input_price_per_1m: 0.05,
    currency: 'USD', price_unit: 'per_1m_tokens', is_available: true, last_verified: new Date('2026-11-04T02:00:00Z'), notes: 'Scraper refresh 2026-11-04.' });
  return { openai, google, xai, meituan, elevenlabs, mureka, terra };
}
