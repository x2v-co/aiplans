#!/usr/bin/env tsx
/**
 * Classify every plan onto the product-line axis introduced by migration 013,
 * and seed each plan's `model_selector`.
 *
 * Why this exists: all 54 plans were squashed onto the single `tier` axis, so
 * `tier` was being abused to express scale (`glm-coding-max`, an individual
 * plan, was tagged `enterprise`; `minimax-token-max`, merely a bigger token
 * bundle, was tagged `team`). A ChatGPT Plus subscription, a GLM Coding Plan and
 * a MiniMax token bundle are not comparable products, but the UI compared them.
 *
 * After this runs, `tier` means only *who the plan is for* (individual / team /
 * enterprise) and the new columns carry everything else:
 *   plan_kind  — product line type (chat / coding / agent / token_pack / api_tier)
 *   plan_line  — the specific line, e.g. 'claude' vs 'glm-coding'
 *   tier_rank  — position within the line, ascending by price
 *
 * `model_selector` replaces scripts/config/plan-model-slugs.ts. See
 * src/lib/plan-selector.ts for the evaluation rules and why a rule beats a list.
 *
 * The classification table itself lives in scripts/config/plan-classifications.ts
 * so that audit-data.ts can check coverage against the same source.
 *
 * Usage:
 *   npx tsx scripts/fix-plan-kinds.ts --dry-run    # preview, no writes
 *   npx tsx scripts/fix-plan-kinds.ts              # apply
 *
 * Classification verified against each vendor's official plan page.
 */
import { databaseSql } from './db/postgres-admin';
import {
  resolveSelector,
  type ModelSelector,
  type SelectableModel,
} from '../src/lib/plan-selector';
import { CLASSIFICATIONS } from './config/plan-classifications';

const DRY_RUN = process.argv.includes('--dry-run');

// ────────────────────────────────────────────────────────────────────────────
// runner
// ────────────────────────────────────────────────────────────────────────────
const log = (line: string) => console.log(line);
const applied: string[] = [];
const skipped: string[] = [];

type PlanRow = {
  id: number;
  slug: string;
  name: string;
  provider_slug: string | null;
  plan_kind: string | null;
  plan_line: string | null;
  tier_rank: number | null;
  secondary_kinds: string[] | null;
  model_selector: ModelSelector | null;
};

async function loadPlans(): Promise<PlanRow[]> {
  return databaseSql<PlanRow[]>`
    SELECT plan.id, plan.slug, plan.name,
           provider.slug AS provider_slug,
           plan.plan_kind, plan.plan_line, plan.tier_rank,
           plan.secondary_kinds, plan.model_selector
      FROM plans AS plan
      LEFT JOIN providers AS provider ON provider.id = plan.provider_id
     ORDER BY provider.slug NULLS LAST, plan.price NULLS FIRST
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

function sameSelector(left: ModelSelector | null, right: ModelSelector): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function main() {
  log(`\n📋 fix-plan-kinds  ${DRY_RUN ? '[DRY-RUN]' : '[APPLY]'}\n`);

  const plans = await loadPlans();
  const catalog = await loadCatalog();
  const byKey = new Map(plans.map((plan) => [`${plan.provider_slug}/${plan.slug}`, plan]));

  log(`Loaded ${plans.length} plans and ${catalog.length} models\n`);

  // ─ 1. Uncovered plans. A plan with no classification keeps plan_kind='chat'
  //   from the migration default and gets no selector, so it would silently show
  //   zero models. Surface it loudly instead.
  const covered = new Set(CLASSIFICATIONS.map((entry) => `${entry.providerSlug}/${entry.planSlug}`));
  const uncovered = plans.filter((plan) => !covered.has(`${plan.provider_slug}/${plan.slug}`));
  if (uncovered.length > 0) {
    log(`⚠ ${uncovered.length} plan(s) have no classification entry — add them to CLASSIFICATIONS:`);
    for (const plan of uncovered) log(`    · ${plan.provider_slug}/${plan.slug} (#${plan.id} ${plan.name})`);
    log('');
    for (const plan of uncovered) skipped.push(`UNCOVERED ${plan.provider_slug}/${plan.slug}`);
  }

  // ─ 2. Apply.
  log(`━━━ Classify ${CLASSIFICATIONS.length} plans ━━━`);
  for (const entry of CLASSIFICATIONS) {
    const key = `${entry.providerSlug}/${entry.planSlug}`;
    const plan = byKey.get(key);
    if (!plan) {
      log(`  ⏭  ${key}: plan not found in DB`);
      skipped.push(`CLASSIFY ${key}: plan not found`);
      continue;
    }

    const resolution = resolveSelector(entry.selector, catalog, [entry.providerSlug]);
    const secondary = entry.secondaryKinds ?? [];

    const unchanged =
      plan.plan_kind === entry.kind &&
      plan.plan_line === entry.line &&
      plan.tier_rank === entry.rank &&
      JSON.stringify(plan.secondary_kinds ?? []) === JSON.stringify(secondary) &&
      sameSelector(plan.model_selector, entry.selector);

    const detail =
      `${entry.kind}/${entry.line}#${entry.rank}` +
      `${secondary.length ? ` +${secondary.join(',')}` : ''}` +
      ` → ${resolution.models.length} models`;

    // A selector that resolves to nothing is worse than the old hand-written
    // list: it looks configured but publishes an empty plan. Refuse it.
    if (resolution.models.length === 0) {
      log(`  ❌ ${key}: selector resolves to 0 models — fix the rule before applying`);
      skipped.push(`CLASSIFY ${key}: selector resolves to 0 models`);
      continue;
    }
    if (resolution.unknownExtra.length > 0) {
      log(`  ❌ ${key}: extra references unknown model slug(s): ${resolution.unknownExtra.join(', ')}`);
      skipped.push(`CLASSIFY ${key}: unknown extra ${resolution.unknownExtra.join(', ')}`);
      continue;
    }

    if (unchanged) {
      log(`  ✓  ${key}: already ${detail}, skip`);
      continue;
    }

    log(`  🔧 ${key}: ${plan.plan_kind ?? 'null'}/${plan.plan_line ?? 'null'}#${plan.tier_rank ?? 'null'} → ${detail}`);
    log(`      reason: ${entry.reason}`);
    if (resolution.unusedExclude.length > 0) {
      log(`      note: exclude pattern(s) matched nothing: ${resolution.unusedExclude.join(', ')}`);
    }

    if (!DRY_RUN) {
      try {
        await databaseSql`
          UPDATE plans
             SET plan_kind = ${entry.kind},
                 plan_line = ${entry.line},
                 tier_rank = ${entry.rank},
                 secondary_kinds = ${databaseSql.array(secondary)},
                 model_selector = ${databaseSql.json(entry.selector as never)},
                 updated_at = now()
           WHERE id = ${plan.id}
        `;
      } catch (error) {
        log(`      ❌ ${(error as Error).message}`);
        skipped.push(`CLASSIFY ${key}: ${(error as Error).message}`);
        continue;
      }
    }
    applied.push(`CLASSIFY ${key}: ${detail}`);
  }

  log(`\n━━━ Summary ━━━`);
  log(`Applied: ${applied.length}`);
  log(`Skipped: ${skipped.length}`);
  if (skipped.length > 0) {
    log(`\nSkipped entries:`);
    for (const entry of skipped) log(`  - ${entry}`);
  }
  if (DRY_RUN) log(`\n(dry-run — no changes written)`);

  // Non-zero exit on any skip: a partially-classified table means the
  // materializer would publish plans with no models.
  if (skipped.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => databaseSql.end());
