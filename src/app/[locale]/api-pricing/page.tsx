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
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const products = await getGroupedProducts("llm");

  return <ApiPricingView locale={locale} products={products} />;
}
