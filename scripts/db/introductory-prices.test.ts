import assert from 'node:assert/strict';
import test from 'node:test';

const localUrl = process.env.ARGON_TEST_DATABASE_URL;

test('channel upsert persists schedules, then clears every promo field for a plain price', { skip: !localUrl }, async () => {
  // This integration test is opt-in and never connects to a non-loopback host.
  assert.ok(localUrl);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(localUrl).hostname));
  process.env.DATABASE_URL = localUrl;
  const { databaseSql: sql } = await import('./postgres-admin');
  const { upsertChannelPrice } = await import('./queries');
  const slug = `gemini-test-argon-${process.pid}`;
  let modelId: number | undefined;
  let providerId: number | undefined;
  try {
    const [provider] = await sql<Array<{ id: number }>>`INSERT INTO providers (name, slug, type) VALUES ('Argon test', ${slug}, 'producer') RETURNING id`;
    providerId = provider.id;
    const [model] = await sql<Array<{ id: number }>>`INSERT INTO models (name, slug, type) VALUES ('Argon test', ${slug}, 'llm') RETURNING id`;
    modelId = model.id;
    const common = { model_id: modelId, provider_id: providerId, input_price_per_1m: 2,
      output_price_per_1m: 10, cached_input_price_per_1m: 0.1, is_available: true, last_verified: new Date() };
    const schedule = { promo_ends_at: '2026-12-01T08:00:00Z', regular_input_price_per_1m: 4,
      regular_output_price_per_1m: 20, regular_cached_input_price_per_1m: 0.2 };
    await upsertChannelPrice({ ...common, ...schedule });
    const [stored] = await sql`SELECT * FROM api_channel_prices WHERE model_id = ${modelId} AND provider_id = ${providerId}`;
    assert.equal(new Date(stored.promo_ends_at).toISOString(), '2026-12-01T08:00:00.000Z');
    assert.deepEqual([stored.regular_input_price_per_1m, stored.regular_output_price_per_1m, stored.regular_cached_input_price_per_1m], [4, 20, 0.2]);
    await upsertChannelPrice({ ...common, input_price_per_1m: 3, output_price_per_1m: 15 });
    const [plain] = await sql`SELECT * FROM api_channel_prices WHERE id = ${stored.id}`;
    assert.equal(plain.input_price_per_1m, 3);
    assert.deepEqual([plain.promo_ends_at, plain.regular_input_price_per_1m,
      plain.regular_output_price_per_1m, plain.regular_cached_input_price_per_1m], [null, null, null, null]);
    assert.equal((await sql`SELECT id FROM api_channel_prices WHERE model_id = ${modelId}`).length, 1);
  } finally {
    if (modelId) {
      await sql`DELETE FROM api_channel_prices WHERE model_id = ${modelId}`;
      await sql`DELETE FROM models WHERE id = ${modelId}`;
    }
    if (providerId) await sql`DELETE FROM providers WHERE id = ${providerId}`;
    await sql.end();
  }
});
