import { getCoupons } from "@/lib/coupons";
import { breadcrumbList, SITE_URL, type Locale } from "@/lib/seo";
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
  const loc = (locale === "zh" ? "zh" : "en") as Locale;
  const coupons = await getCoupons();

  const crumbs = breadcrumbList([
    { name: loc === "zh" ? "首页" : "Home", url: `${SITE_URL}/${locale}` },
    { name: loc === "zh" ? "优惠码" : "Coupons", url: `${SITE_URL}/${locale}/coupons` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: crumbs }}
      />
      <CouponsView locale={locale} coupons={coupons} />
    </>
  );
}
