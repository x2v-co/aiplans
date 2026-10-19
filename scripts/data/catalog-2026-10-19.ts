import type { Sql } from 'postgres';

/** Claude Team seat prices checked 2026-10-19 against https://claude.com/pricing. US, before tax, teams of 2 to 150. Both seats include Claude Code. */
export const CLAUDE_TEAM_PRICE_SOURCES = [
  'https://claude.com/pricing',
  'https://support.claude.com/en/articles/9266767-what-is-the-team-plan',
  'https://claude.com/blog/claude-team-updates',
] as const;

export const XAI_RETIREMENT_SOURCE = 'https://docs.x.ai/developers/migration/may-15-retirement';
export const CODEX_MINI_STALE_NOTE = '[needs-verification] Codex Mini shutdown date is not established by the 2026-10-15 audit; verify official deprecations.';

export interface TeamPrice {
  price: number;
  annual_price: number;
  price_yearly_monthly: number;
  note: string;
}

const verified = 'verified 2026-10-19';
const sources = CLAUDE_TEAM_PRICE_SOURCES.join(' and ');

export const CLAUDE_TEAM_PRICES: Record<string, TeamPrice> = {
  'claude-team': {
    price: 25,
    annual_price: 240,
    price_yearly_monthly: 20,
    note: `[team-price] Standard seat, United States, before tax. Monthly $25; annual $20/seat/month ($240/seat/year). Minimum 2 seats (teams of 2 to 150). Includes Claude Code. ${verified}. Sources: ${sources}.`,
  },
  'claude-team-premium': {
    price: 125,
    annual_price: 1200,
    price_yearly_monthly: 100,
    note: `[team-price] Premium seat, United States, before tax. Monthly $125; annual $100/seat/month ($1,200/seat/year). Minimum 2 seats (teams of 2 to 150). Includes Claude Code; 5x more usage than a Standard seat. ${verified}. Sources: ${sources}.`,
  },
};

/** Keep verified API-credit lines. Replace every other note with the 2026-10-19 price note. */
export function teamPriceNotes(notes: unknown, slug: string): string {
  const price = CLAUDE_TEAM_PRICES[slug];
  if (!price) throw new Error(`No verified Team price for ${slug}`);
  const credits = String(notes ?? '').split('\n').map(line => line.trim()).filter(line => line.startsWith('[api-credit]'));
  return [...credits, price.note].join('\n');
}

export function withoutCodexMiniStaleNote(description: string | null): string | null {
  const kept = String(description ?? '').split('\n').map(line => line.trimEnd()).filter(line => line.trim() && line.trim() !== CODEX_MINI_STALE_NOTE);
  return kept.length ? kept.join('\n') : null;
}

export const GROK_CODE_FAST_SHUTDOWN = {
  slug: 'grok-code-fast-1',
  shutdown_date: '2026-05-15',
  replacement_model: 'grok-build-0.1',
  deprecation_source_url: XAI_RETIREMENT_SOURCE,
} as const;

export function catalogSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-10-19.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type PlanRow = {
  id: number;
  slug: string;
  price: number | null;
  annual_price: number | null;
  price_yearly_monthly: number | null;
  notes: string | null;
};
type ModelRow = {
  id: number;
  slug: string;
  shutdown_date: string | null;
  replacement_model: string | null;
  deprecation_source_url: string | null;
  description: string | null;
};
export interface CatalogStep { table: 'plans' | 'models'; target: string; id: number; changes: Record<string, { from: unknown; to: unknown }> }

function changed(from: unknown, to: unknown): boolean {
  if (typeof to === 'number') return Number(from) !== to;
  return (from ?? null) !== (to ?? null);
}

/** Caller owns a serializable transaction. Missing rows are skipped; duplicates abort. */
export async function seedCatalog20261019(tx: Sql, apply = false): Promise<CatalogStep[]> {
  const providers = await tx<Array<{ id: number }>>`SELECT id FROM providers WHERE slug = 'anthropic'`;
  if (providers.length !== 1) throw new Error(`Expected exactly one anthropic provider, found ${providers.length}; nothing written.`);
  const slugs = Object.keys(CLAUDE_TEAM_PRICES);
  const plans = await tx<PlanRow[]>`
    SELECT id, slug, price, annual_price, price_yearly_monthly, notes FROM plans
    WHERE provider_id = ${providers[0].id} AND slug IN ${tx(slugs)}`;
  const steps: CatalogStep[] = [];
  for (const slug of slugs) {
    const matches = plans.filter(plan => plan.slug === slug);
    if (matches.length > 1) throw new Error(`Duplicate anthropic/${slug} plans; nothing written.`);
    const plan = matches[0];
    if (!plan) continue;
    const desired = CLAUDE_TEAM_PRICES[slug];
    const to = { ...desired, notes: teamPriceNotes(plan.notes, slug) };
    const changes: CatalogStep['changes'] = {};
    for (const key of ['price', 'annual_price', 'price_yearly_monthly', 'notes'] as const) {
      if (changed(plan[key], to[key])) changes[key] = { from: plan[key], to: to[key] };
    }
    if (!Object.keys(changes).length) continue;
    if (apply) {
      await tx`UPDATE plans SET price = ${to.price}, annual_price = ${to.annual_price}, price_yearly_monthly = ${to.price_yearly_monthly},
        notes = ${to.notes}, last_verified = ${new Date('2026-10-19T00:00:00Z')}, updated_at = ${new Date()} WHERE id = ${plan.id}`;
    }
    steps.push({ table: 'plans', target: `anthropic/${slug}`, id: plan.id, changes });
  }

  const grok = GROK_CODE_FAST_SHUTDOWN;
  const grokRows = await tx<ModelRow[]>`
    SELECT id, slug, shutdown_date::text, replacement_model, deprecation_source_url, description
    FROM models WHERE slug = ${grok.slug}`;
  if (grokRows.length > 1) throw new Error(`Duplicate ${grok.slug}; nothing written.`);
  const grokRow = grokRows[0];
  if (grokRow) {
    const changes: CatalogStep['changes'] = {};
    for (const key of ['shutdown_date', 'replacement_model', 'deprecation_source_url'] as const) {
      if (changed(grokRow[key], grok[key])) changes[key] = { from: grokRow[key], to: grok[key] };
    }
    if (Object.keys(changes).length) {
      if (apply) {
        await tx`UPDATE models SET shutdown_date = ${grok.shutdown_date}::date, replacement_model = ${grok.replacement_model},
          deprecation_source_url = ${grok.deprecation_source_url}, updated_at = ${new Date()} WHERE id = ${grokRow.id}`;
      }
      steps.push({ table: 'models', target: grok.slug, id: grokRow.id, changes });
    }
  }

  const miniRows = await tx<ModelRow[]>`
    SELECT id, slug, shutdown_date::text, replacement_model, deprecation_source_url, description
    FROM models WHERE slug = 'gpt-5.1-codex-mini'`;
  if (miniRows.length > 1) throw new Error('Duplicate gpt-5.1-codex-mini; nothing written.');
  const mini = miniRows[0];
  if (mini && String(mini.description ?? '').includes(CODEX_MINI_STALE_NOTE)) {
    const description = withoutCodexMiniStaleNote(mini.description);
    if (apply) await tx`UPDATE models SET description = ${description}, updated_at = ${new Date()} WHERE id = ${mini.id}`;
    steps.push({ table: 'models', target: 'gpt-5.1-codex-mini', id: mini.id, changes: { description: { from: mini.description, to: description } } });
  }
  return steps;
}
