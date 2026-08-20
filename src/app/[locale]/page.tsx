import { getProducts } from "@/lib/products";
import HomeView, { type HotModel } from "./home-view";

/**
 * Server component — see home-view.tsx. The hot-model cards were fetched from
 * /api/products in an effect, so the homepage went out with its four internal
 * links to /compare/plans/[model] missing from the HTML.
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  let hotModels: HotModel[] = [];
  try {
    hotModels = (await getProducts({
      type: "llm",
      featured: true,
      includePlanCount: true,
    })) as HotModel[];
  } catch (err) {
    // The rest of the landing page is static copy and is worth serving even if
    // the database is unreachable — which is what the old effect's .catch did.
    console.error("home: failed to load hot models", err);
  }

  return <HomeView locale={locale} hotModels={hotModels} />;
}
