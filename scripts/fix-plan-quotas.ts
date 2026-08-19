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

type QuotaUnit = 'token' | 'credit' | 'request' | 'message' | 'prompt';
type QuotaPeriod = '5h' | 'day' | 'week' | 'month' | 'total';

interface Quota {
  amount: number;
  unit: QuotaUnit;
  period: QuotaPeriod;
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

// ─── Researched, and the vendor publishes no number ────────────────────────
// This is the NO FALLBACK case made explicit. MiniMax's Token Plan pages give
// only a qualitative allowance -- "5-hour rolling and weekly windows" with
// "3-4 agents" / "4-5 agents" / "6-7 agents" -- and no token, credit, request
// or message count anywhere. Writing [] records that someone checked, which is
// a different fact from NULL (nobody has looked), and both must stop the
// effective-rate math rather than let it invent a denominator.
const NO_PUBLISHED_QUOTA: PlanQuotas[] = [
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
  quotas: [],
}));

const ALL: PlanQuotas[] = [
  ...GLM_CREDITS_PER_WEEK,
  ...ALIYUN_CODING,
  ...GEMINI_CODE_ASSIST,
  ...NO_PUBLISHED_QUOTA,
];

async function main() {
  console.log(`\n📊 fix-plan-quotas ${DRY_RUN ? '[DRY-RUN]' : '[APPLY]'}\n`);

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
          : entry.quotas.map((q) => `${q.amount.toLocaleString()} ${q.unit}/${q.period}`).join(', ');

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
