/**
 * Verified 2026-10-13 (SGT) against official pages. Pure data, no DB access,
 * so it can be unit-tested. Applied by scripts/seed-verified-2026-10-subscriptions.ts.
 *
 * Schema notes: plans has no columns for "usage pool shared across products",
 * "third-party models billed at API list price" or "closed to new users".
 * These are expressed via quotas[].note / features / notes (existing columns),
 * plus a machine-readable `[aiplans:*]` marker line in notes. No schema change.
 */
export const VERIFIED_AT_ISO = '2026-10-13T01:00:00.000Z';

export const LEGACY_CLOSED_MARKER = '[aiplans:legacy-closed-to-new-users 2026-10-12]';
export const SHARED_POOL_MARKER = '[aiplans:shared-usage-pool grok,grok-bot,cursor,x weekly-reset]';
export const THIRD_PARTY_MARKER = '[aiplans:third-party-models-billed-separately api-list-price top-up spend-cap]';

export interface SubscriptionSeed {
  providerSlug: string;
  slug: string;
  name: string;
  tier: string;
  tierRank: number;
  price: number;
  planKind: 'bundle' | 'coding';
  planCategory: 'chatbot' | 'coding';
  planLine: string;
  modelSlugs: string[];
  modelSelector: { providers?: string[]; families?: string[]; current_only?: boolean } | null;
  quotas: Array<{ amount: number; unit: 'prompt'; period: '5h'; derived_from?: string; multiplier?: number; note?: string }>;
  features: string[];
  quotaNote: string;
  noteLines: string[];
  sourceUrl: string;
  sourceQuote: string;
}

const XAI_SRC = 'https://x.ai/pricing';
const XAI_POOL = 'One pool of Grok-model usage shared across Grok, Grok Bot, Cursor and X; refreshes weekly; top-ups after exhaustion.';
const XAI_3P = 'Third-party models in Cursor are not included; billed separately at API list price via top-ups, spending caps available.';
const xai = (slug: string, name: string, tier: string, tierRank: number, price: number, usage: string, features: string[], thirdParty: boolean): SubscriptionSeed => ({
  providerSlug: 'xai', slug, name, tier, tierRank, price,
  planKind: 'bundle', planCategory: 'chatbot', planLine: 'x-subscription',
  modelSlugs: [],
  // Grok-family models; resolved into model_plan_mapping by materialize-model-plan-mappings.
  modelSelector: tierRank === 0 ? null : { providers: ['xai'], families: ['grok'], current_only: true },
  // xAI publishes only relative multipliers (4x/15x/50x Plus), no absolute number.
  quotas: [],
  features: [usage, ...features, ...(thirdParty ? ['3rd party models available in Cursor, billed separately'] : [])],
  quotaNote: `${usage}. ${tierRank === 0 ? 'Limited free usage.' : XAI_POOL}`,
  noteLines: [
    'The X Subscription (launched 2026-10-12): Grok + Grok Bot + Cursor + X Premium in one plan.',
    ...(tierRank === 0 ? [] : [SHARED_POOL_MARKER, XAI_POOL]),
    ...(thirdParty ? [THIRD_PARTY_MARKER, XAI_3P] : []),
    'Teams: Premium/Super/Ultra at the same per-seat price as individual.',
  ],
  sourceUrl: XAI_SRC,
  sourceQuote: `${name} $${price}/month`,
});

export const X_SUBSCRIPTION_PLANS: SubscriptionSeed[] = [
  xai('x-subscription-free', 'The X Subscription Free', 'free', 0, 0, 'Limited AI usage', ['Limited Chat requests', 'Limited agent requests', 'X: post, reply, and follow'], false),
  xai('x-subscription-plus', 'The X Subscription Plus', 'basic', 1, 8, 'Basic shared AI usage pool across all products', ['Grok Chat, Voice, Imagine, and Build', 'Grok API', 'Cursor', 'X Premium checkmark, less timeline ads'], false),
  xai('x-subscription-premium', 'The X Subscription Premium', 'pro', 2, 30, '4x more usage compared to Plus', ['Grok Bot', 'Latest Grok models', 'Cloud agents & automations', 'Code hosting & AI code reviews', 'X ad-free scrolling on most surfaces'], true),
  xai('x-subscription-super', 'The X Subscription Super', 'max', 3, 100, '15x more usage compared to Plus', ['Everything in Premium', 'Priority model access at peak times'], true),
  xai('x-subscription-ultra', 'The X Subscription Ultra', 'ultra', 4, 200, '50x more usage compared to Plus', ['Everything in Super', 'Earliest access to all products & models'], true),
];

/** Only plans created before the launch are legacy; later rows are never auto-closed. */
export const LEGACY_CREATED_BEFORE_ISO = '2026-10-12T00:00:00.000Z';

/** Old plans to keep but mark closed to new signups. Matched by provider + name regex. */
export const LEGACY_CLOSED_RULES = [
  { providerSlugs: ['xai'], nameRe: /super\s*grok/i, label: 'SuperGrok' },
  { providerSlugs: ['xai', 'x', 'twitter'], nameRe: /(^|\b)x\s*premium/i, label: 'X Premium' },
  { providerSlugs: ['cursor', 'anysphere'], nameRe: /./, label: 'Cursor (pre-X-Subscription plans)' },
];
export const LEGACY_CLOSED_NOTE = `${LEGACY_CLOSED_MARKER} No longer available to new subscribers since The X Subscription launch (2026-10-12); existing subscribers may stay or switch. Source: https://forum.cursor.com/t/introducing-the-x-subscription/174450`;

const META_SUB_SRC = 'https://dev.meta.ai/help/subscriptions/what-is-a-muse-code-subscription';
const muse = (slug: string, name: string, tierRank: number, price: number, usage: string, full: boolean): SubscriptionSeed => ({
  providerSlug: 'meta', slug, name, tier: ['basic', 'pro', 'max', 'ultra'][tierRank], tierRank, price,
  planKind: 'coding', planCategory: 'coding', planLine: 'muse-code',
  modelSlugs: ['muse-wonder'],
  modelSelector: null,
  quotas: tierRank === 0
    ? [{ amount: 50, unit: 'prompt', period: '5h', note: 'Vendor states 10-50 prompts per 5 hours; upper bound stored' }]
    : [{ amount: 50 * [1, 5, 20, 80][tierRank], unit: 'prompt', period: '5h', derived_from: 'muse-code-everyday', multiplier: [1, 5, 20, 80][tierRank], note: 'Upper bound derived from Everyday 10-50' }],
  features: [usage, 'Muse Wonder', ...(full ? ['Muse Wonder Full'] : []), 'Muse Code CLI only (subscription credential); extra API keys billed pay-as-you-go'],
  quotaNote: usage,
  noteLines: [
    `Muse Code subscription. Muse Wonder Full included: ${full ? 'yes' : 'no'} (Full has no API price; Power/Maximum only).`,
  ],
  sourceUrl: META_SUB_SRC,
  sourceQuote: `${name.replace('Muse Code ', '')} Usage ($${price}/month)`,
});

export const MUSE_CODE_PLANS: SubscriptionSeed[] = [
  muse('muse-code-everyday', 'Muse Code Everyday', 0, 5, '10-50 prompts every 5 hours', false),
  muse('muse-code-high', 'Muse Code High', 1, 15, '5x Everyday usage', false),
  muse('muse-code-power', 'Muse Code Power', 2, 50, '20x Everyday usage', true),
  muse('muse-code-maximum', 'Muse Code Maximum', 3, 200, '80x Everyday usage', true),
];

export const MUSE_WONDER_MODEL = {
  slug: 'muse-wonder',
  name: 'Muse Wonder',
  apiModelId: 'muse-wonder-1.0',
  providerSlug: 'meta',
  contextWindow: 1_048_576,
  openSource: false,
  releasedAt: '2026-10-12T00:00:00.000Z',
  inputPricePer1m: 4,
  cachedInputPricePer1m: 0.2,
  outputPricePer1m: 20,
  notes: 'Meta Model API model muse-wonder-1.0. Input $4 / cached input $0.20 / output $20 per 1M tokens; flat across context; web search $2.50/1K. Sources: https://dev.meta.ai/docs/overview (model id, 1,048,576 ctx), https://openrouter.ai/meta/muse-wonder (Meta provider rates).',
};

// GLM-Legal (Zhipu, 2026-10-13): API is application-only beta with no public price.
// Intentionally not seeded: a no-price model row would surface as a broken compare entry.
