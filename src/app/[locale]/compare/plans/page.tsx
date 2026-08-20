import { getComparePlansIndexData } from "@/lib/compare-plans-index";
import ComparePlansIndexView from "./compare-plans-index-view";

/**
 * Server component — see compare-plans-index-view.tsx. The lists were assembled
 * in an effect from three API calls, so this page shipped crawlers 85 characters
 * and a "Loading..." string.
 */
export default async function ComparePlansIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const data = await getComparePlansIndexData();

  return <ComparePlansIndexView locale={locale} data={data} />;
}
