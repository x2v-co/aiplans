'use client';

import { use, useEffect, useState } from 'react';
import Link from "next/link";
import { useTranslations } from '@/lib/translations';
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp, Building2, Zap, ArrowRight } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// Hot models for quick access
const hotModels = [
  "gpt-4o",
  "claude-3-5-sonnet",
  "deepseek-v3",
  "gemini-1-5-pro",
  "claude-3-opus",
  "gpt-4o-mini",
  "llama-3-1-405b",
  "qwen-max",
];

export default function ComparePlansIndexPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(props.params);
  const t = useTranslations('compare');
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');

  const [hotModelsList, setHotModelsList] = useState<any[]>([]);
  const [modelsByProvider, setModelsByProvider] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

        // 2. Load providers
        const providersResponse = await fetch('/api/providers');
        const providersData = await providersResponse.json();

        // 3. Load models grouped by provider
        const grouped = await Promise.all(
          providersData.map(async (provider: any) => {
            const modelsResponse = await fetch(`/api/products?provider_id=${provider.id}&include_plan_count=true&type=llm`);
            const models = await modelsResponse.json();
            return {
              provider,
              models: models.filter((m: any) => m.planCount > 0), // Only show models with plans
            };
          })
        );

        setModelsByProvider(grouped.filter((item: any) => item.models.length > 0));
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 dark:bg-black/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <span className="text-2xl">💰</span>
            <span className="text-xl font-bold">aiplans.ai</span>
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
                        {model.providers?.logo_url ? (
                          <img
                            src={model.providers.logo_url}
                            alt={model.providers.name}
                            className="w-8 h-8 object-contain"
                          />
                        ) : (
                          <span className="text-3xl">🤖</span>
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

        {/* Browse by Provider */}
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <Building2 className="w-6 h-6 text-blue-500" />
            <h2 className="text-2xl font-bold">{t('browseByProvider')}</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modelsByProvider
              .filter((p) => p.models.length > 0)
              .map((item) => (
                <Card key={item.provider.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      {item.provider.logo_url ? (
                        <img
                          src={item.provider.logo_url}
                          alt={item.provider.name}
                          className="w-12 h-12 object-contain"
                        />
                      ) : (
                        <span className="text-4xl">🏢</span>
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
            <span className="font-medium">aiplans.ai</span>
          </div>
          <p className="text-sm text-zinc-500">
            {locale === 'zh' ? '© 2026 aiplans.ai - 全网 AI 价格对比' : '© 2026 aiplans.ai - Compare AI pricing & save money'}
          </p>
        </div>
      </footer>
    </div>
  );
}
