import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getProviderLogoFallback, getProviderLogoSrc } from "@/lib/provider-branding";

async function getProvidersWithPlans() {
  // Get all providers
  const { data: providers } = await supabase
    .from('providers')
    .select('*')
    .order('name', { ascending: true });

  if (!providers) return [];

  // Get plan counts for each provider
  const providerIds = providers.map(p => p.id);
  const { data: plans } = await supabase
    .from('plans')
    .select('provider_id')
    .in('provider_id', providerIds);

  // Count plans per provider
  const planCounts: Record<number, number> = {};
  (plans || []).forEach(plan => {
    planCounts[plan.provider_id] = (planCounts[plan.provider_id] || 0) + 1;
  });

  // Filter providers with plans and add count
  return providers
    .filter(p => planCounts[p.id] > 0)
    .map(p => ({
      ...p,
      planCount: planCounts[p.id] || 0
    }))
    .sort((a, b) => b.planCount - a.planCount);
}

export default async function PlansIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const providers = await getProvidersWithPlans();

  const isZh = locale === 'zh';

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 dark:bg-black/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <span className="text-2xl">💰</span>
            <span className="text-xl font-bold">aiplans.dev</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href={`/${locale}`} className="text-sm font-medium hover:text-blue-600">
              {isZh ? '首页' : 'Home'}
            </Link>
            <Link href={`/${locale}/compare/plans`} className="text-sm font-medium hover:text-blue-600">
              {isZh ? '套餐对比' : 'Compare Plans'}
            </Link>
            <Link href={`/${locale}/api-pricing`} className="text-sm font-medium hover:text-blue-600">
              {isZh ? 'API 价格' : 'API Pricing'}
            </Link>
            <Link href={`/${locale}/coupons`} className="text-sm font-medium hover:text-blue-600">
              {isZh ? '优惠码' : 'Coupons'}
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            {isZh ? '📋 所有供应商订阅计划' : '📋 All Provider Subscription Plans'}
          </h1>
          <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-8">
            {isZh
              ? '浏览所有 AI 服务供应商的订阅套餐，找到最适合你的方案'
              : 'Browse subscription plans from all AI service providers and find the best fit for you'}
          </p>
        </div>

        {/* Providers Grid */}
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
                <Link key={provider.id} href={`/${locale}/plans/${provider.slug}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4 mb-4">
                        {getProviderLogoSrc(provider) ? (
                          <img
                            src={getProviderLogoSrc(provider)!}
                            alt={provider.name}
                            className="w-14 h-14 object-contain"
                          />
                        ) : (
                          <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
                            <span className="text-2xl">{getProviderLogoFallback(provider, "🏢")}</span>
                          </div>
                        )}
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

                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-sm">
                          {provider.planCount} {isZh ? '个套餐' : 'plans'}
                        </Badge>
                        <span className="text-blue-600 text-sm font-medium flex items-center gap-1">
                          {isZh ? '查看详情' : 'View Plans'} <ArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
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
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">💰</span>
            <span className="font-medium">aiplans.dev</span>
          </div>
          <p className="text-sm text-zinc-500">
            {isZh ? '© 2026 aiplans.dev - 全网 AI 价格对比' : '© 2026 aiplans.dev - Compare AI pricing & save money'}
          </p>
        </div>
      </footer>
    </div>
  );
}
