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
    <QuotaBenchResults locale={locale} />
  </main></>;
}
