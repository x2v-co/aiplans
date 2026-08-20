import { getCoupons } from "@/lib/coupons";
import CouponsView from "./coupons-view";

/**
 * Server component — see coupons-view.tsx. The page fetched /api/coupons from an
 * effect, so the served HTML held no codes, no providers and no discounts.
 */
export default async function CouponsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const coupons = await getCoupons();

  return <CouponsView locale={locale} coupons={coupons} />;
}
