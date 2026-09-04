import { getGroupedProducts } from '@/lib/grouped-products';
import { selectVendorLeaders } from '@/lib/flagship-models';
import { breadcrumbList, jsonLd, SITE_URL } from '@/lib/seo';
import CalculatorView, { type CalculatorInitialState } from './calculator-view';

function numericParam(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export default async function CalculatorPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  const products = await getGroupedProducts('llm');
  const validSlugs = new Set(products.map((product) => product.slug));
  const modelParam = typeof query.models === 'string' ? query.models : '';
  const requestedModels = modelParam.split(',').map((value) => value.trim()).filter((value) => validSlugs.has(value));
  const defaults = selectVendorLeaders(products).slice(0, 3).map(({ product }) => product.slug);

  const initialState: CalculatorInitialState = {
    period: query.period === 'month' ? 'month' : 'day',
    requests: numericParam(typeof query.requests === 'string' ? query.requests : undefined, 1000, 0, 1_000_000_000),
    inputTokens: numericParam(typeof query.input === 'string' ? query.input : undefined, 1000, 0, 10_000_000),
    outputTokens: numericParam(typeof query.output === 'string' ? query.output : undefined, 500, 0, 10_000_000),
    cacheRate: numericParam(typeof query.cache === 'string' ? query.cache : undefined, 0, 0, 100),
    batchRate: numericParam(typeof query.batch === 'string' ? query.batch : undefined, 0, 0, 100),
    region: query.region === 'china' || query.region === 'global' ? query.region : 'all',
    modelSlugs: (requestedModels.length ? requestedModels : defaults).slice(0, 4),
  };

  const crumbs = breadcrumbList([
    { name: locale === 'zh' ? '首页' : 'Home', url: `${SITE_URL}/${locale}` },
    { name: locale === 'zh' ? 'API 成本计算器' : 'API cost calculator', url: `${SITE_URL}/${locale}/calculator` },
  ]);
  const application = jsonLd({
    '@type': 'WebApplication',
    name: locale === 'zh' ? 'AI API 成本计算器' : 'AI API Cost Calculator',
    url: `${SITE_URL}/${locale}/calculator`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: application }} />
      <CalculatorView locale={locale} products={products} initialState={initialState} />
    </>
  );
}
