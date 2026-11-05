import SiteHeader from '@/components/SiteHeader';
import { QuotaBenchResults } from '@/components/quota-bench-results';
import { codexQuotaFaq, CODEX_QUOTA_DATE } from '@/lib/codex-pro200';
import { buildMetadata, faqPage } from '@/lib/seo';
import { ClaudeProQuota } from '@/components/claude-pro-quota';
import { claudeProQuotaFaq } from '@/lib/claude-pro-opus55';
import { GuideDates } from '@/components/guide-summary-card';
import { QuotaLeaderboard } from '@/components/quota-leaderboard';
import { QUOTA_LEADERBOARD_PUBLISHED_AT, QUOTA_LEADERBOARD_UPDATED_AT } from '@/lib/quota-leaderboard';

const CONCLUSION = {
  zh: '结论：按月费倍数（API 折合 ÷ 月费），Claude Pro（$20）约 42–70×（≈ $800–1,390/月，按负载配比分开）；X Ultra（$200）约 33×（≈ $6,500/月）；Codex Pro 200（$200）约 27×（≈ $5,300/月，实测 ≈ $1,222/周）。火山方舟 Pro（¥200）约 22×（≈ $640/月，月窗口独立测量，粗估）。前三者都只有周额度实测，月额度 = 周额度 × 4.35（52.14 周 ÷ 12 月）推算，属粗估。均为 x2v 有条件实测，按公开 API 标价折算，不是官方额度。',
  en: 'TL;DR: by fee multiple (API value ÷ monthly fee), Claude Pro ($20) is about 42–70× (≈ $800–1,390/month, split by workload mix); X Ultra ($200) about 33× (≈ $6,500/month); Codex Pro 200 ($200) about 27× (≈ $5,300/month; measured ≈ $1,222/week). Volcengine Pro (CNY 200) is about 22× (≈ $640/month, a native rough monthly estimate). The first three are measured weekly only; monthly = weekly × 4.35 (52.14 weeks ÷ 12), a rough estimate. All are x2v conditional measurements at public API list price, not official allowances.',
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return buildMetadata({
    locale: locale === 'zh' ? 'zh' : 'en', path: '/quota-bench',
    title: { zh: '订阅额度排行（月费倍数）与实测报告 | aiplans', en: 'Subscription quota leaderboard (fee multiple) and measurements | aiplans' },
    description: {
      zh: `订阅额度月费倍数排行（Claude Pro、X Ultra、Codex Pro 200、火山方舟 Pro）。Codex Pro 200 周额度复测（${CODEX_QUOTA_DATE}）：Astra 区间与点估计、Sol 条件下界、限制说明及历史报告。`,
      en: `Quota leaderboard by fee multiple (Claude Pro, X Ultra, Codex Pro 200, Volcengine Pro). Codex Pro 200 weekly retest (${CODEX_QUOTA_DATE}): Astra range and point estimate, Sol conditional lower bound, caveats and historical reports.`,
    },
  });
}

export default async function QuotaBenchPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const faq = codexQuotaFaq(locale);
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqPage([faq, claudeProQuotaFaq(locale)]) }} /><SiteHeader locale={locale} /><main className="container mx-auto max-w-5xl px-4 py-10">
    <h1 className="text-3xl font-bold">{locale === 'zh' ? '订阅额度排行：月费能换多少 API 用量' : 'Subscription quota leaderboard: API value per dollar of fee'}</h1>
    <GuideDates publishedAt={QUOTA_LEADERBOARD_PUBLISHED_AT} updatedAt={QUOTA_LEADERBOARD_UPDATED_AT} locale={locale === 'zh' ? 'zh' : 'en'} />
    <p className="mt-4 mb-6 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium leading-6 dark:border-emerald-900 dark:bg-emerald-950/30" data-testid="quota-bench-conclusion">{CONCLUSION[locale === 'zh' ? 'zh' : 'en']}</p>
    <QuotaLeaderboard locale={locale} />
    <h2 className="mt-8 mb-2 text-xl font-semibold">{locale === 'zh' ? '实测明细与方法' : 'Measurement details and method'}</h2>
    <QuotaBenchResults locale={locale} />
    <section className="mt-6 space-y-2 rounded-lg border p-4">
      <h2 className="font-semibold">{faq.question}</h2>
      <p className="text-sm">{faq.answer}</p>
    </section>
    <div id="claude-pro-quota" className="mt-6 scroll-mt-20 rounded-lg border p-4"><ClaudeProQuota locale={locale} /></div>
    <details className="mt-6 space-y-2 rounded-lg border p-4" aria-label={locale === 'zh' ? '默认评测规则' : 'Default measurement policy'}>
      <summary className="cursor-pointer text-sm underline">{locale === 'zh' ? '所有可用周期，同轮实测' : 'Measure all available windows in the same run'}</summary>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{locale === 'zh'
        ? '后续评测同时记录所有可读取的额度窗口，共用同一批 token 账本，分别计算 5 小时、日、周、月等周期。优先提高短周期和周额度精度；月等长周期保留粗估及误差说明。'
        : 'Future runs record every readable allowance window using one token ledger, estimating five-hour, daily, weekly and monthly limits separately. Short and weekly windows take priority for precision; longer windows retain rough estimates with uncertainty.'}</p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{locale === 'zh'
        ? '每批结束后复读额度，遇到重置分段计算。无法读取或变化不足时明确标注，不跨窗口推算。结果保留模型和输入、输出、缓存配比；舍入区间不代表整体准确率。数据、报告与套餐卡片同步更新。'
        : 'Recheck meters after each batch and split intervals at resets. Mark unavailable or insufficient signals explicitly; do not scale limits by elapsed time. Preserve the model and input, output and cache mix; rounding bounds do not express overall accuracy. Publish data, reports and plan-card results together.'}</p>
    </details>
  </main></>;
}
