import SiteHeader from '@/components/SiteHeader';
import { QuotaBenchResults } from '@/components/quota-bench-results';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: locale === 'zh' ? '额度实测数据与报告 | aiplans' : 'Quota measurements and reports | aiplans' };
}

export default async function QuotaBenchPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <><SiteHeader locale={locale} /><main className="container mx-auto max-w-5xl px-4 py-10">
    <h1 className="mb-6 text-3xl font-bold">{locale === 'zh' ? '额度实测与测量依据' : 'Quota measurements and evidence'}</h1>
    <section className="mb-6 space-y-2 rounded-lg border p-4" aria-label={locale === 'zh' ? '默认评测规则' : 'Default measurement policy'}>
      <h2 className="text-lg font-semibold">{locale === 'zh' ? '所有可用周期，同轮实测' : 'Measure all available windows in the same run'}</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{locale === 'zh'
        ? '后续评测同时记录所有可读取的额度窗口，共用同一批 token 账本，分别计算 5 小时、日、周、月等周期。优先提高短周期和周额度精度；月等长周期保留粗估及误差说明。'
        : 'Future runs record every readable allowance window using one token ledger, estimating five-hour, daily, weekly and monthly limits separately. Short and weekly windows take priority for precision; longer windows retain rough estimates with uncertainty.'}</p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{locale === 'zh'
        ? '每批结束后复读额度，遇到重置分段计算。无法读取或变化不足时明确标注，不按时间倍数推算。结果保留模型和输入、输出、缓存配比；舍入区间不代表整体准确率。数据、报告与套餐卡片同步更新。'
        : 'Recheck meters after each batch and split intervals at resets. Mark unavailable or insufficient signals explicitly; do not scale limits by elapsed time. Preserve the model and input, output and cache mix; rounding bounds do not express overall accuracy. Publish data, reports and plan-card results together.'}</p>
    </section>
    <QuotaBenchResults locale={locale} />
  </main></>;
}
