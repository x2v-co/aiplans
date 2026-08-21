import { getGroupedProducts } from "@/lib/grouped-products";
import ApiPricingView from "./api-pricing-view";

/**
 * Server component. The whole page used to be a client component that fetched
 * /api/products/grouped in an effect, so crawlers received a spinner and not one
 * model name — on the page CLAUDE.md calls the site's core SEO surface. Querying
 * here puts all ~320 models and their channel prices in the served HTML.
 *
 * The interactive parts (search, sort, filters) live in api-pricing-view.tsx and
 * are unchanged; only where the data comes from moved.
 */
export default async function ApiPricingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;
  const products = await getGroupedProducts("llm");

  // `q` is the target of the site-wide WebSite SearchAction (JSON-LD). Reading
  // it server-side means /api-pricing?q=gpt serves pre-filtered HTML, so the
  // Sitelinks Search Box target is truthful rather than a dead-end ?q= that
  // only the client could react to.
  return <ApiPricingView locale={locale} products={products} initialQuery={q} />;
}
