#!/usr/bin/env tsx
/**
 * Populate plans.quotas from vendor-published usage allowances.
 *
 * Every entry below was read off the vendor's own page on 2026-08-19; the URL
 * is recorded next to each group so the next person can re-verify rather than
 * re-research. Nothing here is estimated, converted, or inferred from a
 * competitor -- see the NO FALLBACK note under NO_PUBLISHED_QUOTA.
 *
 * Usage:
 *   npx tsx scripts/fix-plan-quotas.ts --dry-run    # preview, no writes
 *   npx tsx scripts/fix-plan-quotas.ts              # apply
 *
 * Idempotent: writes the same JSON on every run.
 */
import postgres from 'postgres';

const DRY_RUN = process.argv.includes('--dry-run');
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

type QuotaUnit = 'token' | 'credit' | 'request' | 'message' | 'prompt' | 'relative';
type QuotaPeriod = '5h' | 'day' | 'week' | 'month' | 'total';

interface Quota {
  /** Omitted only for unit:'relative', where the vendor publishes a multiple
   *  of another tier and no absolute figure for any tier in the line. */
  amount?: number;
  unit: QuotaUnit;
  /** Omitted only for unit:'relative' when the vendor states the multiple with
   *  no window at all -- Mistral's "up to 6x free" messages name no period, so
   *  claiming one would be inventing it. `assertWellFormed` enforces that every
   *  absolute entry carries both an amount and a period. */
  period?: QuotaPeriod;
  /** Set when the vendor publishes a multiple of another tier, not an absolute. */
  derived_from?: string;
  multiplier?: number;
  note?: string;
}

interface PlanQuotas {
  slug: string;
  source: string;
  quotas: Quota[];
  /** Written to plans.notes only when the vendor states a caveat that changes
   *  how the numbers should be read. */
  note?: string;
}

// ─── GLM Coding Plan (z.ai global + bigmodel China) ────────────────────────
// https://z.ai/subscribe and https://bigmodel.cn/glm-coding
// Both pages state "10,000 Credits / week" for Lite and then describe the
// upper tiers only as "6x Lite usage" / "14x Lite usage" -- there is no
// absolute figure published for Pro or Max, so those carry the multiplier they
// were computed from.
const GLM_CREDITS_PER_WEEK: PlanQuotas[] = [
  {
    slug: 'z-ai-lite',
    source: 'https://z.ai/subscribe',
    quotas: [{ amount: 10_000, unit: 'credit', period: 'week' }],
  },
  {
    slug: 'z-ai-pro',
    source: 'https://z.ai/subscribe',
    quotas: [
      { amount: 60_000, unit: 'credit', period: 'week', derived_from: 'z-ai-lite', multiplier: 6 },
    ],
  },
  {
    slug: 'z-ai-max',
    source: 'https://z.ai/subscribe',
    quotas: [
      { amount: 140_000, unit: 'credit', period: 'week', derived_from: 'z-ai-lite', multiplier: 14 },
    ],
  },
  {
    slug: 'glm-coding-lite',
    source: 'https://bigmodel.cn/glm-coding',
    quotas: [{ amount: 10_000, unit: 'credit', period: 'week' }],
  },
  {
    slug: 'glm-coding-pro',
    source: 'https://bigmodel.cn/glm-coding',
    quotas: [
      { amount: 60_000, unit: 'credit', period: 'week', derived_from: 'glm-coding-lite', multiplier: 6 },
    ],
  },
  {
    slug: 'glm-coding-max',
    source: 'https://bigmodel.cn/glm-coding',
    quotas: [
      { amount: 140_000, unit: 'credit', period: 'week', derived_from: 'glm-coding-lite', multiplier: 14 },
    ],
  },
];

// ─── Aliyun Bailian Coding Plan ────────────────────────────────────────────
// https://help.aliyun.com/zh/model-studio/coding-plan
// Three windows bind at once, and the unit is model *calls*, not prompts: the
// page states one question costs "5-10 calls for a simple task, 10-30+ for a
// complex one". Comparing this 90,000/month against a per-message limit
// elsewhere would be off by that factor, hence the note.
const ALIYUN_CODING: PlanQuotas[] = [
  {
    slug: 'aliyun-bailian-coding-pro',
    source: 'https://help.aliyun.com/zh/model-studio/coding-plan',
    quotas: [
      { amount: 6_000, unit: 'request', period: '5h' },
      { amount: 45_000, unit: 'request', period: 'week' },
      { amount: 90_000, unit: 'request', period: 'month' },
    ],
    note: '每 5 小时 6,000 次 / 每周 45,000 次 / 每月 90,000 次模型调用。一次提问约消耗 5-10 次（简单）或 10-30+ 次（复杂），不等于提问次数。',
  },
];

// ─── Gemini Code Assist ────────────────────────────────────────────────────
// https://developers.google.com/gemini-code-assist/resources/quotas
// The per-edition figure is the agent-mode / Gemini CLI daily cap. The 6,000
// code-request and 960 chat-request daily limits on the same page are system
// limits that apply to every edition, so they are not plan-distinguishing and
// are deliberately not recorded per plan. The free Individual tier has no
// published per-edition number on that page -- left unresearched rather than
// assumed equal to Standard.
const GEMINI_CODE_ASSIST: PlanQuotas[] = [
  {
    slug: 'gemini-code-assist-standard',
    source: 'https://developers.google.com/gemini-code-assist/resources/quotas',
    quotas: [{ amount: 1_500, unit: 'request', period: 'day', note: 'agent mode and Gemini CLI, per user' }],
  },
  {
    slug: 'gemini-code-assist-enterprise',
    source: 'https://developers.google.com/gemini-code-assist/resources/quotas',
    quotas: [{ amount: 2_000, unit: 'request', period: 'day', note: 'agent mode and Gemini CLI, per user' }],
  },
];

// ─── Anthropic Claude ──────────────────────────────────────────────────────
// https://claude.com/pricing and
// https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work
// Anthropic publishes no countable allowance anywhere, on purpose: the support
// article explains that usage depends on the model, effort and thinking
// settings, and every plan carries only "Usage limits apply". What the pricing
// page *does* publish is the ratio between tiers, which is worth keeping --
// Max 20x costs 10x Pro's price for 20x the usage, and that comparison holds
// without either absolute. Hence unit:'relative' with no amount.
const ANTHROPIC_RELATIVE: PlanQuotas[] = [
  {
    slug: 'claude-max-5x',
    source: 'https://claude.com/pricing',
    quotas: [
      { unit: 'relative', period: 'week', multiplier: 5, derived_from: 'claude-pro', note: '5x more usage than Pro' },
    ],
  },
  {
    slug: 'claude-max-20x',
    source: 'https://claude.com/pricing',
    quotas: [
      { unit: 'relative', period: 'week', multiplier: 20, derived_from: 'claude-pro', note: '20x more usage than Pro' },
    ],
  },
  {
    slug: 'claude-team-premium',
    source: 'https://claude.com/pricing',
    quotas: [
      { unit: 'relative', period: 'week', multiplier: 5, derived_from: 'claude-team', note: '5x more usage than standard seats' },
    ],
  },
];

// ─── Qoder CN, formerly 通义灵码 / Lingma ───────────────────────────────────
// https://qoder.com.cn/pricing -- lingma.aliyun.com/pricing now redirects here.
// Aliyun rebranded Lingma to Qoder CN and moved the whole line onto credits:
//   体验版   ¥0     300 Credits, 2-week trial
//   专业版   ¥59/mo   2,000 Credits/month
//   高级版   ¥169/mo  6,000    旗舰版 ¥559/mo 20,000
//   团队版   ¥99/seat/mo 3,000 per seat, and the two enterprise tiers likewise
// Only the first two have rows here; the rest are uncollected plans, not
// missing quotas. Both notes record the rebrand because the DB names still say
// 通义灵码, and lingma-professional's stored ¥29 predates the ¥59 relaunch --
// the quota below is the successor product's, so the price needs correcting in
// fix-plans-audit.ts before the two are read as one coherent offer.
const QODER_CREDITS: PlanQuotas[] = [
  {
    slug: 'lingma-personal',
    source: 'https://qoder.com.cn/pricing',
    quotas: [{ amount: 300, unit: 'credit', period: 'total', note: '2-week trial' }],
    note: 'Rebranded to Qoder CN 体验版; 300 Credits are a one-off 2-week trial grant, not recurring.',
  },
  {
    slug: 'lingma-professional',
    source: 'https://qoder.com.cn/pricing',
    quotas: [{ amount: 2_000, unit: 'credit', period: 'month' }],
    note: 'Rebranded to Qoder CN 专业版, now ¥59/month; the stored ¥29 is the pre-relaunch price.',
  },
];

// ─── Mistral Le Chat ───────────────────────────────────────────────────────
// https://mistral.ai/pricing
// The comparison table gives every headline allowance as a multiple of a free
// tier whose own absolute is never stated -- "Messages: up to 6x free", "Web
// searches: up to 5x free", "Image generation: up to 40x free" -- and names no
// window for any of them. The one place absolute numbers appear is a FAQ
// answer about a single narrow feature: "Flash answers: 200 / day on Team vs.
// 150 / day on Pro". Both are recorded for what they are; neither is a general
// usage allowance, so a $/message rate is not derivable for this line.
const MISTRAL_LE_CHAT: PlanQuotas[] = [
  {
    slug: 'le-chat-pro',
    source: 'https://mistral.ai/pricing',
    quotas: [
      { unit: 'relative', multiplier: 6, derived_from: 'le-chat-free', note: 'up to 6x free messages; no window published' },
      { amount: 150, unit: 'message', period: 'day', note: 'Flash answers only' },
    ],
  },
  {
    slug: 'le-chat-team',
    source: 'https://mistral.ai/pricing',
    quotas: [
      { unit: 'relative', multiplier: 6, derived_from: 'le-chat-free', note: 'up to 6x free messages; no window published' },
      { amount: 200, unit: 'message', period: 'day', note: 'Flash answers only' },
    ],
  },
];

// ─── Researched, and the vendor publishes no number ────────────────────────
// This is the NO FALLBACK case made explicit. MiniMax's Token Plan pages give
// only a qualitative allowance -- "5-hour rolling and weekly windows" with
// "3-4 agents" / "4-5 agents" / "6-7 agents" -- and no token, credit, request
// or message count anywhere. Anthropic's Free/Pro/Team tiers are the same story
// with no ratio published either. Writing [] records that someone checked,
// which is a different fact from NULL (nobody has looked), and both must stop
// the effective-rate math rather than let it invent a denominator.
const NO_PUBLISHED_QUOTA: PlanQuotas[] = [
  ...[
    'minimax-global-plus',
    'minimax-global-max',
    'minimax-global-ultra',
    'minimax-token-plus',
    'minimax-token-max',
    'minimax-token-ultra',
  ].map((slug) => ({
    slug,
    source: slug.startsWith('minimax-global')
      ? 'https://platform.minimax.io/docs/guides/pricing-token-plan'
      : 'https://platform.minimaxi.com/docs/guides/pricing-token-plan',
    quotas: [] as Quota[],
  })),
  ...['claude-free', 'claude-pro', 'claude-max', 'claude-team'].map((slug) => ({
    slug,
    source: 'https://claude.com/pricing',
    quotas: [] as Quota[],
  })),
  // Google's consumer AI plans page describes every tier only as "More access
  // to", "Expanded limits" and "Higher access to" -- not one numeric allowance,
  // and no ratio either. (Gemini Code Assist is the exception and is above.)
  ...['gemini-free', 'google-ai-plus', 'gemini-advanced', 'google-ai-ultra'].map((slug) => ({
    slug,
    source: 'https://one.google.com/about/google-ai-plans/',
    quotas: [] as Quota[],
  })),
  // Le Chat's free tier is the unpublished baseline the paid multiples are
  // quoted against, and Enterprise is contact-sales with no figures at all.
  ...['le-chat-free', 'le-chat-enterprise'].map((slug) => ({
    slug,
    source: 'https://mistral.ai/pricing',
    quotas: [] as Quota[],
  })),
];

const ALL: PlanQuotas[] = [
  ...GLM_CREDITS_PER_WEEK,
  ...ALIYUN_CODING,
  ...GEMINI_CODE_ASSIST,
  ...ANTHROPIC_RELATIVE,
  ...QODER_CREDITS,
  ...MISTRAL_LE_CHAT,
  ...NO_PUBLISHED_QUOTA,
];

/** A relative entry may omit amount and period; nothing else may. Catches a
 *  half-filled entry at startup instead of writing a quota the rate math will
 *  later read as authoritative. */
function assertWellFormed(entries: PlanQuotas[]) {
  for (const entry of entries) {
    for (const q of entry.quotas) {
      const where = `${entry.slug} (${q.unit})`;
      if (q.unit === 'relative') {
        if (q.multiplier == null || !q.derived_from) {
          throw new Error(`${where}: a relative quota needs both multiplier and derived_from`);
        }
      } else if (q.amount == null || q.period == null) {
        throw new Error(`${where}: an absolute quota needs both amount and period`);
      }
    }
  }
}

async function main() {
  console.log(`\n📊 fix-plan-quotas ${DRY_RUN ? '[DRY-RUN]' : '[APPLY]'}\n`);

  assertWellFormed(ALL);

  const sql = postgres(DATABASE_URL!, { onnotice: () => {} });
  let updated = 0;
  let missing = 0;

  try {
    for (const entry of ALL) {
      const [plan] = await sql<{ id: number; name: string; quotas: unknown }[]>`
        SELECT id, name, quotas FROM plans WHERE slug = ${entry.slug}
      `;

      if (!plan) {
        console.log(`  ⚠ ${entry.slug}: no such plan — skipped`);
        missing++;
        continue;
      }

      const summary =
        entry.quotas.length === 0
          ? 'no published quota'
          : entry.quotas
              .map((q) =>
                q.unit === 'relative'
                  ? `${q.multiplier}x ${q.derived_from} (no absolute published)`
                  : `${q.amount?.toLocaleString()} ${q.unit}/${q.period}`,
              )
              .join(', ');

      if (DRY_RUN) {
        console.log(`  ${entry.slug} → ${summary}`);
        if (entry.note) console.log(`      note: ${entry.note}`);
        continue;
      }

      // notes is shared with other curation, so only overwrite it when this
      // entry actually carries one.
      if (entry.note) {
        await sql`
          UPDATE plans
             SET quotas = ${sql.json(entry.quotas)},
                 notes = ${entry.note},
                 last_verified = now(),
                 updated_at = now()
           WHERE id = ${plan.id}
        `;
      } else {
        await sql`
          UPDATE plans
             SET quotas = ${sql.json(entry.quotas)},
                 last_verified = now(),
                 updated_at = now()
           WHERE id = ${plan.id}
        `;
      }

      console.log(`  ✓ ${entry.slug} → ${summary}`);
      updated++;
    }

    console.log(
      DRY_RUN
        ? `\n${ALL.length} plans would be written (${missing} missing).\n`
        : `\n✅ ${updated} plans written, ${missing} missing.\n`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
