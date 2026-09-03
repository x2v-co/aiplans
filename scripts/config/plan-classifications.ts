/**
 * Product-line classification for every subscription plan, plus the
 * `model_selector` rule that derives its model list.
 *
 * Applied by scripts/fix-plan-kinds.ts; coverage is checked by
 * scripts/audit-data.ts. This file replaces scripts/config/plan-model-slugs.ts,
 * which was a hand-maintained slug list that drifted out of date silently —
 * see src/lib/plan-selector.ts for why a rule is used instead.
 *
 * Classification verified against each vendor's official plan page.
 */
import type { ModelSelector } from '../../src/lib/plan-selector';

export type PlanKind = 'chat' | 'coding' | 'agent' | 'token_pack' | 'api_tier' | 'bundle';

export interface Classification {
  providerSlug: string;
  planSlug: string;
  kind: PlanKind;
  line: string;
  /** Position within the line, ascending by price. Free tier is 0 where one exists. */
  rank: number;
  /** Only for genuinely dual-line plans, e.g. a chat subscription that also funds a coding agent. */
  secondaryKinds?: PlanKind[];
  selector: ModelSelector;
  /** Why this classification / selector, in the style of fix-plans-audit.ts. */
  reason: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Shared exclusions.
//
// These are catalog-hygiene rows, not plan-specific choices. `api_channel_prices`
// tracks price SKUs, so `models` also holds versionless placeholder rows
// ('claude-opus', 'gemini-pro', 'kimi'), regional endpoint duplicates ('*-us'),
// preview SKUs and API-only speed tiers ('*-fast'). None of them is a thing a
// subscriber gets. Batch and aggregator-free variants are filtered globally in
// src/lib/plan-selector.ts.
//
// Every pattern here was verified to actually match something — a `families`
// filter already removes most cross-vendor noise, so an exclude that matches
// nothing is dead config rather than a safety net. scripts/fix-plan-kinds.ts
// reports `unusedExclude` for exactly this reason.
// ────────────────────────────────────────────────────────────────────────────
const ANTHROPIC_NOISE = ['claude-opus', 'claude-sonnet', 'claude-haiku', '*-fast'];
const GOOGLE_NOISE = ['gemini-pro', 'gemini-flash', '*-preview*'];
const ZHIPU_NOISE = ['glm-4', '*-us'];
const MOONSHOT_NOISE = ['kimi', '*-us'];
const MINIMAX_LEGACY = ['minimax-01', 'minimax-m1'];

const CLAUDE_FAMILIES = ['claude-opus', 'claude-sonnet', 'claude-haiku'];
const CLAUDE_MAX_FAMILIES = [...CLAUDE_FAMILIES, 'claude-fable'];
const GPT_CHAT_FAMILIES = ['gpt-4o', 'gpt-4.1', 'gpt-5'];

// ────────────────────────────────────────────────────────────────────────────
// The classification table
// ────────────────────────────────────────────────────────────────────────────
export const CLASSIFICATIONS: Classification[] = [
  // ─ OpenAI — one chat line. Codex ships with the paid tiers, hence the
  //   'coding' secondary kind: a Coding-plan comparison that omits ChatGPT Plus
  //   is missing one of the main contenders.
  { providerSlug: 'openai', planSlug: 'chatgpt-free', kind: 'chat', line: 'chatgpt', rank: 0,
    selector: { families: ['gpt-5.5', 'gpt-5.6'], exclude: ['*-pro', '*-codex*', '*-long-context'] },
    reason: 'Free gets the current default GPT-5.x only — no Pro reasoning model, no Codex, no long-context SKU' },
  { providerSlug: 'openai', planSlug: 'chatgpt-go', kind: 'chat', line: 'chatgpt', rank: 1,
    selector: { families: ['gpt-5'], exclude: ['*-pro', '*-long-context'] },
    reason: 'Go is Plus minus the Pro reasoning model' },
  { providerSlug: 'openai', planSlug: 'chatgpt-plus', kind: 'chat', line: 'chatgpt', rank: 2,
    secondaryKinds: ['coding'],
    selector: { families: GPT_CHAT_FAMILIES, exclude: ['*-pro'] },
    reason: 'Plus keeps legacy 4o/4.1 selectable; GPT-5 Pro is Pro-tier only. Includes Codex' },
  { providerSlug: 'openai', planSlug: 'chatgpt-pro', kind: 'chat', line: 'chatgpt', rank: 3,
    secondaryKinds: ['coding'],
    selector: { families: GPT_CHAT_FAMILIES },
    reason: 'Pro is the only individual tier with the GPT-5 Pro reasoning model' },
  { providerSlug: 'openai', planSlug: 'chatgpt-business', kind: 'chat', line: 'chatgpt', rank: 4,
    secondaryKinds: ['coding'],
    selector: { families: GPT_CHAT_FAMILIES, exclude: ['*-pro'] },
    reason: 'Business is Plus at org scale (tier=team expresses that); model set matches Plus' },
  { providerSlug: 'openai', planSlug: 'chatgpt-team', kind: 'chat', line: 'chatgpt', rank: 5,
    secondaryKinds: ['coding'],
    selector: { families: GPT_CHAT_FAMILIES, exclude: ['*-pro'] },
    reason: 'Team is the Business superset; same model set' },
  { providerSlug: 'openai', planSlug: 'chatgpt-enterprise', kind: 'chat', line: 'chatgpt', rank: 6,
    secondaryKinds: ['coding'],
    selector: { families: GPT_CHAT_FAMILIES },
    reason: 'Enterprise includes the Pro reasoning model' },

  // ─ Anthropic — one chat line. Claude Code rides on Pro/Max/Team Premium but
  //   explicitly NOT on Team Standard (see that plan's notes column).
  { providerSlug: 'anthropic', planSlug: 'claude-free', kind: 'chat', line: 'claude', rank: 0,
    selector: { families: ['claude-sonnet', 'claude-haiku'], current_only: true, exclude: ['claude-sonnet', 'claude-haiku'] },
    reason: 'Free is capped at the current Sonnet/Haiku; Opus is paid-only. The excludes are exact globs dropping the versionless placeholder rows that the same-named families would otherwise pull in' },
  { providerSlug: 'anthropic', planSlug: 'claude-pro', kind: 'chat', line: 'claude', rank: 1,
    secondaryKinds: ['coding'],
    selector: { families: CLAUDE_FAMILIES, exclude: ANTHROPIC_NOISE },
    reason: 'Pro unlocks Opus and bundles Claude Code' },
  { providerSlug: 'anthropic', planSlug: 'claude-max', kind: 'chat', line: 'claude', rank: 2,
    secondaryKinds: ['coding'],
    selector: { families: CLAUDE_MAX_FAMILIES, exclude: ANTHROPIC_NOISE },
    reason: 'Legacy generic Max row; includes the Max-only Fable family in addition to the Pro catalog' },
  { providerSlug: 'anthropic', planSlug: 'claude-max-5x', kind: 'chat', line: 'claude', rank: 3,
    secondaryKinds: ['coding'],
    selector: { families: CLAUDE_MAX_FAMILIES, exclude: ANTHROPIC_NOISE },
    reason: 'Max 5x includes Fable at a limited share of weekly usage; tier_rank carries its quota position' },
  { providerSlug: 'anthropic', planSlug: 'claude-max-20x', kind: 'chat', line: 'claude', rank: 4,
    secondaryKinds: ['coding'],
    selector: { families: CLAUDE_MAX_FAMILIES, exclude: ANTHROPIC_NOISE },
    reason: 'Max 20x includes Fable at a limited share of weekly usage; tier_rank distinguishes it from Max 5x' },
  { providerSlug: 'anthropic', planSlug: 'claude-team', kind: 'chat', line: 'claude', rank: 5,
    selector: { families: CLAUDE_FAMILIES, exclude: ANTHROPIC_NOISE },
    reason: 'Team Standard: full chat catalog but no Claude Code, so no coding secondary kind' },
  { providerSlug: 'anthropic', planSlug: 'claude-team-premium', kind: 'chat', line: 'claude', rank: 6,
    secondaryKinds: ['coding'],
    selector: { families: CLAUDE_FAMILIES, exclude: ANTHROPIC_NOISE },
    reason: 'Team Premium is Team Standard plus Claude Code' },
  { providerSlug: 'anthropic', planSlug: 'claude-enterprise', kind: 'chat', line: 'claude', rank: 7,
    secondaryKinds: ['coding'],
    selector: { families: CLAUDE_FAMILIES, exclude: ANTHROPIC_NOISE },
    reason: 'Enterprise includes Claude Code and the full catalog' },

  // ─ Google — two genuinely separate product lines sold from one account.
  { providerSlug: 'google', planSlug: 'gemini-free', kind: 'chat', line: 'google-one', rank: 0,
    selector: { families: ['gemini'], current_only: true, exclude: [...GOOGLE_NOISE, '*-pro*'] },
    reason: 'Free tier is Flash-class only; Pro-class models require a paid AI plan' },
  { providerSlug: 'google', planSlug: 'google-ai-plus', kind: 'chat', line: 'google-one', rank: 1,
    selector: { families: ['gemini'], exclude: GOOGLE_NOISE },
    reason: 'AI Plus is the entry paid tier with the full Gemini chat catalog at lower quota' },
  { providerSlug: 'google', planSlug: 'gemini-advanced', kind: 'chat', line: 'google-one', rank: 2,
    selector: { families: ['gemini'], exclude: GOOGLE_NOISE },
    reason: 'Google AI Pro (formerly Gemini Advanced)' },
  { providerSlug: 'google', planSlug: 'google-ai-ultra', kind: 'chat', line: 'google-one', rank: 3,
    selector: { families: ['gemini'], exclude: GOOGLE_NOISE },
    reason: 'AI Ultra: same catalog, highest quota' },
  { providerSlug: 'google', planSlug: 'gemini-code-assist-individual', kind: 'coding', line: 'gemini-code-assist', rank: 0,
    selector: { families: ['gemini'], current_only: true, exclude: GOOGLE_NOISE },
    reason: 'Code Assist is an IDE/CLI product, not a chat subscription — separate line, not a tier of Google One' },
  { providerSlug: 'google', planSlug: 'gemini-code-assist-standard', kind: 'coding', line: 'gemini-code-assist', rank: 1,
    selector: { families: ['gemini'], exclude: GOOGLE_NOISE },
    reason: 'Standard: 1500 model requests/day shared across CLI and Agent' },
  { providerSlug: 'google', planSlug: 'gemini-code-assist-enterprise', kind: 'coding', line: 'gemini-code-assist', rank: 2,
    selector: { families: ['gemini'], exclude: GOOGLE_NOISE },
    reason: 'Enterprise: 2000 requests/day plus private-repo customization' },

  // ─ Baidu.
  { providerSlug: 'baidu', planSlug: 'ernie-free', kind: 'chat', line: 'ernie', rank: 0,
    selector: { families: ['ernie'], current_only: true },
    reason: 'ERNIE went fully free 2025-04-01, so this is the only chat row Baidu has' },
  { providerSlug: 'baidu', planSlug: 'qianfan-coding-plan-pro', kind: 'coding', line: 'qianfan-coding', rank: 0,
    selector: { families: ['ernie'] },
    reason: 'Coding plan, not a chat tier. NOTE: fix-plans-audit.ts priced this row off 阿里云百炼 while it sits under the baidu provider — the provider attribution still needs a decision' },

  // ─ MiniMax. These are named "Token Plan" on both platform.minimaxi.com and
  //   .../cn, but neither page publishes a token allowance: what they sell is
  //   concurrent agent slots (3–4) metered against a 5-hour rolling window plus
  //   a weekly cap. That is the `agent` shape, not `token_pack` — so they carry
  //   no included_tokens and Part 7's effective-rate math correctly skips them.
  //   MiniMax does sell real prepaid packs (Credits / 积分, 1000 credits = $1,
  //   365-day validity) but we do not track those rows yet.
  { providerSlug: 'minimax-china', planSlug: 'minimax-token-plus', kind: 'agent', line: 'minimax-agent-cn', rank: 0,
    selector: { families: ['minimax'], exclude: MINIMAX_LEGACY },
    reason: 'Named "Token Plan Plus" but sells agent slots on a 5-hour/weekly window, with no published token allowance' },
  { providerSlug: 'minimax-china', planSlug: 'minimax-token-max', kind: 'agent', line: 'minimax-agent-cn', rank: 1,
    selector: { families: ['minimax'], exclude: MINIMAX_LEGACY },
    reason: 'Max only widens the agent quota over Plus — it was tagged tier=team, which it is not' },
  { providerSlug: 'minimax-china', planSlug: 'minimax-token-ultra', kind: 'agent', line: 'minimax-agent-cn', rank: 2,
    selector: { families: ['minimax'], exclude: MINIMAX_LEGACY },
    reason: 'Widest agent quota; was tagged tier=enterprise despite being an individual plan' },
  { providerSlug: 'minimax-global', planSlug: 'minimax-global-plus', kind: 'agent', line: 'minimax-agent-global', rank: 0,
    selector: { providers: ['minimax-china'], families: ['minimax'], exclude: MINIMAX_LEGACY },
    reason: 'Global agent plan. Models are catalogued under the minimax-china producer, so the selector must name it explicitly' },
  { providerSlug: 'minimax-global', planSlug: 'minimax-global-max', kind: 'agent', line: 'minimax-agent-global', rank: 1,
    selector: { providers: ['minimax-china'], families: ['minimax'], exclude: MINIMAX_LEGACY },
    reason: 'Wider global agent quota' },
  { providerSlug: 'minimax-global', planSlug: 'minimax-global-ultra', kind: 'agent', line: 'minimax-agent-global', rank: 2,
    selector: { providers: ['minimax-china'], families: ['minimax'], exclude: MINIMAX_LEGACY },
    reason: 'Widest global agent quota' },

  // ─ Mistral.
  { providerSlug: 'mistral', planSlug: 'le-chat-free', kind: 'chat', line: 'le-chat', rank: 0,
    selector: { families: ['mistral-small', 'mistral-medium'], current_only: true },
    reason: 'Free tier is Small/Medium class only' },
  { providerSlug: 'mistral', planSlug: 'le-chat-pro', kind: 'chat', line: 'le-chat', rank: 1,
    selector: { families: ['mistral', 'codestral'] },
    reason: 'Pro adds Large and Codestral. The Ministral edge models need no exclude — they fall outside the mistral-* families' },
  { providerSlug: 'mistral', planSlug: 'le-chat-team', kind: 'chat', line: 'le-chat', rank: 2,
    selector: { families: ['mistral', 'codestral'] },
    reason: 'Team is Pro per-seat' },
  { providerSlug: 'mistral', planSlug: 'le-chat-enterprise', kind: 'chat', line: 'le-chat', rank: 3,
    selector: { families: ['mistral', 'codestral'] },
    reason: 'Enterprise is contact-sales; same catalog' },

  // ─ Moonshot / Kimi.
  { providerSlug: 'moonshot-china', planSlug: 'kimi-free', kind: 'chat', line: 'kimi', rank: 0,
    selector: { families: ['kimi'], current_only: true, exclude: MOONSHOT_NOISE },
    reason: 'Free tier tracks the current K-series only' },
  { providerSlug: 'moonshot-china', planSlug: 'kimi-basic', kind: 'chat', line: 'kimi', rank: 1,
    selector: { families: ['kimi'], exclude: MOONSHOT_NOISE },
    reason: 'Kimi+ 行板/Andante' },
  { providerSlug: 'moonshot-china', planSlug: 'kimi-pro', kind: 'chat', line: 'kimi', rank: 2,
    selector: { families: ['kimi'], exclude: MOONSHOT_NOISE },
    reason: 'Kimi+ 中速/Moderato' },
  { providerSlug: 'moonshot-china', planSlug: 'kimi-team', kind: 'chat', line: 'kimi', rank: 3,
    selector: { families: ['kimi'], exclude: MOONSHOT_NOISE },
    reason: 'Kimi+ 快板/Allegretto, per-seat' },
  { providerSlug: 'moonshot-china', planSlug: 'kimi-enterprise', kind: 'chat', line: 'kimi', rank: 4,
    selector: { families: ['kimi'], exclude: MOONSHOT_NOISE },
    reason: 'Contact-sales tier' },

  // ─ Alibaba — three lines under one provider, which is exactly the case that
  //   a scalar `tier` could not express.
  { providerSlug: 'qwen', planSlug: 'qwen-free-trial', kind: 'api_tier', line: 'qwen-api', rank: 0,
    selector: { families: ['qwen', 'qwen2', 'qwen2.5', 'qwen3'] },
    reason: 'A rate-limit tier on a pay-as-you-go API account, not a subscription (pricing_model is already pay_as_you_go)' },
  { providerSlug: 'qwen', planSlug: 'qwen-enterprise', kind: 'api_tier', line: 'qwen-api', rank: 1,
    selector: { families: ['qwen', 'qwen2', 'qwen2.5', 'qwen3'] },
    reason: 'Higher API rate-limit tier' },
  { providerSlug: 'qwen', planSlug: 'lingma-personal', kind: 'coding', line: 'lingma', rank: 0,
    selector: { families: ['qwen3-coder', 'qwen-coder', 'qwen-2.5-coder'], current_only: true },
    reason: '通义灵码 free tier: IDE plugin on Qwen3-Coder' },
  { providerSlug: 'qwen', planSlug: 'lingma-professional', kind: 'coding', line: 'lingma', rank: 1,
    selector: { families: ['qwen3-coder', 'qwen-coder', 'qwen-2.5-coder'] },
    reason: '通义灵码 专业版 unlocks Qwen3-Coder-Plus and larger context' },
  { providerSlug: 'qwen', planSlug: 'aliyun-bailian-coding-pro', kind: 'coding', line: 'bailian-coding', rank: 0,
    selector: {
      families: ['qwen', 'qwen2', 'qwen2.5', 'qwen3'],
      extra: ['glm-5.2', 'kimi-k2.5', 'minimax-m2.5'],
    },
    reason: 'Aggregator coding plan: its own notes column lists GLM, Kimi and MiniMax alongside Qwen — this is the case `extra` exists for' },

  // ─ Volcengine Seed. TODO(confirm with owner): 火山方舟 Lite/Pro are billed as
  //   Coding Plans, but the product page also markets agent task quotas. If they
  //   are really agent bundles, flip kind to 'agent' and keep the line name.
  { providerSlug: 'seed', planSlug: 'seed-free-trial', kind: 'coding', line: 'seed-coding', rank: 0,
    selector: { families: ['doubao', 'seed'], current_only: true },
    reason: 'Trial tier of 火山方舟 Coding Plan' },
  { providerSlug: 'seed', planSlug: 'seed-lite', kind: 'coding', line: 'seed-coding', rank: 1,
    selector: { families: ['doubao', 'seed'] },
    reason: '火山方舟 Coding Plan Lite ¥40/mo' },
  { providerSlug: 'seed', planSlug: 'seed-pro', kind: 'coding', line: 'seed-coding', rank: 2,
    selector: { families: ['doubao', 'seed'] },
    reason: '火山方舟 Coding Plan Pro ¥200/mo' },
  { providerSlug: 'seed', planSlug: 'seed-enterprise', kind: 'coding', line: 'seed-coding', rank: 3,
    selector: { families: ['doubao', 'seed'] },
    reason: 'Contact-sales tier' },

  // ─ Zhipu — the CN and international GLM Coding Plans are the same product on
  //   two price sheets. Both also grant chat access, hence the secondary kind.
  { providerSlug: 'zhipu-china', planSlug: 'glm-coding-lite', kind: 'coding', line: 'glm-coding', rank: 0,
    secondaryKinds: ['chat'],
    selector: { families: ['glm'], exclude: ZHIPU_NOISE },
    reason: 'GLM Coding Plan Lite. It is a coding plan, not the "basic tier of a chat plan"' },
  { providerSlug: 'zhipu-china', planSlug: 'glm-coding-pro', kind: 'coding', line: 'glm-coding', rank: 1,
    secondaryKinds: ['chat'],
    selector: { families: ['glm'], exclude: ZHIPU_NOISE },
    reason: 'GLM Coding Plan Pro' },
  { providerSlug: 'zhipu-china', planSlug: 'glm-coding-max', kind: 'coding', line: 'glm-coding', rank: 2,
    secondaryKinds: ['chat'],
    selector: { families: ['glm'], exclude: ZHIPU_NOISE },
    reason: 'GLM Coding Plan Max is an individual plan — it was tagged tier=enterprise purely to express scale' },
  { providerSlug: 'zhipu-global', planSlug: 'z-ai-lite', kind: 'coding', line: 'z-ai-coding', rank: 0,
    secondaryKinds: ['chat'],
    selector: { providers: ['zhipu-china'], families: ['glm'], exclude: ZHIPU_NOISE },
    reason: 'Z.AI Lite is the international GLM Coding Plan; models live under the zhipu-china producer' },
  { providerSlug: 'zhipu-global', planSlug: 'z-ai-pro', kind: 'coding', line: 'z-ai-coding', rank: 1,
    secondaryKinds: ['chat'],
    selector: { providers: ['zhipu-china'], families: ['glm'], exclude: ZHIPU_NOISE },
    reason: 'Z.AI Pro' },
  { providerSlug: 'zhipu-global', planSlug: 'z-ai-max', kind: 'coding', line: 'z-ai-coding', rank: 2,
    secondaryKinds: ['chat'],
    selector: { providers: ['zhipu-china'], families: ['glm'], exclude: ZHIPU_NOISE },
    reason: 'Z.AI Max' },
];
