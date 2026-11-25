import ComparePlansView from '@/app/[locale]/compare/plans/[model]/compare-plans-view';
import { buildCompareFaqs } from '@/app/[locale]/compare/plans/[model]/faqs';
import { getIntegratedPlanComparison } from '@/lib/model-plan-comparison';
import { getActiveCouponMap } from '@/lib/coupons';
import { getVerifiedQuotaEstimates } from '@/lib/quota/data';
import { guideForModelSlug, PRICING_GUIDES } from '@/lib/pricing-guides';

export default async function ModelSubscriptionComparison({ slug, locale }: { slug: string; locale: string }) {
  const data = await getIntegratedPlanComparison(slug);
  if (!data) return null;
  const [couponByProvider, quotaEstimates] = await Promise.all([
    getActiveCouponMap('plan'),
    getVerifiedQuotaEstimates([...data.officialPlans, ...data.thirdPartyPlans].map(entry => entry.plan.slug)),
  ]);
  const language = locale === 'zh' ? 'zh' : 'en';
  const guideSlug = guideForModelSlug(slug);
  const pricingGuide = guideSlug ? { href: `/${locale}/guides/${guideSlug}`, label: PRICING_GUIDES[guideSlug].title[language] } : undefined;
  return <ComparePlansView embedded locale={locale} data={data} faqs={buildCompareFaqs(data, language)}
    couponByProvider={couponByProvider} quotaEstimates={quotaEstimates} pricingGuide={pricingGuide} />;
}
