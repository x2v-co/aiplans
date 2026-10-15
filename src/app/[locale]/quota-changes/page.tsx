import SiteHeader from '@/components/SiteHeader';
import { QuotaChanges } from '@/components/quota-changes';
import { getVerifiedQuotaEstimates } from '@/lib/quota/data';
import { quotaChanges } from '@/lib/quota/estimates';
import { quotaHistoryJsonLd, quotaHistoryMetadata } from '@/lib/quota/history-seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const changes = quotaChanges(await getVerifiedQuotaEstimates());
  return quotaHistoryMetadata(locale === 'zh' ? 'zh' : 'en', changes.length > 0);
}

export default async function QuotaChangesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const changes = quotaChanges(await getVerifiedQuotaEstimates());
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: quotaHistoryJsonLd(locale === 'zh' ? 'zh' : 'en', changes) }} />
      <SiteHeader locale={locale} />
      <QuotaChanges changes={changes} locale={locale} />
    </>
  );
}
