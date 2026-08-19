/**
 * The product-line axis introduced by migration 013.
 *
 * `tier` says who a plan is for (individual / team / enterprise). `plan_kind`
 * says what kind of product it is, and the two are independent: GLM Coding Max
 * is an individual plan on the coding line, while Claude Team is a team plan on
 * the chat line. Before this split, `tier` was carrying both meanings, so the
 * UI happily compared a ¥118 coding subscription against a ¥118 chat
 * subscription as if they were alternatives.
 *
 * The rule this file exists to enforce: two plans are comparable only when they
 * share a `plan_kind`. Anything that ranks, picks a cheapest, or lays plans out
 * side by side must group by kind first.
 *
 * Labels live here rather than in messages/*.json because every page that
 * renders plans (/[locale]/plans/[provider], /[locale]/compare/plans/[model],
 * /[locale]/models/[slug]) is a server component, and this repo's
 * `useTranslations` is a React context hook that only works in client
 * components. Those pages localize with an `isZh` ternary, so that is the idiom
 * a shared helper has to serve.
 */

export type PlanKind = 'chat' | 'coding' | 'agent' | 'token_pack' | 'api_tier' | 'bundle';

/**
 * Display order. Chat first because it is what most visitors arrive looking
 * for; api_tier and bundle last because they are rate-limit tiers and
 * combination products rather than things a consumer subscribes to.
 */
export const PLAN_KIND_ORDER: readonly PlanKind[] = [
  'chat',
  'coding',
  'agent',
  'token_pack',
  'api_tier',
  'bundle',
] as const;

type KindPresentation = {
  icon: string;
  en: string;
  zh: string;
  /** One line explaining what the section contains, shown under the heading. */
  descriptionEn: string;
  descriptionZh: string;
};

const PRESENTATION: Record<PlanKind, KindPresentation> = {
  chat: {
    icon: '💬',
    en: 'Chat subscriptions',
    zh: '对话订阅',
    descriptionEn: 'Monthly access to the assistant apps and their model line-up.',
    descriptionZh: '按月订阅助手应用，含其可用模型。',
  },
  coding: {
    icon: '⌨️',
    en: 'Coding plans',
    zh: '编程套餐',
    descriptionEn: 'Editor and CLI coding agents, metered in prompts rather than tokens.',
    descriptionZh: '编辑器 / 命令行编程助手，按提问次数而非 token 计量。',
  },
  agent: {
    icon: '🤖',
    en: 'Agent plans',
    zh: 'Agent 套餐',
    descriptionEn: 'Autonomous agent runs, usually capped by concurrent slots and a rolling window.',
    descriptionZh: '自主 Agent 任务，通常按并发数与滚动时间窗限额。',
  },
  token_pack: {
    icon: '🎟️',
    en: 'Token packs',
    zh: 'Token 包',
    descriptionEn: 'Prepaid balance drawn down as you use it, with no monthly commitment.',
    descriptionZh: '预付余额，用多少扣多少，无按月承诺。',
  },
  api_tier: {
    icon: '⚡',
    en: 'API rate tiers',
    zh: 'API 速率档位',
    descriptionEn: 'Rate-limit tiers on a pay-as-you-go API account, not a subscription.',
    descriptionZh: '按量付费 API 账号的速率档位，并非订阅。',
  },
  bundle: {
    icon: '📦',
    en: 'Bundles',
    zh: '组合套餐',
    descriptionEn: 'Plans that span more than one product line.',
    descriptionZh: '跨多个产品线的组合套餐。',
  },
};

/**
 * Coerce whatever the database handed us into a known kind. `plan_kind` is NOT
 * NULL with a 'chat' default, so a miss here means a value that predates a
 * migration or a check-constraint change -- fall back to 'chat' so the page
 * still renders the plan instead of dropping it on the floor.
 */
export function normalizePlanKind(raw: string | null | undefined): PlanKind {
  if (raw && (PLAN_KIND_ORDER as readonly string[]).includes(raw)) {
    return raw as PlanKind;
  }
  return 'chat';
}

export function planKindLabel(kind: PlanKind, locale: string): string {
  const p = PRESENTATION[kind];
  return locale === 'zh' ? p.zh : p.en;
}

export function planKindIcon(kind: PlanKind): string {
  return PRESENTATION[kind].icon;
}

export function planKindDescription(kind: PlanKind, locale: string): string {
  const p = PRESENTATION[kind];
  return locale === 'zh' ? p.descriptionZh : p.descriptionEn;
}

export type PlanKindGroup<T> = {
  kind: PlanKind;
  plans: T[];
};

/**
 * Split plans into kind groups in PLAN_KIND_ORDER, dropping empty ones.
 *
 * Order within a group is left exactly as received: callers pass rows already
 * sorted by `plan_line, tier_rank, price` from SQL, and tier_rank is the whole
 * reason that ordering is meaningful (Lite before Pro before Max, rather than
 * whatever alphabetical or price order happens to fall out).
 */
export function groupPlansByKind<T>(
  plans: readonly T[],
  getKind: (plan: T) => string | null | undefined,
): PlanKindGroup<T>[] {
  const buckets = new Map<PlanKind, T[]>();

  for (const plan of plans) {
    const kind = normalizePlanKind(getKind(plan));
    const bucket = buckets.get(kind);
    if (bucket) {
      bucket.push(plan);
    } else {
      buckets.set(kind, [plan]);
    }
  }

  return PLAN_KIND_ORDER.flatMap((kind) => {
    const group = buckets.get(kind);
    return group && group.length > 0 ? [{ kind, plans: group }] : [];
  });
}
