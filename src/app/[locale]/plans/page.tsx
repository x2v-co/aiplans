import { currentPlanCondition } from '@/lib/plan-lifecycle-query';
import Link from "next/link";
import { ProviderLogo } from '@/components/provider-logo';
import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, ArrowRight, SquarePen, Network } from "lucide-react";
import { sql } from "@/lib/db";
import { getActiveCouponMap } from "@/lib/coupons";
import { CouponBadge } from "@/components/coupon-badge";
import { buildMetadata, breadcrumbList, jsonLd, SITE_URL, type Locale } from "@/lib/seo";
import SiteHeader from '@/components/SiteHeader';
import { buildPlansIndexPricingCopy } from '@/lib/pricing-seo';
import { getPlansSeoProviders } from '@/lib/pricing-seo-data';
import { buildGatewaySectionRows, gatewaySectionCopy, GATEWAY_SECTION_ID, type GatewaySectionSource } from '@/lib/gateway-subscription-section';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const providers = await getPlansSeoProviders();
  const en = buildPlansIndexPricingCopy(providers, 'en');
  const zh = buildPlansIndexPricingCopy(providers, 'zh');
  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: '/plans',
    title: { en: en.title, zh: zh.title },
    description: { en: en.description, zh: zh.description },
  });
}

async function getProvidersWithPlans() {
  return sql<any[]>`
    SELECT p.*, COUNT(pl.id)::integer AS "planCount"
    FROM providers p
    JOIN plans pl ON pl.provider_id = p.id
    WHERE ${currentPlanCondition('pl')}
    GROUP BY p.id
    ORDER BY "planCount" DESC, p.name ASC
  `;
}

async function getGatewaySubscriptionPlans() {
  return sql<GatewaySectionSource[]>`
    SELECT pl.id, pl.name, pl.plan_kind, pl.price::float8 AS price, pl.currency,
           pl.monthly_api_credit_usd::float8 AS monthly_api_credit_usd, pl.has_overage_pricing,
           p.name AS provider_name, p.slug AS provider_slug
    FROM plans pl
    JOIN providers p ON p.id = pl.provider_id
    WHERE pl.plan_kind = 'gateway_subscription' AND ${currentPlanCondition('pl')}
    ORDER BY pl.id
  `;
}

export default async function PlansIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ kind?: string | string[] }>;
}) {
  const { locale } = await params;
  const kindParam = (await searchParams)?.kind;
  const gatewayOnly = (Array.isArray(kindParam) ? kindParam[0] : kindParam) === 'gateway_subscription';
  const [providers, couponByProvider, gatewayPlans] = await Promise.all([
    getProvidersWithPlans(),
    getActiveCouponMap('plan'),
    getGatewaySubscriptionPlans(),
  ]);
  const gatewayRows = buildGatewaySectionRows(gatewayPlans, locale);
  const gatewayCopy = gatewaySectionCopy(locale);

  const isZh = locale === 'zh';
  const copy = buildPlansIndexPricingCopy(providers, isZh ? 'zh' : 'en');

  // Structured data: breadcrumb + ItemList of providers
  const breadcrumbJson = breadcrumbList([
    { name: isZh ? '首页' : 'Home', url: `${SITE_URL}/${locale}` },
    { name: isZh ? '套餐总览' : 'Plans', url: `${SITE_URL}/${locale}/plans` },
  ]);
  const itemListJson = jsonLd({
    '@type': 'ItemList',
    name: isZh ? 'AI 服务供应商订阅套餐' : 'AI Provider Subscription Plans',
    numberOfItems: providers.length,
    itemListElement: providers.slice(0, 50).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/${locale}/providers/${p.slug}`,
      name: p.name,
    })),
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJson }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJson }} />
      <SiteHeader locale={locale} />

      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            {copy.title}
          </h1>
          <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-8">
            {copy.description}
          </p>
          <Link
            href={`/${locale}/submit-provider`}
            className="inline-flex items-center gap-2 rounded-md border bg-white px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            <SquarePen className="h-4 w-4" />
            {isZh ? '提交供应商或专属优惠' : 'Submit a provider or exclusive offer'}
          </Link>
        </div>

        {/* Gateway subscriptions (plan_kind = gateway_subscription); hidden when empty */}
        {gatewayRows.length > 0 && (
          <section id={GATEWAY_SECTION_ID} className="mb-12 scroll-mt-20">
            <div className="flex items-center gap-2 mb-2">
              <Network className="w-6 h-6 text-purple-500" />
              <h2 className="text-2xl font-bold">{gatewayCopy.title}</h2>
              <Badge variant="outline">{gatewayRows.length}</Badge>
            </div>
            <p className="text-sm text-zinc-500 mb-6">{gatewayCopy.description}</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {gatewayRows.map((row) => (
                <Card key={row.id} className="hover:shadow-lg transition-shadow h-full flex flex-col">
                  <CardContent className="p-6 flex flex-1 flex-col">
                    <h3 className="font-bold text-xl">{row.name}</h3>
                    <p className="text-sm text-zinc-500 mb-4">{row.providerName}</p>
                    <dl className="grid grid-cols-3 gap-2 text-sm mb-4">
                      <div><dt className="text-zinc-500">{gatewayCopy.price}</dt><dd className="font-semibold">{row.priceText}</dd></div>
                      <div><dt className="text-zinc-500">{gatewayCopy.credit}</dt><dd className="font-semibold">{row.creditText}</dd></div>
                      <div><dt className="text-zinc-500">{gatewayCopy.multiple}</dt><dd className="font-semibold text-green-600">{row.multipleText}</dd></div>
                    </dl>
                    <Link href={row.href} className="mt-auto text-blue-600 text-sm font-medium flex items-center gap-1">
                      {gatewayCopy.view} <ArrowRight className="w-4 h-4" />
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Providers Grid */}
        {!(gatewayOnly && gatewayRows.length > 0) && (
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Building2 className="w-6 h-6 text-blue-500" />
            <h2 className="text-2xl font-bold">
              {isZh ? '供应商列表' : 'Provider List'}
            </h2>
            <Badge variant="outline">{providers.length} {isZh ? '个供应商' : 'providers'}</Badge>
          </div>

          {providers.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {providers.map((provider) => (
                <Card key={provider.id} className="hover:shadow-lg transition-shadow h-full flex flex-col">
                  <CardContent className="p-6 flex flex-1 flex-col">
                      <div className="flex items-center gap-4 mb-4">
                        <ProviderLogo provider={provider} size={56} />
                        <div className="flex-1">
                          <h3 className="font-bold text-xl">{provider.name}</h3>
                          {provider.region === 'china' && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              🇨🇳 {isZh ? '国内' : 'China'}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {provider.description && (
                        <p className="text-sm text-zinc-500 mb-4 line-clamp-2">
                          {provider.description}
                        </p>
                      )}

                      <div className="mt-auto flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-sm shrink-0">
                          {provider.planCount} {isZh ? '个套餐' : 'plans'}
                        </Badge>
                        <div className="flex items-center gap-2 min-w-0">
                          <CouponBadge
                            coupons={couponByProvider[provider.slug] ?? []}
                            locale={locale}
                            size="xs"
                          />
                          <Link
                            href={`/${locale}/providers/${provider.slug}`}
                            className="text-blue-600 text-sm font-medium flex items-center gap-1 shrink-0"
                          >
                            {isZh ? '查看详情' : 'View Plans'} <ArrowRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-zinc-500">
                  {isZh ? '暂无供应商计划数据' : 'No provider plans available yet.'}
                </p>
              </CardContent>
            </Card>
          )}
        </section>
        )}
      </main>
    </div>
  );
}
