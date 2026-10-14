import type { Metadata } from 'next';
import { buildMetadata, type Locale } from '@/lib/seo';
import { buildApiPricingSeo } from '@/lib/pricing-seo';
import { getApiPricingSeoData } from '@/lib/pricing-seo-data';

/**
 * Route-level metadata (canonical/hreflang/OG) for /api-pricing.
 *
 * The FAQ used to be emitted here as a static FAQPage — but it had no visible
 * counterpart on the page, which violates Google's FAQ structured-data policy
 * (FAQ content must be visible), and the answer even hardcoded a generic
 * "30-50% cheaper" claim. The data-driven, *visible* FAQ now lives in
 * page.tsx + api-pricing-view.tsx and is mirrored by FAQPage JSON-LD there.
 * This layout intentionally emits no JSON-LD.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { products, updatedAt } = await getApiPricingSeoData();
  const en = buildApiPricingSeo(products, updatedAt, 'en');
  const zh = buildApiPricingSeo(products, updatedAt, 'zh');
  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: '/api-pricing',
    title: { en: en.title, zh: zh.title },
    description: { en: en.description, zh: zh.description },
  });
}

export default function ApiPricingLayout({
  children,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  return <>{children}</>;
}
