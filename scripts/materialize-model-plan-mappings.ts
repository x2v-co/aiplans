#!/usr/bin/env tsx
/**
 * Materialize `model_plan_mapping` from each plan's `model_selector` rule.
 *
 * This replaces scripts/add-model-plan-mappings.ts, which read a hand-maintained
 * slug list (scripts/config/plan-model-slugs.ts), was insert-only, had no npm
 * script, and was referenced by no workflow or deploy script — so it had simply
 * never run against the drifted list. The result: 18 of its plan slugs no longer
 * existed, 19 live plans were absent from it, and 22 of 30 sampled models showed
 * no official plan at all.
 *
 * Contract:
 *   - Only `source='derived'` rows are ever deleted. Hand-added links
 *     (`source='manual'`) survive every run, mirroring the `plans.source`
 *     convention added after cleanupOutdatedPlans() once deleted 9 real plans.
 *   - One transaction per plan, so a mid-run failure cannot leave a plan with
 *     its old mappings deleted and no new ones written.
 *   - A plan going from N>0 mappings to 0 aborts the whole run. That is the
 *     shape of the bug this system exists to prevent, so it must never be
 *     something a scraper can do quietly. `--allow-empty` overrides.
 *
 * Usage:
 *   npx tsx scripts/materialize-model-plan-mappings.ts --dry-run
 *   npx tsx scripts/materialize-model-plan-mappings.ts
 *   npx tsx scripts/materialize-model-plan-mappings.ts --allow-empty
 */
import { databaseSql } from './db/postgres-admin';
import {
  resolveSelector,
  type ModelSelector,
  type SelectableModel,
} from '../src/lib/plan-selector';

const DRY_RUN = process.argv.includes('--dry-run');
const ALLOW_EMPTY = process.argv.includes('--allow-empty');

type PlanRow = {
  id: number;
  slug: string;
  name: string;
  provider_slug: string | null;
  plan_kind: string | null;
  model_selector: ModelSelector | null;
  derived_count: number;
  manual_count: number;
};

const log = (line: string) => console.log(line);

async function loadPlans(): Promise<PlanRow[]> {
  return databaseSql<PlanRow[]>`
    SELECT plan.id, plan.slug, plan.name, plan.plan_kind, plan.model_selector,
           provider.slug AS provider_slug,
           count(mapping.id) FILTER (WHERE mapping.source = 'derived')::int AS derived_count,
           count(mapping.id) FILTER (WHERE mapping.source = 'manual')::int  AS manual_count
      FROM plans AS plan
      LEFT JOIN providers AS provider ON provider.id = plan.provider_id
      LEFT JOIN model_plan_mapping AS mapping ON mapping.plan_id = plan.id
     GROUP BY plan.id, plan.slug, plan.name, plan.plan_kind, plan.model_selector, provider.slug
     ORDER BY provider.slug NULLS LAST, plan.slug
  `;
}

async function loadCatalog(): Promise<SelectableModel[]> {
  const rows = await databaseSql<
    { id: number; slug: string; provider_slugs: string[] | null; elo: number | null }[]
  >`
    SELECT model.id,
           model.slug,
           coalesce(
             (SELECT array_agg(provider.slug)
                FROM providers AS provider
               WHERE provider.id = ANY(model.provider_ids)),
             '{}'
           ) AS provider_slugs,
           (SELECT max(score.value)
              FROM model_benchmark_scores AS score
              JOIN benchmark_metrics AS metric ON metric.id = score.metric_id
             WHERE score.model_id = model.id AND metric.name = 'ELO') AS elo
      FROM models AS model
  `;
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    providerSlugs: row.provider_slugs ?? [],
    elo: row.elo,
  }));
}

type PlanPlan = {
  plan: PlanRow;
  /** Model ids in priority order — index becomes model_plan_mapping.priority (consumers sort ASC). */
  modelIds: number[];
  slugs: string[];
  problems: string[];
  /** True when the plan has no selector yet: leave its existing mappings alone. */
  skip: boolean;
};

async function main() {
  log(`\n🔗 materialize-model-plan-mappings  ${DRY_RUN ? '[DRY-RUN]' : '[APPLY]'}\n`);

  const plans = await loadPlans();
  const catalog = await loadCatalog();
  log(`Loaded ${plans.length} plans and ${catalog.length} models\n`);

  // ─ 1. Resolve every selector before touching the database, so the safety
  //   gate can see the whole picture instead of aborting halfway through.
  const resolved: PlanPlan[] = plans.map((plan) => {
    if (!plan.model_selector) {
      return { plan, modelIds: [], slugs: [], problems: [], skip: true };
    }
    const result = resolveSelector(
      plan.model_selector,
      catalog,
      plan.provider_slug ? [plan.provider_slug] : [],
    );
    return {
      plan,
      modelIds: result.models.map((model) => model.id),
      slugs: result.models.map((model) => model.slug),
      // An `extra` slug that matches no model means the config names a model
      // that does not exist — a typo, or a model that was renamed. Silently
      // dropping it is how the old hand-maintained list rotted.
      problems: result.unknownExtra.map((slug) => `extra references unknown model slug '${slug}'`),
      skip: false,
    };
  });

  // A plan with no selector yet is normal right after a scraper discovers it.
  // Leave its mappings alone and let the audit's plans.missing_kind check
  // nag about it, rather than failing the whole nightly run.
  const unclassified = resolved.filter((entry) => entry.skip);
  if (unclassified.length > 0) {
    log(`⚠ ${unclassified.length} plan(s) have no model_selector — skipping, mappings left as-is:`);
    for (const entry of unclassified) log(`    · ${entry.plan.provider_slug}/${entry.plan.slug}`);
    log(`  Add them to scripts/config/plan-classifications.ts and run \`npm run fix:kinds\`.\n`);
  }

  const actionable = resolved.filter((entry) => !entry.skip);

  // ─ 2. Safety gate. A plan losing every model it had is the exact failure
  //   this pipeline exists to prevent, so it must never happen quietly.
  //   Manual rows are never deleted, so a plan that still has one is safe.
  const wouldEmpty = actionable.filter(
    (entry) =>
      entry.modelIds.length === 0 &&
      entry.plan.manual_count === 0 &&
      entry.plan.derived_count > 0,
  );
  const configErrors = actionable.filter((entry) => entry.problems.length > 0);

  if (configErrors.length > 0) {
    log(`❌ ${configErrors.length} plan(s) have a broken selector:`);
    for (const entry of configErrors) {
      log(`    · ${entry.plan.provider_slug}/${entry.plan.slug}: ${entry.problems.join('; ')}`);
    }
    log('');
  }

  if (wouldEmpty.length > 0) {
    log(`❌ ${wouldEmpty.length} plan(s) would lose every model they had:`);
    for (const entry of wouldEmpty) {
      log(
        `    · ${entry.plan.provider_slug}/${entry.plan.slug}: ` +
          `${entry.plan.derived_count} derived → 0`,
      );
    }
    log('');
  }

  if (configErrors.length > 0 || (wouldEmpty.length > 0 && !ALLOW_EMPTY)) {
    if (wouldEmpty.length > 0 && !ALLOW_EMPTY) {
      log('Refusing to run. Fix the selectors, or pass --allow-empty if those plans really did drop their models.');
    } else {
      log('Refusing to run. Fix the selectors listed above.');
    }
    process.exitCode = 1;
    return;
  }

  // ─ 3. Apply, one transaction per plan.
  let inserted = 0;
  let deleted = 0;
  let unchanged = 0;

  log(`━━━ Materialize ${actionable.length} plans ━━━`);
  const bySlug = new Map(catalog.map((model) => [model.id, model.slug]));
  for (const entry of actionable) {
    const { plan, modelIds, slugs } = entry;
    const key = `${plan.provider_slug}/${plan.slug}`;

    const existing = await databaseSql<{ model_id: number; priority: number | null; source: string }[]>`
      SELECT model_id, priority, source
        FROM model_plan_mapping
       WHERE plan_id = ${plan.id}
       ORDER BY priority ASC NULLS LAST
    `;
    // A model already linked by hand needs no derived row: the link exists, and
    // the unique index would reject the duplicate anyway. Excluding it here (as
    // opposed to letting ON CONFLICT swallow it) is what keeps a second run a
    // no-op instead of a delete-and-reinsert that reports every plan as changed.
    const manualIds = new Set(
      existing.filter((row) => row.source === 'manual').map((row) => row.model_id),
    );
    const derived = existing.filter((row) => row.source === 'derived');
    const desired = modelIds.filter((id) => !manualIds.has(id));

    const before = derived.map((row) => row.model_id);
    const samePriorities = derived.every((row, index) => row.model_id === desired[index] && row.priority === index);
    if (before.length === desired.length && samePriorities) {
      unchanged += 1;
      log(`  ✓  ${key}: ${desired.length} derived${manualIds.size ? ` + ${manualIds.size} manual` : ''}, unchanged`);
      continue;
    }

    const added = desired.filter((id) => !before.includes(id));
    const removed = before.filter((id) => !desired.includes(id));

    log(
      `  🔧 ${key} [${plan.plan_kind}]: ${before.length} → ${desired.length} derived` +
        `${manualIds.size ? ` (+${manualIds.size} manual, untouched)` : ''}`,
    );
    if (added.length > 0) {
      log(`      + ${added.slice(0, 10).map((id) => bySlug.get(id)).join(', ')}${added.length > 10 ? ` … +${added.length - 10}` : ''}`);
    }
    if (removed.length > 0) {
      const label = (id: number) => bySlug.get(id) ?? ('model#' + String(id));
      const shown = removed.slice(0, 10).map(label).join(', ');
      log('      − ' + shown + (removed.length > 10 ? ' … +' + (removed.length - 10) : ''));
    }
    if (added.length === 0 && removed.length === 0) {
      log(`      (same models, new priority order: ${slugs.slice(0, 6).join(', ')}…)`);
    }

    if (!DRY_RUN) {
      await databaseSql.begin(async (transaction) => {
        // postgres@3 types TransactionSql as Omit<Sql, …>, which drops the
        // tagged-template call signature. Cast it back.
        const tx = transaction as unknown as typeof databaseSql;
        await tx`DELETE FROM model_plan_mapping WHERE plan_id = ${plan.id} AND source = 'derived'`;
        if (desired.length > 0) {
          const rows = desired.map((modelId, index) => ({
            plan_id: plan.id,
            model_id: modelId,
            priority: index,
            source: 'derived',
          }));
          await tx`
            INSERT INTO model_plan_mapping ${tx(rows, 'plan_id', 'model_id', 'priority', 'source')}
            ON CONFLICT (plan_id, model_id) DO NOTHING
          `;
        }
      });
    }

    inserted += desired.length;
    deleted += before.length;
  }

  log(`\n━━━ Summary ━━━`);
  log(`Plans unchanged: ${unchanged}`);
  log(`Derived mappings replaced: ${deleted} → ${inserted}`);
  const zero = actionable.filter((entry) => entry.modelIds.length === 0);
  if (zero.length > 0) {
    log(`\n⚠ ${zero.length} plan(s) resolve to 0 models:`);
    for (const entry of zero) log(`    · ${entry.plan.provider_slug}/${entry.plan.slug}`);
    log(`  The audit's plans.selector_empty check reports these as critical.`);
  }
  if (DRY_RUN) log(`\n(dry-run — no changes written)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => databaseSql.end());
