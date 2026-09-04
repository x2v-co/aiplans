import { getGroupedProducts } from '@/lib/grouped-products';
import { selectVendorLeaders } from '@/lib/flagship-models';
import { breadcrumbList, faqPage, SITE_URL, type Locale } from '@/lib/seo';
import CompareModelsView from './compare-models-view';
import { FAQS } from './faqs';

/**
 * Server component. The previous /compare/models page was a non-locale legacy
 * route that proxy.ts redirected into a 404; the new locale route ships the
 * candidate list and their cheapest channel prices in the served HTML so
 * crawlers (and the default two-model comparison) are not a spinner. The
 * interactive model picker lives in compare-models-view.tsx.
 *
 * `?models=slug1,slug2` preselects models. It is parsed here (not via
 * useSearchParams) so the initial comparison is server-rendered without a
 * Suspense boundary; unknown slugs are ignored and capped at 4.
 */
export default async function CompareModelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ models?: string }>;
}) {
  const { locale } = await params;
  const { models: modelsParam } = await searchParams;
  const products = await getGroupedProducts('llm');
  const vendorLeaders = selectVendorLeaders(products);
  const loc = (locale === 'zh' ? 'zh' : 'en') as Locale;

  const validSlugs = new Set(products.map((p) => p.slug));
  const initialSlugs = (modelsParam ? modelsParam.split(',') : [])
    .map((s) => s.trim())
    .filter((s) => validSlugs.has(s))
    .slice(0, 4);

  const faqs = FAQS[loc];
  const crumbs = breadcrumbList([
    { name: loc === 'zh' ? '首页' : 'Home', url: `${SITE_URL}/${locale}` },
    { name: loc === 'zh' ? '模型对比' : 'Model compare', url: `${SITE_URL}/${locale}/compare/models` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: crumbs }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqPage(faqs) }}
      />
      <CompareModelsView
        locale={locale}
        products={products}
        vendorLeaderSlugs={vendorLeaders.map(({ product }) => product.slug)}
        initialSlugs={initialSlugs}
        faqs={faqs}
      />
    </>
  );
}
