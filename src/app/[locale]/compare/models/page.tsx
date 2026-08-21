import { getGroupedProducts } from '@/lib/grouped-products';
import CompareModelsView from './compare-models-view';

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

  const validSlugs = new Set(products.map((p) => p.slug));
  const initialSlugs = (modelsParam ? modelsParam.split(',') : [])
    .map((s) => s.trim())
    .filter((s) => validSlugs.has(s))
    .slice(0, 4);

  return (
    <CompareModelsView
      locale={locale}
      products={products}
      initialSlugs={initialSlugs}
    />
  );
}
