import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatPrice, CurrencyCode } from "@/lib/currency";
import { getAllModelIdsForProvider, getPlanYearlyMonthly } from "@/lib/schema-adapters";
import { getProviderLogoFallback, getProviderLogoSrc } from "@/lib/provider-branding";
import { buildMetadata, breadcrumbList, productOffer, jsonLd, SITE_URL, type Locale } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; provider: string }>;
}): Promise<Metadata> {
  const { locale, provider: providerSlug } = await params;
  const { data: provider } = await supabase
    .from('providers')
    .select('name, description, region')
    .eq('slug', providerSlug)
    .single();
  const providerName = provider?.name ?? providerSlug;
  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: `/plans/${providerSlug}`,
    title: {
      en: `${providerName} Subscription Plans & API Pricing | aiplans.dev`,
      zh: `${providerName} 订阅套餐与 API 价格 | aiplans.dev`,
    },
    description: {
      en: `Compare every ${providerName} subscription tier — free, pro, team, enterprise — including monthly + annual pricing, model access, rate limits and regional availability. Verified daily.`,
      zh: `对比 ${providerName} 全部订阅档位（免费/Pro/团队/企业），含月付/年付价格、模型权限、速率限制和区域可用性。每日审计。`,
    },
  });
}

// Provider info map
const providerInfo: Record<string, { name: string; logo: string; description: string }> = {
  openai: { name: "OpenAI", logo: "🤖", description: "Creators of GPT-4, DALL-E, and more" },
  anthropic: { name: "Anthropic", logo: "🧠", description: "AI safety company behind Claude" },
  deepseek: { name: "DeepSeek", logo: "🔮", description: "Chinese AI company with open-source models" },
  google: { name: "Google", logo: "🌐", description: "Google Cloud AI with Gemini models" },
  meta: { name: "Meta", logo: "🦙", description: "Llama open-source models" },
};

async function getPlansByProvider(providerSlug: string) {
  // First get provider
  const { data: provider } = await supabase
    .from('providers')
    .select('*')
    .eq('slug', providerSlug)
    .single();

  if (!provider) return null;

  // Get plans for this provider directly
  const { data: plans } = await supabase
    .from('plans')
    .select('*')
    .eq('provider_id', provider.id)
    .order('price', { ascending: true });

  const planIds = (plans || []).map(p => p.id);
  const modelIds = await getAllModelIdsForProvider(provider.id, planIds);
  const { data: uniqueModels } = modelIds.length > 0
    ? await supabase
        .from('models')
        .select('id, name, slug, provider_ids')
        .in('id', modelIds)
    : { data: [] };

  return { provider, models: uniqueModels || [], plans: plans || [] };
}

export default async function ProviderPlansPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; provider: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { locale, provider: providerSlug } = await params;
  const { period } = await searchParams;
  const showYearly = period === 'yearly';
  const data = await getPlansByProvider(providerSlug);

  if (!data) {
    notFound();
  }

  const { provider, models, plans } = data;
  const providerData = providerInfo[providerSlug] || { name: provider.name, description: "" };

  // Determine currency based on provider region (china providers use CNY)
  const currency: CurrencyCode = provider.region === 'china' ? 'CNY' : 'USD';

  // Structured data: breadcrumb + Product/Offer per plan
  const isZh = locale === 'zh';
  const breadcrumbJson = breadcrumbList([
    { name: isZh ? '首页' : 'Home', url: `${SITE_URL}/${locale}` },
    { name: isZh ? '套餐总览' : 'Plans', url: `${SITE_URL}/${locale}/plans` },
    { name: provider.name, url: `${SITE_URL}/${locale}/plans/${providerSlug}` },
  ]);
  const planJsonLdItems = plans
    .filter(p => p.price != null || p.is_contact_sales)
    .map(p => productOffer({
      name: `${provider.name} ${p.name}`,
      price: p.price ?? null,
      currency: p.currency ?? currency,
      url: `${SITE_URL}/${locale}/plans/${providerSlug}#${p.slug}`,
      description: p.notes ?? `${provider.name} ${p.name} subscription plan`,
      category: 'AI Subscription',
    }));

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJson }} />
      {planJsonLdItems.map((ld, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      ))}
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 dark:bg-black/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <span className="text-2xl">💰</span>
            <span className="text-xl font-bold">aiplans.dev</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href={`/${locale}/compare/plans`} className="text-sm font-medium hover:text-blue-600">
              Compare Plans
            </Link>
            <Link href={`/${locale}/compare/models`} className="text-sm font-medium hover:text-blue-600">
              Model Compare
            </Link>
            <Link href={`/${locale}/coupons`} className="text-sm font-medium hover:text-blue-600">
              Coupons
            </Link>
            <Link href={`/${locale}/api-pricing`} className="text-sm font-medium hover:text-blue-600">
              API Pricing
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
          <Link href={`/${locale}`} className="flex items-center gap-1 hover:text-blue-600">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>

        {/* Provider Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              {getProviderLogoSrc(provider) ? (
                  <Image src={getProviderLogoSrc(provider)!} alt={provider.name} width={64} height={64} className="w-16 h-16 object-contain" unoptimized />
                ) : (
                  <span className="text-5xl">{getProviderLogoFallback(provider, providerInfo[providerSlug]?.logo || "🏢")}</span>
                )}
              <div>
                <h1 className="text-3xl font-bold">{providerData.name} Plans</h1>
                <p className="text-zinc-600">{providerData.description}</p>
              </div>
            </div>
            {/* Period Toggle */}
            <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
              <Link
                href={`/${locale}/plans/${providerSlug}`}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  !showYearly ? 'bg-white dark:bg-zinc-700 shadow-sm' : 'text-zinc-500'
                }`}
              >
                Monthly
              </Link>
              <Link
                href={`/${locale}/plans/${providerSlug}?period=yearly`}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  showYearly ? 'bg-white dark:bg-zinc-700 shadow-sm' : 'text-zinc-500'
                }`}
              >
                Yearly
              </Link>
            </div>
          </div>
        </div>

        {/* Plans */}
        {plans.length > 0 ? (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              All Plans
              <Badge variant="outline">{plans.length} plans</Badge>
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <Card key={plan.id} className={plan.tier === 'pro' ? 'border-blue-500' : ''}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle>{plan.name}</CardTitle>
                      {plan.tier === 'pro' && (
                        <Badge className="bg-blue-600">Popular</Badge>
                      )}
                    </div>
                    <CardDescription>
                      {plan.pricing_model === 'subscription' && 'Monthly subscription'}
                      {plan.pricing_model === 'token_pack' && 'One-time token pack'}
                      {plan.pricing_model === 'pay_as_you_go' && 'Pay as you go'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <span className="text-3xl font-bold">
                        {plan.price === 0
                          ? 'Free'
                          : showYearly && getPlanYearlyMonthly(plan)
                            ? formatPrice(getPlanYearlyMonthly(plan)! * 12, currency)
                            : formatPrice(plan.price, currency)}
                      </span>
                      {plan.price_unit && plan.price !== 0 && (
                        <span className="text-zinc-500 text-sm ml-1">
                          /{showYearly ? 'year' : (plan.price_unit === 'per_month' ? 'mo' : plan.price_unit.replace('_', ' '))}
                        </span>
                      )}
                    </div>

                    {plan.features && Array.isArray(plan.features) && (
                      <ul className="space-y-2 mb-4">
                        {plan.features.slice(0, 4).map((feature: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <Separator className="my-4" />

                    <div className="space-y-2 text-sm">
                      {plan.monthly_message_limit !== null && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500">{isZh ? '消息数' : 'Messages'}</span>
                          <span>{plan.monthly_message_limit === 0 ? (isZh ? '无限' : 'Unlimited') : `${plan.monthly_message_limit}${isZh ? '/月' : '/month'}`}</span>
                        </div>
                      )}
                      {plan.context_window && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500">{isZh ? '上下文' : 'Context'}</span>
                          <span>{plan.context_window.toLocaleString()} tokens</span>
                        </div>
                      )}
                      {plan.rate_limit && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500">{isZh ? '速率限制' : 'Rate Limit'}</span>
                          <span>{plan.rate_limit}/min</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-zinc-500">{isZh ? '中国直连' : 'China Access'}</span>
                        <span>{plan.access_from_china ? (isZh ? '✓ 可用' : '✓ Available') : (isZh ? '✗ 不可用' : '✗ Not available')}</span>
                      </div>
                    </div>

                    {(provider.pricing_url || provider.website || provider.invite_url) && (
                      <a
                        href={provider.pricing_url || provider.invite_url || provider.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 block w-full text-center rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        {plan.is_contact_sales
                          ? (isZh ? '联系销售 →' : 'Contact Sales →')
                          : (isZh ? '去订阅 →' : 'Subscribe →')}
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-zinc-500">No plans available for this provider yet.</p>
            </CardContent>
          </Card>
        )}

        {/* Models Section */}
        {models.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              Models
              <Badge variant="outline">{models.length} models</Badge>
            </h2>
            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
              {models.map((model: any) => (
                <Link key={model.id} href={`/${locale}/models/${model.slug}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="py-4">
                      <h3 className="font-medium">{model.name}</h3>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">💰</span>
            <span className="font-medium">aiplans.dev</span>
          </div>
          <p className="text-sm text-zinc-500">
            © 2026 aiplans.dev
          </p>
        </div>
      </footer>
    </div>
  );
}
