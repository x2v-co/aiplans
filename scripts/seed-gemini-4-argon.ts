#!/usr/bin/env tsx
/**
 * Default: read-only, field-by-field dry-run. --apply writes one transaction.
 * Apply the additive introductory-price migration before running this seed.
 * Resolves provider IDs from slugs; never creates a Cursor/Google provider.
 */
import { databaseSql as sql } from './db/postgres-admin';
import {
  ARGON_SLUG, ARGON_UNENTITLED_PLANS, argonModelRow, argonChannelRow, seedChanges,
} from './data/gemini-4-argon';
import type { ModelSelector } from '../src/lib/plan-selector';

const APPLY = process.argv.includes('--apply');
const args = process.argv.slice(2);
if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (APPLY && args.includes('--dry-run'))) {
  throw new Error('Usage: seed-gemini-4-argon.ts [--dry-run | --apply]');
}
const NOW = new Date();
type Row = Record<string, unknown> & { id: number };
type Step = { table: 'models' | 'api_channel_prices' | 'plans' | 'model_plan_mapping';
  action: 'insert' | 'update' | 'delete'; target: string; id: number | null;
  values: Record<string, unknown>; changes: Record<string, { from: unknown; to: unknown }> };

function changeStep(table: Step['table'], target: string, existing: Row | null, values: Record<string, unknown>): Step | null {
  const changes = seedChanges(existing, values);
  if (Object.keys(changes).length === 0) return null;
  return { table, target, action: existing ? 'update' : 'insert', id: existing?.id ?? null, values, changes };
}

async function main() {
  console.log(`seed-gemini-4-argon ${APPLY ? '[APPLY]' : '[DRY-RUN]'} (one transaction)`);
  await sql.begin('isolation level serializable', async rawTx => {
    const tx = rawTx as unknown as typeof sql;
    if (!APPLY) await tx`SET TRANSACTION READ ONLY`;
    const providers = await tx<Array<{ id: number; slug: string; type: string | null; has_api_prices: boolean }>>`
      SELECT p.id, p.slug, p.type, EXISTS (
        SELECT 1 FROM api_channel_prices cp WHERE cp.provider_id = p.id
      ) AS has_api_prices
      FROM providers p WHERE p.slug IN ('google', 'cursor', 'anysphere')`;
    const google = providers.find(p => p.slug === 'google');
    if (!google || !['official', 'producer'].includes(google.type ?? '')) throw new Error('Expected official/producer provider google; nothing written.');
    const models = await tx<Row[]>`SELECT * FROM models WHERE lower(slug) = ${ARGON_SLUG}`;
    if (models.length > 1) throw new Error('Ambiguous Argon model slug; nothing written.');
    const model = models[0] ?? null;
    const steps: Step[] = [];
    const add = (step: Step | null) => { if (step) steps.push(step); };
    add(changeStep('models', ARGON_SLUG, model, argonModelRow(google.id)));

    const cursorProviders = providers.filter(p => p.slug !== 'google' && p.has_api_prices);
    for (const provider of [google, ...cursorProviders]) {
      const rows = model ? await tx<Row[]>`
        SELECT * FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${provider.id}` : [];
      if (rows.length > 1) throw new Error(`Duplicate channel rows for ${provider.slug}/${ARGON_SLUG}; nothing written.`);
      add(changeStep('api_channel_prices', `${provider.slug}/${ARGON_SLUG}`, rows[0] ?? null,
        argonChannelRow(provider.id, model?.id ?? null, NOW, provider.slug === 'google')));
    }

    // Persist exclusions as well as removing incorrect existing links; the nightly
    // selector materializer must not put Argon back in Google Free / AI Pro.
    const plans = await tx<Array<Row & { slug: string; model_selector: ModelSelector | null }>>`
      SELECT * FROM plans WHERE provider_id = ${google.id} AND slug IN ${tx(ARGON_UNENTITLED_PLANS)}`;
    for (const plan of plans) {
      if (plan.model_selector && !plan.model_selector.exclude?.includes(ARGON_SLUG)) {
        add(changeStep('plans', `google/${plan.slug}`, plan, { model_selector: {
          ...plan.model_selector, exclude: [...(plan.model_selector.exclude ?? []), ARGON_SLUG],
        } }));
      }
      if (model) {
        const links = await tx<Row[]>`SELECT * FROM model_plan_mapping WHERE plan_id = ${plan.id} AND model_id = ${model.id}`;
        for (const link of links) steps.push({ table: 'model_plan_mapping', action: 'delete',
          target: `google/${plan.slug}/${ARGON_SLUG}`, id: link.id, values: {}, changes: { row: { from: link, to: null } } });
      }
    }
    console.log(JSON.stringify(steps.map(({ table, action, target, id, changes }) => ({ table, action, target, id, changes })), null, 2));
    console.log(`Planned: ${steps.length} row changes. New channel model_id=null means the model ID returned by the insert.`);
    console.log(cursorProviders.length
      ? `Cursor: ${cursorProviders.map(p => p.slug).join(', ')} already has API channels; seed its verified $2/$10 rates without an unverified future schedule.`
      : 'Cursor: no API channel provider; skip. X Subscription third-party models are billed separately, so no included model-plan mapping.');
    console.log('Google Batch/Flex/Priority: notes only; existing Google scrapers do not use tier variants.');
    if (!APPLY) {
      console.log('Dry-run: no writes. Each insert/update lists every changed field; changed rows also receive updated_at=now on apply.');
      return;
    }

    let modelId = model?.id ?? null;
    for (const step of steps) {
      if (step.action === 'delete') {
        await tx`DELETE FROM ${tx(step.table)} WHERE id = ${step.id}`;
        continue;
      }
      const values: Record<string, unknown> = { ...step.values, updated_at: NOW };
      if (step.table === 'api_channel_prices') {
        if (!modelId) throw new Error('Model insert did not return an ID.');
        Object.assign(values, { model_id: modelId });
      }
      const keys = Object.keys(values);
      if (step.action === 'update') await tx`UPDATE ${tx(step.table)} SET ${tx(values, ...keys)} WHERE id = ${step.id}`;
      else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(step.table)} ${tx(values, ...keys)} RETURNING id`;
        if (step.table === 'models') modelId = inserted.id;
      }
    }
    console.log('Applied in one transaction.');
  });
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => sql.end());
