import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import {
  INKLING_CONTEXT, INKLING_SLUG, LING_CONTEXT, LING_SLUG, PRODUCTION_SHAPED_DRY_RUN,
  seedCatalog20261106LingInkling, seedStepCounts,
} from '../data/catalog-2026-11-06-ling-inkling';
import { runRehearsable } from './rehearsal';

// Opt-in: needs a loopback Postgres with every migration applied (CI "Postgres seed check" step).
const localUrl = process.env.ARGON_TEST_DATABASE_URL;
const slugs = [LING_SLUG, INKLING_SLUG];

test('Ling / Inkling seed satisfies Postgres constraints, re-runs to 0, and dry-run commits nothing', { skip: !localUrl }, async () => {
  assert.ok(localUrl);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(localUrl).hostname));
  const { default: postgres } = await import('postgres');
  const sql = postgres(localUrl, { max: 1, onnotice: () => {} });
  try {
    const [{ providers, models }] = await sql<Array<{ providers: number; models: number }>>`
      SELECT
        (SELECT count(*)::int FROM providers WHERE slug IN ('inclusionai', 'thinkingmachines')) AS providers,
        (SELECT count(*)::int FROM models WHERE slug IN ${sql(slugs)}) AS models`;
    assert.equal(providers, 0, 'loopback DB should not already contain these providers');
    assert.equal(models, 0, 'loopback DB should not already contain these models');

    await sql.begin('isolation level serializable', async raw => {
      const tx = raw as unknown as Sql;
      const id = async (table: string, row: Record<string, unknown>) =>
        (await tx`INSERT INTO ${tx(table)} ${tx(row)} RETURNING id`)[0].id as number;
      await id('providers', { slug: 'inclusionai', name: 'inclusionai', type: 'producer', website: 'https://existing.example' });
      await id('providers', { slug: 'thinkingmachines', name: 'thinkingmachines', type: 'official' });
      const applied = await seedCatalog20261106LingInkling(tx, true);
      assert.deepEqual(seedStepCounts(applied), PRODUCTION_SHAPED_DRY_RUN);
      assert.deepEqual(await seedCatalog20261106LingInkling(tx, false), [], 'second dry-run after apply is empty');

      const rows = await tx<Array<Record<string, unknown>>>`SELECT slug, name, parameters, "active parameters" AS active_parameters,
        context_window, open_source, license, license_url, input_modalities, output_modalities
        FROM models WHERE slug IN ${tx(slugs)} ORDER BY slug`;
      const by = Object.fromEntries(rows.map(row => [row.slug, row]));
      assert.equal(by[LING_SLUG].name, 'Ling-3.2-flash');
      assert.equal(by[LING_SLUG].parameters, '560B');
      assert.equal(by[LING_SLUG].active_parameters, '25B');
      assert.equal(by[LING_SLUG].context_window, LING_CONTEXT);
      assert.equal(by[LING_SLUG].open_source, null);
      assert.equal(by[LING_SLUG].license, null);
      assert.deepEqual(by[LING_SLUG].input_modalities, ['text', 'image', 'video']);
      assert.deepEqual(by[LING_SLUG].output_modalities, ['text']);
      assert.equal(by[INKLING_SLUG].name, 'Inkling 2 Small');
      assert.equal(by[INKLING_SLUG].parameters, '594B');
      assert.equal(by[INKLING_SLUG].active_parameters, '17B');
      assert.equal(by[INKLING_SLUG].context_window, INKLING_CONTEXT);
      assert.equal(by[INKLING_SLUG].open_source, false);
      assert.equal(by[INKLING_SLUG].license, null);

      const prices = await tx<Array<Record<string, unknown>>>`
        SELECT m.slug, c.input_price_per_1m, c.output_price_per_1m, c.cached_input_price_per_1m,
               c.currency, c.promo_ends_at, c.regular_input_price_per_1m, c.regular_output_price_per_1m,
               c.regular_cached_input_price_per_1m
          FROM api_channel_prices c JOIN models m ON m.id = c.model_id
         WHERE m.slug IN ${tx(slugs)} ORDER BY m.slug`;
      const price = Object.fromEntries(prices.map(row => [row.slug, row]));
      assert.deepEqual([price[LING_SLUG].input_price_per_1m, price[LING_SLUG].output_price_per_1m, price[LING_SLUG].cached_input_price_per_1m], [0, 0, null]);
      assert.equal(price[LING_SLUG].currency, 'CNY');
      assert.equal(price[LING_SLUG].promo_ends_at, null);
      assert.equal(price[LING_SLUG].regular_input_price_per_1m, null);
      assert.equal(price[LING_SLUG].regular_output_price_per_1m, null);
      assert.equal(price[LING_SLUG].regular_cached_input_price_per_1m, null);
      assert.deepEqual([price[INKLING_SLUG].input_price_per_1m, price[INKLING_SLUG].cached_input_price_per_1m, price[INKLING_SLUG].output_price_per_1m], [0.3, 0.03, 1]);
      assert.equal(price[INKLING_SLUG].currency, 'USD');
      const trains = await tx<Array<{ price_kind: string; price: number; context_tokens: number | null }>>`
        SELECT price_kind, price, constraints_json->>'context_tokens' AS context_tokens
          FROM usage_prices up JOIN models m ON m.id = up.model_id
         WHERE m.slug = ${INKLING_SLUG} ORDER BY price_kind`;
      assert.deepEqual(trains.map(row => [row.price_kind, row.price, row.context_tokens]), [
        ['train 256K', 3, '262144'],
        ['train 64K', 1.5, null],
      ]);
      throw new Error('rollback');
    }).catch(error => { if ((error as Error).message !== 'rollback') throw error; });

    const rehearsed = await runRehearsable(sql, false, tx => seedCatalog20261106LingInkling(tx as unknown as Sql, true));
    for (const slug of ['inclusionai', 'thinkingmachines']) {
      const inserted = rehearsed.find(step => step.table === 'providers' && step.target === slug)!;
      assert.equal(inserted.changes.supported_regions.to, null);
      assert.equal(inserted.changes.regions_source_url.to, null);
      assert.equal(inserted.changes.regions_verified_at.to, null);
    }
    assert.equal(seedStepCounts(rehearsed).providers.insert, 2);
    assert.equal(seedStepCounts(rehearsed).models.insert, 2);
    assert.equal(seedStepCounts(rehearsed).api_channel_prices.insert, 2);
    assert.equal(seedStepCounts(rehearsed).usage_prices.insert, 2);
    const [{ n }] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM models WHERE slug IN ${sql(slugs)}`;
    assert.equal(n, 0, 'rehearsal dry-run must not commit');
  } finally { await sql.end(); }
});
