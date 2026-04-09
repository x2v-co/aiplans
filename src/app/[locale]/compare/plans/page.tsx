'use client';

import { use, useDeferredValue, useEffect, useState } from 'react';
import Link from "next/link";
import { useTranslations } from '@/lib/translations';
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp, Building2, Zap, ArrowRight } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getProviderLogoFallback, getProviderLogoSrc } from "@/lib/provider-branding";

export default function ComparePlansIndexPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(props.params);
  const t = useTranslations('compare');
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');

  const [hotModelsList, setHotModelsList] = useState<any[]>([]);
  const [modelsByProvider, setModelsByProvider] = useState<any[]>([]);
  const [featuredPlans, setFeaturedPlans] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'elo' | 'plans' | 'name'>('elo');
  const [loading, setLoading] = useState(true);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    async function loadData() {
      try {
        // 1. Load hot models
        const hotModelsResponse = await fetch('/api/products?featured=true&include_plan_count=true&type=llm');
        const hotModelsData = await hotModelsResponse.json();

        // Sort by Arena ELO score (highest first)
        const sortedHotModels = hotModelsData.sort((a: any, b: any) => {
          const aElo = a.benchmark_arena_elo || 0;
          const bElo = b.benchmark_arena_elo || 0;
          return bElo - aElo;
        });

        setHotModelsList(sortedHotModels);

        // 1.5. Load plans so the page surfaces actual plan entries again
        const plansResponse = await fetch('/api/plans?include_models=true');
        const plansData = await plansResponse.json();
        const sortedPlans = (plansData || [])
          .filter((plan: any) => plan.pricing_model === 'subscription')
          .sort((a: any, b: any) => {
            if ((a.is_official || false) !== (b.is_official || false)) {
              return a.is_official ? -1 : 1;
            }
            return (a.price || Infinity) - (b.price || Infinity);
          })
          .slice(0, 8);

        setFeaturedPlans(sortedPlans);

        // 2. Load ALL products in a single request (instead of N+1 requests per provider)
        const allProductsResponse = await fetch('/api/products?include_plan_count=true&type=llm');
        const allProducts = await allProductsResponse.json();

        // Group by provider on the client side
        const providerMap = new Map();
        allProducts.forEach((product: any) => {
          const providerId = product.providers?.id || product.provider_ids?.[0];
          // Skip products without a valid provider ID
          if (!providerId) return;

          const providerName = product.providers?.name || 'Unknown';
          const providerLogo = getProviderLogoSrc(product.providers) || '';

          if (!providerMap.has(providerId)) {
            providerMap.set(providerId, {
              provider: {
                id: providerId,
                name: providerName,
                logo: providerLogo
              },
              models: []
            });
          }
          providerMap.get(providerId).models.push(product);
        });

        // Sort providers by number of models (descending)
        const grouped = Array.from(providerMap.values())
          .sort((a: any, b: any) => b.models.length - a.models.length);

        setModelsByProvider(grouped);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase();

  const filteredModelsByProvider = modelsByProvider
    .map((item: any) => {
      const filteredModels = item.models
        .filter((model: any) => {
          if (!normalizedSearchQuery) return true;

          const haystacks = [
            model.name,
            model.slug,
            model.providers?.name,
            item.provider?.name,
          ]
            .filter(Boolean)
            .map((value: string) => value.toLowerCase());

          return haystacks.some((value: string) => value.includes(normalizedSearchQuery));
        })
        .sort((a: any, b: any) => {
          if (sortBy === 'name') {
            return a.name.localeCompare(b.name);
          }
          if (sortBy === 'plans') {
            const planDiff = (b.planCount || 0) - (a.planCount || 0);
            if (planDiff !== 0) return planDiff;
            return (b.benchmark_arena_elo || 0) - (a.benchmark_arena_elo || 0);
          }
          const eloDiff = (b.benchmark_arena_elo || 0) - (a.benchmark_arena_elo || 0);
          if (eloDiff !== 0) return eloDiff;
          return (b.planCount || 0) - (a.planCount || 0);
        });

      return {
        ...item,
        models: filteredModels,
      };
    })
    .filter((item: any) => item.models.length > 0)
    .sort((a: any, b: any) => {
      if (sortBy === 'name') {
        return a.provider.name.localeCompare(b.provider.name);
      }

      const scoreForProvider = (providerItem: any) => {
        const topModel = providerItem.models[0];
        if (!topModel) return 0;
        return sortBy === 'plans' ? (topModel.planCount || 0) : (topModel.benchmark_arena_elo || 0);
      };

      const scoreDiff = scoreForProvider(b) - scoreForProvider(a);
      if (scoreDiff !== 0) return scoreDiff;
      return a.provider.name.localeCompare(b.provider.name);
    });

  const visibleModelCount = filteredModelsByProvider.reduce(
    (count: number, item: any) => count + item.models.length,
    0
  );

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
              {tNav('home')}
            </Link>
            <Link href={`/${locale}/compare/plans`} className="text-sm font-medium text-blue-600">
              {tNav('comparePlans')}
            </Link>
            <Link href={`/${locale}/api-pricing`} className="text-sm font-medium hover:text-blue-600">
              {tNav('apiPricing')}
            </Link>
            <Link href={`/${locale}/coupons`} className="text-sm font-medium hover:text-blue-600">
              {tNav('coupons')}
            </Link>
            <a
              href="https://github.com/x2v-co/aiplans"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium hover:text-blue-600"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
            </a>
            <LanguageSwitcher />
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">🆚 {t('title')}</h1>
          <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-8">
            {t('subtitle')}
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-zinc-400 w-5 h-5" />
            <Input
              type="search"
              placeholder={t('searchPlaceholder')}
              className="pl-12 h-14 text-lg"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
        </div>

        {/* Hot Models Section */}
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-6 h-6 text-red-500" />
            <h2 className="text-2xl font-bold">🔥 {t('hotModels')}</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {hotModelsList.map((model) => (
              <Link key={model.id} href={`/${locale}/compare/plans/${model.slug}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {getProviderLogoSrc(model.providers) ? (
                          <img
                            src={getProviderLogoSrc(model.providers)!}
                            alt={model.providers.name}
                            className="w-8 h-8 object-contain"
                          />
                        ) : (
                          <span className="text-3xl">{getProviderLogoFallback(model.providers, "🤖")}</span>
                        )}
                        <div>
                          <h3 className="font-bold text-lg leading-tight">{model.name}</h3>
                          <p className="text-sm text-zinc-500">{model.providers?.name}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      {model.benchmark_arena_elo && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-500">Arena ELO</span>
                          <Badge variant="secondary">{Math.round(model.benchmark_arena_elo)}</Badge>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">{t('plansCount')}</span>
                        <Badge variant="outline">{model.planCount || 0}</Badge>
                      </div>
                    </div>

                    <div className="flex items-center text-blue-600 text-sm font-medium">
                      {t('compareAllPlans')} <ArrowRight className="w-4 h-4 ml-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Featured Plans */}
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="w-6 h-6 text-emerald-500" />
            <h2 className="text-2xl font-bold">
              {locale === 'zh' ? '热门套餐' : 'Featured Plans'}
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredPlans.map((plan) => {
              const planModels = Array.isArray(plan.models) ? plan.models : [];
              const showModels = planModels.slice(0, 2);

              return (
                <Link key={plan.id} href={`/${locale}/plans/${plan.provider?.slug || ''}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {getProviderLogoSrc(plan.provider) ? (
                            <img
                              src={getProviderLogoSrc(plan.provider)!}
                              alt={plan.provider.name}
                              className="w-8 h-8 object-contain"
                            />
                          ) : (
                            <span className="text-2xl">{getProviderLogoFallback(plan.provider, "🏢")}</span>
                          )}
                          <div>
                            <h3 className="font-bold leading-tight">{plan.name}</h3>
                            <p className="text-sm text-zinc-500">{plan.provider?.name || 'Unknown'}</p>
                          </div>
                        </div>
                        {plan.is_official && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            {locale === 'zh' ? '官方' : 'Official'}
                          </Badge>
                        )}
                      </div>

                      <div className="mb-4">
                        <div className="text-2xl font-bold">
                          {plan.price === 0 ? (locale === 'zh' ? '免费' : 'Free') : `$${(plan.price || 0).toFixed(2)}`}
                        </div>
                        <div className="text-sm text-zinc-500">
                          {plan.price === 0
                            ? (locale === 'zh' ? '立即体验' : 'Try now')
                            : (plan.price_unit === 'per_month'
                                ? (locale === 'zh' ? '每月' : 'per month')
                                : (plan.price_unit || 'per_month'))}
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-500">{locale === 'zh' ? '包含模型' : 'Models included'}</span>
                          <Badge variant="secondary">{planModels.length}</Badge>
                        </div>
                        {showModels.map((model: any) => (
                          <div key={model.id} className="text-sm text-zinc-600 dark:text-zinc-400">
                            {model.name}
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center text-blue-600 text-sm font-medium">
                        {locale === 'zh' ? '查看套餐' : 'View Plan'} <ArrowRight className="w-4 h-4 ml-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Browse by Provider */}
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <Building2 className="w-6 h-6 text-blue-500" />
            <h2 className="text-2xl font-bold">{t('browseByProvider')}</h2>
          </div>

          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-zinc-500">
              {visibleModelCount} {visibleModelCount === 1 ? 'model' : 'models'}
              {normalizedSearchQuery ? ` matched "${deferredSearchQuery}"` : ' available'}
            </p>
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              <span>{locale === 'zh' ? '排序' : 'Sort by'}</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as 'elo' | 'plans' | 'name')}
                className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <option value="elo">{locale === 'zh' ? 'Arena ELO' : 'Arena ELO'}</option>
                <option value="plans">{locale === 'zh' ? '套餐数量' : 'Plan count'}</option>
                <option value="name">{locale === 'zh' ? '名称' : 'Name'}</option>
              </select>
            </label>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredModelsByProvider.map((item) => (
                <Card key={item.provider.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      {getProviderLogoSrc(item.provider) ? (
                        <img
                          src={getProviderLogoSrc(item.provider)!}
                          alt={item.provider.name}
                          className="w-12 h-12 object-contain"
                        />
                      ) : (
                        <span className="text-4xl">{getProviderLogoFallback(item.provider, "🏢")}</span>
                      )}
                      <div>
                        <h3 className="font-bold text-xl">{item.provider.name}</h3>
                        <p className="text-sm text-zinc-500">
                          {item.models.length} {item.models.length === 1 ? 'model' : 'models'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {item.models.slice(0, 3).map((model: any) => (
                        <Link
                          key={model.id}
                          href={`/${locale}/compare/plans/${model.slug}`}
                          className="block p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{model.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {model.planCount || 0} {model.planCount === 1 ? 'plan' : 'plans'}
                            </Badge>
                          </div>
                        </Link>
                      ))}
                      {item.models.length > 3 && (
                        <div className="text-sm text-zinc-500 text-center pt-2">
                          +{item.models.length - 3} more models
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>

          {filteredModelsByProvider.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-zinc-500">
                {locale === 'zh'
                  ? `没有找到与 "${deferredSearchQuery}" 相关的模型`
                  : `No models found for "${deferredSearchQuery}"`}
              </CardContent>
            </Card>
          )}
        </section>

        {/* Browse by Capability */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Zap className="w-6 h-6 text-yellow-500" />
            <h2 className="text-2xl font-bold">{t('browseByCapability')}</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href={`/${locale}/rankings/arena`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl mb-2">🏆</div>
                  <h3 className="font-bold mb-1">{t('arenaRanking')}</h3>
                  <p className="text-sm text-zinc-500">{t('topRated')}</p>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/${locale}/rankings/context`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl mb-2">📏</div>
                  <h3 className="font-bold mb-1">{t('longestContext')}</h3>
                  <p className="text-sm text-zinc-500">{t('bestForDocs')}</p>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/${locale}/rankings/cheapest`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl mb-2">💰</div>
                  <h3 className="font-bold mb-1">{t('cheapestPlans')}</h3>
                  <p className="text-sm text-zinc-500">{t('bestValue')}</p>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/${locale}/rankings/china`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl mb-2">🇨🇳</div>
                  <h3 className="font-bold mb-1">{t('chinaAccessible')}</h3>
                  <p className="text-sm text-zinc-500">{t('noVPN')}</p>
                </CardContent>
              </Card>
            </Link>
          </div>
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
            {locale === 'zh' ? '© 2026 aiplans.dev - 全网 AI 价格对比' : '© 2026 aiplans.dev - Compare AI pricing & save money'}
          </p>
        </div>
      </footer>
    </div>
  );
}
