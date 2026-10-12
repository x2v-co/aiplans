/**
 * Subscription-side context facts that differ from the API model card.
 *
 * `models.context_window` is the API figure. Subscriptions (ChatGPT / Codex,
 * Claude, ...) sometimes expose a different effective context and treat long
 * context differently from the metered API, which can charge a long-context
 * premium. Model-plan mappings are re-derived on every scrape, so these
 * curated facts live in code, each with a primary source.
 *
 * Only add entries backed by a verifiable vendor statement.
 */

/** How long-context usage is billed on a given surface. */
export type LongContextPricing =
  /** Metered API charges a higher rate above a context threshold. */
  | 'api_premium'
  /** Usage drawn from the subscription carries no long-context fee. */
  | 'included_in_subscription';

export interface SubscriptionContextFact {
  /** Matches models.slug (and its candidates). */
  modelSlug: RegExp;
  /** plans.plan_line this applies to. */
  planLine: string;
  /** Surfaces where the figure applies, e.g. "Codex", "ChatGPT Work". */
  surfaces: string[];
  /** Default effective context window in tokens on these surfaces. */
  contextWindow: number;
  longContextPricing: LongContextPricing;
  sourceUrls: string[];
  verifiedAt: string; // YYYY-MM-DD
}

export const SUBSCRIPTION_CONTEXT_FACTS: SubscriptionContextFact[] = [
  {
    // OpenAI Codex Day 7: default context for GPT-6.1 Sol in Codex & Work
    // raised from 272k to 500k; no long-context fees when drawing usage
    // from the subscription.
    modelSlug: /^gpt-?6[.-]?1-sol(?:$|-)/i,
    planLine: 'chatgpt',
    surfaces: ['Codex', 'ChatGPT Work'],
    contextWindow: 500_000,
    longContextPricing: 'included_in_subscription',
    sourceUrls: [
      'https://x.com/thsottiaux/status/2109430343346581527',
      'https://x.com/thsottiaux/status/2109430894604026039',
    ],
    verifiedAt: '2026-10-12',
  },
];

export function findSubscriptionContext(
  modelSlugs: string[],
  planLine: string | null | undefined,
): SubscriptionContextFact | null {
  if (!planLine) return null;
  return (
    SUBSCRIPTION_CONTEXT_FACTS.find(
      (f) => f.planLine === planLine && modelSlugs.some((s) => f.modelSlug.test(s)),
    ) ?? null
  );
}
