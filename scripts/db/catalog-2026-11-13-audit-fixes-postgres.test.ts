import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import {
  PRODUCTION_SHAPED_DRY_RUN, QWEN_PREVIEW_SLUG, seedCatalog20261113AuditFixes, seedStepCounts,
} from '../data/catalog-2026-11-13-audit-fixes';

const localUrl = process.env.ARGON_TEST_DATABASE_URL;

test('2026-11-13 audit seed satisfies Postgres constraints, re-runs to 0, and rolls back', { skip: !localUrl }, async () => {
  assert.ok(localUrl);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(localUrl).hostname));
  const { default: postgres } = await import('postgres');
  const sql = postgres(localUrl, { max: 1, onnotice: () => {} });
  try {
    const run = () => sql.begin('isolation level serializable', async raw => {
      const tx = raw as unknown as Sql;
      const ensureProvider = async (row: Record<string, unknown>) => {
        const existing = (await tx<Array<{ id: number }>>`SELECT id FROM providers WHERE slug = ${row.slug as string}`)[0];
        if (existing) {
          await tx`UPDATE providers SET type = 'official' WHERE id = ${existing.id}`;
          return existing.id;
        }
        return (await tx<Array<{ id: number }>>`INSERT INTO ${tx('providers')} ${tx(row)} RETURNING id`)[0].id;
      };
      const eleven = await ensureProvider({ slug: 'elevenlabs', name: 'ElevenLabs', type: 'official' });
      const xai = await ensureProvider({ slug: 'xai', name: 'xAI', type: 'official' });
      await ensureProvider({ slug: 'qwen', name: 'Qwen', type: 'official' });

      const ensureModel = async (row: Record<string, unknown>) => {
        const existing = (await tx<Array<{ id: number }>>`SELECT id FROM models WHERE slug = ${row.slug as string}`)[0];
        if (existing) return existing.id;
        return (await tx<Array<{ id: number }>>`INSERT INTO ${tx('models')} ${tx(row)} RETURNING id`)[0].id;
      };
      const v2 = await ensureModel({ slug: 'elevenlabs-scribe-v2', name: 'Scribe v2', type: 'multimodal', model_category: 'speech', provider_ids: [eleven] });
      const rt = await ensureModel({ slug: 'elevenlabs-scribe-v2-realtime', name: 'Scribe v2 Realtime', type: 'multimodal', model_category: 'speech', provider_ids: [eleven] });
      await ensureModel({ slug: 'mistral-medium-3.5', name: 'Mistral Medium 3.5', type: 'llm', model_category: 'text' });
      await ensureModel({ slug: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite', type: 'llm', model_category: 'text' });
      await ensureModel({ slug: 'mistral-devstral-2512', name: 'Devstral 2', type: 'llm', model_category: 'text' });
      await ensureModel({ slug: 'gpt-image-2', name: 'GPT Image 2', type: 'multimodal', model_category: 'image' });
      const agent = await ensureModel({ slug: 'grok-imagine-video-1-5-agent', name: 'grok-imagine-video-1.5-agent', type: 'multimodal', model_category: 'video', provider_ids: [xai], pricing_unit: 'per_second' });
      const video720 = await ensureModel({ slug: 'grok-imagine-video-720p', name: 'grok-imagine-video-720p', type: 'multimodal', model_category: 'video', provider_ids: [xai], pricing_unit: 'per_second' });

      const ensureUsage = async (row: Record<string, unknown>) => {
        const existing = (await tx<Array<{ id: number }>>`
          SELECT id FROM usage_prices WHERE model_id = ${row.model_id as number} AND provider_id = ${row.provider_id as number} AND price_kind = ${row.price_kind as string}`)[0];
        if (existing) return;
        await tx`INSERT INTO ${tx('usage_prices')} ${tx(row)}`;
      };
      await ensureUsage({ model_id: v2, provider_id: eleven, price_kind: 'transcription_batch', unit: 'hour', price: 0.22, currency: 'USD' });
      await ensureUsage({ model_id: rt, provider_id: eleven, price_kind: 'transcription_streaming', unit: 'hour', price: 0.39, currency: 'USD' });
      await ensureUsage({ model_id: agent, provider_id: xai, price_kind: 'grok-imagine-video-1.5 480p', unit: 'second', price: 0.08, currency: 'USD' });
      await ensureUsage({ model_id: agent, provider_id: xai, price_kind: 'grok-imagine-video-1.5 720p', unit: 'second', price: 0.14, currency: 'USD' });
      await ensureUsage({ model_id: agent, provider_id: xai, price_kind: 'grok-imagine-video-1.5 1080p', unit: 'second', price: 0.25, currency: 'USD' });
      await ensureUsage({ model_id: video720, provider_id: xai, price_kind: 'grok-imagine-video 1.0 720p', unit: 'second', price: 0.07, currency: 'USD' });

      const applied = await seedCatalog20261113AuditFixes(tx, true);
      assert.deepEqual(seedStepCounts(applied), PRODUCTION_SHAPED_DRY_RUN);
      assert.deepEqual(
        (await seedCatalog20261113AuditFixes(tx, false)).filter(step => step.action !== 'skip'),
        [],
        'second dry-run after apply is empty',
      );
      throw new Error('rollback');
    });
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await run().catch(error => { if ((error as Error).message !== 'rollback') throw error; });
        break;
      } catch (error) {
        const message = (error as Error).message ?? '';
        if (attempt === 3 || !/duplicate key|could not serialize|23505|40001/.test(message)) throw error;
      }
    }
    const [{ left }] = await sql<Array<{ left: number }>>`SELECT count(*)::int AS left FROM models WHERE slug = ${QWEN_PREVIEW_SLUG}`;
    assert.equal(left, 0, 'constraint check must not commit');
  } finally { await sql.end(); }
});
