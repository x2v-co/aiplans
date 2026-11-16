import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import {
  FLASH_SLUG, PREVIEW_NOTICE, PREVIEW_SLUG, PROMO_ENDS_AT, VERIFIED_AT,
  flashChannelRow, seedHy4Flash,
} from '../data/catalog-2026-11-16-hy4-flash';
import { runRehearsable } from './rehearsal';

// CI's existing variable alone enables this test. Never load dotenv/admin or
// import the postgres runtime/create a client until the URL is validated.
const localUrl = process.env.ARGON_TEST_DATABASE_URL;
function assertLoopbackDatabaseUrl(value: string) {
  const url = new URL(value);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol), 'PostgreSQL URL required');
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Strict loopback DB required');
  assert.ok(url.pathname.length > 1 && url.pathname !== '/', 'Explicit test database required');
  assert.equal(url.search, '', 'Query overrides are forbidden on the loopback fixture URL');
  assert.equal(url.hash, '', 'URL fragment is forbidden');
}

test('Hy4 Flash PG fixture URL guard rejects remote hosts and connection overrides offline', () => {
  for (const url of ['postgres://test@127.0.0.1/fixture', 'postgresql://test@localhost:5432/fixture', 'postgres://test@[::1]/fixture']) {
    assert.doesNotThrow(() => assertLoopbackDatabaseUrl(url));
  }
  for (const url of ['postgres://test@db.example/fixture', 'postgres://test@127.0.0.1.example/fixture',
    'postgres://test@127.0.0.2/fixture', 'https://localhost/fixture', 'postgres://localhost/',
    'postgres://localhost/fixture?host=remote.example', 'postgres://localhost/fixture?hostaddr=8.8.8.8',
    'postgres://localhost/fixture#override', 'not a URL']) {
    assert.throws(() => assertLoopbackDatabaseUrl(url));
  }
});

test('Hy4 Flash satisfies real PG constraints and re-runs to zero; every fixture/write rolls back', { skip: !localUrl }, async () => {
  assert.ok(localUrl);
  assertLoopbackDatabaseUrl(localUrl);
  const { default: postgres } = await import('postgres');
  const sql = postgres(localUrl, { max: 1, onnotice: () => {} });
  try {
    const targetSlugs = [FLASH_SLUG, PREVIEW_SLUG, 'tencent-hy4'];
    const snapshot = async () => sql`SELECT * FROM models WHERE slug IN ${sql(targetSlugs)} ORDER BY id`;
    const before = await snapshot();
    assert.equal(before.length, 0, 'Use an isolated migrated test DB without Hy4 catalogue rows');
    const run = () => runRehearsable(sql, false, async raw => {
      const tx = raw as unknown as Sql;
      const insert = async (table: string, payload: Record<string, unknown>): Promise<number> =>
        (await tx`INSERT INTO ${tx(table)} ${tx(payload, ...Object.keys(payload))} RETURNING id`)[0].id as number;
      const ensureProvider = async (slug: string, type: string) =>
        (await tx`SELECT id FROM providers WHERE slug = ${slug}`)[0]?.id as number | undefined
          ?? await insert('providers', { slug, name: slug, type });
      const tencent = await ensureProvider('tencent', 'producer');
      const openrouter = await ensureProvider('openrouter', 'aggregator');
      const preview = await insert('models', {
        slug: PREVIEW_SLUG, name: 'Hy4 Preview', type: 'llm', model_category: 'text', provider_ids: [tencent],
        description: 'Fixture existing Preview description.', shutdown_date: null, deprecated_at: null,
        replacement_model: 'Keep existing metadata', context_window: 256000, max_output_tokens: 65536,
      });
      const ga = await insert('models', {
        slug: 'tencent-hy4', name: 'Hy4', type: 'llm', model_category: 'text', provider_ids: [tencent],
        description: 'Fixture GA', context_window: 1048576, max_output_tokens: 65536,
      });
      for (const [modelId, providerId] of [[preview, tencent], [preview, openrouter], [ga, tencent], [ga, openrouter]]) {
        await insert('api_channel_prices', { ...flashChannelRow(modelId, providerId), notes: 'Keep fixture price',
          input_price_per_1m: 0.834, output_price_per_1m: 2.501 });
      }
      const [previewBefore] = await tx`SELECT * FROM models WHERE id = ${preview}`;
      const [gaBefore] = await tx`SELECT * FROM models WHERE id = ${ga}`;
      const pricesBefore = await tx`SELECT * FROM api_channel_prices WHERE model_id IN ${tx([preview, ga])} ORDER BY id`;
      const steps = await seedHy4Flash(tx, false);
      assert.deepEqual(steps.map(s => [s.table, s.action]), [['models', 'insert'], ['api_channel_prices', 'insert'], ['models', 'update']]);
      assert.equal((await tx`SELECT id FROM models WHERE slug = ${FLASH_SLUG}`).length, 0, 'planning does not insert');
      assert.equal((await seedHy4Flash(tx, true)).length, 3);
      assert.deepEqual(await seedHy4Flash(tx, true), [], 'PG real values and Dates must re-run to zero');
      const [model] = await tx`SELECT * FROM models WHERE slug = ${FLASH_SLUG}`;
      assert.equal(model.name, 'Hy4 Flash');
      assert.equal(model.context_window, 1000000);
      assert.equal(model.max_output_tokens, null);
      assert.equal(model.open_source, null);
      assert.equal(model.license, null);
      assert.deepEqual(model.input_modalities, ['text', 'image']);
      assert.deepEqual(model.output_modalities, ['text']);
      assert.deepEqual(model.provider_ids, [tencent]);
      const channels = await tx`SELECT * FROM api_channel_prices WHERE model_id = ${model.id}`;
      assert.equal(channels.length, 1);
      const channel = channels[0];
      assert.equal(channel.provider_id, tencent);
      assert.equal(channel.currency, 'USD');
      for (const [key, value] of Object.entries(flashChannelRow(model.id, tencent))) {
        if (typeof value === 'number' && /price_per_1m$/.test(key)) {
          // PG may print either a shortest-round-trip decimal or expanded real.
          assert.equal(Math.fround(Number(channel[key])), Math.fround(value), key);
        }
      }
      assert.equal(new Date(channel.promo_ends_at).toISOString(), PROMO_ENDS_AT.toISOString());
      assert.equal(new Date(channel.last_verified).toISOString(), VERIFIED_AT.toISOString());
      assert.equal((await tx`SELECT id FROM api_channel_price_variants WHERE model_id = ${model.id}`).length, 0);
      const [previewAfter] = await tx`SELECT * FROM models WHERE id = ${preview}`;
      assert.deepEqual(previewAfter, { ...previewBefore, description: previewBefore.description + '\n\n' + PREVIEW_NOTICE });
      assert.deepEqual((await tx`SELECT * FROM models WHERE id = ${ga}`)[0], gaBefore);
      assert.deepEqual(await tx`SELECT * FROM api_channel_prices WHERE model_id IN ${tx([preview, ga])} ORDER BY id`, pricesBefore);

      // Real PG update shape: preserve an unrelated channel column and lock.
      await tx`UPDATE api_channel_prices SET input_price_per_1m = 9, is_available = false, availability_locked = true, rate_limit = 987 WHERE id = ${channel.id}`;
      const updates = await seedHy4Flash(tx, true);
      assert.deepEqual(updates.map(s => [s.table, s.action]), [['api_channel_prices', 'update']]);
      const [locked] = await tx`SELECT * FROM api_channel_prices WHERE id = ${channel.id}`;
      assert.equal(locked.is_available, false);
      assert.equal(locked.availability_locked, true);
      assert.equal(locked.rate_limit, 987);
      assert.deepEqual(await seedHy4Flash(tx, true), []);
      await tx`UPDATE api_channel_prices SET last_verified = ${new Date(VERIFIED_AT.getTime() + 1)}, notes = 'Fresher PG evidence', output_price_per_1m = 7 WHERE id = ${channel.id}`;
      const [freshBefore] = await tx`SELECT * FROM api_channel_prices WHERE id = ${channel.id}`;
      assert.deepEqual(await seedHy4Flash(tx, true), []);
      assert.deepEqual((await tx`SELECT * FROM api_channel_prices WHERE id = ${channel.id}`)[0], freshBefore);
    });
    // Existing CI fixtures share provider slugs across independently rolled-back
    // tests. Retry only their uniqueness/serializable conflicts, never commit.
    for (let attempt = 0; ; attempt++) {
      try { await run(); break; }
      catch (error) {
        if (attempt >= 3 || !['23505', '40001'].includes(String((error as { code?: string }).code))) throw error;
      }
    }
    assert.deepEqual(await snapshot(), before, 'all catalogue fixtures and seed writes rolled back');
  } finally { await sql.end(); }
});
