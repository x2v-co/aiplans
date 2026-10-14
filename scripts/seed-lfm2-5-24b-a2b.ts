#!/usr/bin/env tsx
/** Default: read-only dry-run. --apply writes the reviewed plan in one transaction. */
import { databaseSql as sql } from './db/postgres-admin';
import { seedChanges } from './data/gemini-4-argon';
import { LFM_SLUG, liquidProviderRow, lfmModelRow, lfmOfficialChannelRow } from './data/lfm2-5-24b-a2b';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (APPLY && args.includes('--dry-run'))) {
  throw new Error('Usage: seed-lfm2-5-24b-a2b.ts [--dry-run | --apply]');
}
const NOW = new Date();
type Row = Record<string, unknown> & { id: number };
type Step = {
  table: 'providers' | 'models' | 'api_channel_prices';
  target: string; id: number | null; values: Record<string, unknown>;
  changes: ReturnType<typeof seedChanges>;
};

async function main() {
  console.log(`seed-lfm2-5-24b-a2b ${APPLY ? '[APPLY]' : '[DRY-RUN]'} (one transaction)`);
  await sql.begin('isolation level serializable', async rawTx => {
    const tx = rawTx as unknown as typeof sql;
    if (!APPLY) await tx`SET TRANSACTION READ ONLY`;
    const providers = await tx<Array<Row & { type: string | null }>>`
      SELECT * FROM providers WHERE lower(slug) = 'liquid'`;
    if (providers.length > 1) throw new Error('Ambiguous Liquid provider; nothing written.');
    const liquid = providers[0] ?? null;
    if (liquid && !['official', 'producer'].includes(liquid.type ?? '')) {
      throw new Error('Expected official/producer provider liquid; nothing written.');
    }
    // Refuse alternate identities rather than silently creating a second model.
    const candidates = [LFM_SLUG, 'lfm-2.5-24b-a2b', 'lfm2.5-24b-a2b', 'liquid-lfm2-5-24b-a2b'];
    const models = await tx<Array<Row & { slug: string }>>`
      SELECT * FROM models WHERE lower(slug) IN ${tx(candidates)}`;
    if (models.length > 1 || (models[0] && models[0].slug !== LFM_SLUG)) {
      throw new Error('Ambiguous/noncanonical LFM model slug; review existing rows before seeding. Nothing written.');
    }
    const model = models[0] ?? null;
    const channels = model && liquid ? await tx<Row[]>`
      SELECT * FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${liquid.id}` : [];
    if (channels.length > 1) throw new Error('Duplicate Liquid official channel rows; nothing written.');

    const steps: Step[] = [];
    const add = (table: Step['table'], target: string, existing: Row | null, values: Record<string, unknown>) => {
      const changes = seedChanges(existing, values);
      if (Object.keys(changes).length) steps.push({ table, target, id: existing?.id ?? null, values, changes });
    };
    if (!liquid) add('providers', 'liquid', null, liquidProviderRow());
    add('models', LFM_SLUG, model, lfmModelRow(liquid?.id ?? null));
    add('api_channel_prices', `liquid/${LFM_SLUG}`, channels[0] ?? null,
      lfmOfficialChannelRow(liquid?.id ?? null, model?.id ?? null));

    console.log(JSON.stringify(steps.map(({ table, target, id, changes }) => ({
      table, target, action: id == null ? 'insert' : 'update', id, changes,
    })), null, 2));
    console.log(`Planned: ${steps.length} row changes. Null dependency IDs are replaced by IDs returned from inserts.`);
    console.log('OpenRouter prices/endpoint variants: next successful scraper run resolves this exact model slug. No OpenRouter seed rows.');
    if (!APPLY) {
      console.log('Dry-run: no writes. Changed rows also receive updated_at=now on apply.');
      return;
    }

    let liquidId = liquid?.id ?? null;
    let modelId = model?.id ?? null;
    for (const step of steps) {
      const values: Record<string, unknown> = { ...step.values, updated_at: NOW };
      if (step.table === 'models') {
        if (liquidId == null) throw new Error('Provider insert did not return an ID.');
        Object.assign(values, { provider_ids: [liquidId] });
      }
      if (step.table === 'api_channel_prices') {
        if (liquidId == null || modelId == null) throw new Error('Missing channel dependency ID.');
        Object.assign(values, { provider_id: liquidId, model_id: modelId });
      }
      const keys = Object.keys(values);
      if (step.id != null) await tx`UPDATE ${tx(step.table)} SET ${tx(values, ...keys)} WHERE id = ${step.id}`;
      else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(step.table)} ${tx(values, ...keys)} RETURNING id`;
        if (step.table === 'providers') liquidId = inserted.id;
        if (step.table === 'models') modelId = inserted.id;
      }
    }
    console.log('Applied in one transaction.');
  });
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => sql.end());
