'use client';

import { useDeferredValue, useRef, useState } from 'react';
import Link from "next/link";
import { useTranslations } from '@/lib/translations';
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp, Building2, Zap, ArrowRight } from "lucide-react";
import SiteHeader from '@/components/SiteHeader';
import { getProviderLogoFallback, getProviderLogoSrc } from "@/lib/provider-branding";
import { formatPrice, type CurrencyCode } from "@/lib/currency";
import { matchesSearch } from "@/lib/search-match";
import type { ComparePlansIndexData, ProviderModelGroup } from "@/lib/compare-plans-index";
import { formatModelName } from '@/lib/model-names';

/**
 * The interactive half of /compare/plans: the search box and the sort control.
 *
 * The lists themselves arrive as props from the server component. They used to
 * be assembled in an effect from three API calls, which left the served HTML
 * with no model names, no plan prices and no links into
 * /compare/plans/[model] — the very pages the sitemap advertises.
 */
export default function ComparePlansIndexView({
  locale,
  data,
}: {
  locale: string;
  data: ComparePlansIndexData;
}) {
  const { hotModels: hotModelsList, featuredPlans, modelsByProvider } = data;

  const t = useTranslations('compare');
  const tCommon = useTranslations('common');

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'elo' | 'plans' | 'name' | 'context'>('elo');
  // "国内可用" capability card: narrow the grid to China-region producers,
  // whose subscription plans are buyable without a VPN.
  const [chinaOnly, setChinaOnly] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const resultsRef = useRef<HTMLElement>(null);
  const featuredRef = useRef<HTMLElement>(null);

  // The capability cards stay on this page: they re-sort/filter the plan
  // comparison grid instead of sending users to /api-pricing, which is
  // pay-per-token pricing — a different product from subscription plans.
  const applyCapability = (options: {
    sort?: 'elo' | 'context';
    china?: boolean;
    target: 'results' | 'featured';
  }) => {
    setSearchQuery('');
    if (options.china !== undefined) setChinaOnly(options.china);
    if (options.sort) setSortBy(options.sort);
    const targetRef = options.target === 'featured' ? featuredRef : resultsRef;
    // The hot/featured sections unmount while searching, so wait for the
    // cleared-search render before scrolling.
    setTimeout(() => {
      targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase();
  const isSearching = normalizedSearchQuery.length > 0;

  const filteredModelsByProvider = modelsByProvider
    .map((item: any) => {
      const filteredModels = item.models
        .filter((model: any) => {
          if (chinaOnly && model.providers?.region !== 'china') return false;
          if (!normalizedSearchQuery) return true;

          // Shared fuzzy matcher: punctuation-insensitive plus brand aliases,
          // so "chatgpt" surfaces OpenAI GPT models and "智谱" surfaces GLM.
          return matchesSearch(deferredSearchQuery, [
            model.name,
            model.slug,
            model.providers?.name,
            item.provider?.name,
            item.provider?.slug,
          ]);
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
          if (sortBy === 'context') {
            const ctxDiff = (b.context_window || 0) - (a.context_window || 0);
            if (ctxDiff !== 0) return ctxDiff;
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
        if (sortBy === 'plans') return topModel.planCount || 0;
        if (sortBy === 'context') return topModel.context_window || 0;
        return topModel.benchmark_arena_elo || 0;
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
      <SiteHeader locale={locale} />

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
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  // Results render straight under the hero while searching;
                  // this only matters on short viewports where the section
                  // still starts below the fold.
                  resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            />
          </div>
        </div>

        {/* While searching, hot/featured collections hide so matches show
            immediately under the search box instead of below two card
            grids. */}
        {!isSearching && (
        <>
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
                          <h3 className="font-bold text-lg leading-tight">{formatModelName(model.name)}</h3>
                          <p className="text-sm text-zinc-500">{model.providers?.name}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      {model.benchmark_arena_elo && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-500">Agent Arena</span>
                          <Badge variant="secondary">{model.benchmark_arena_elo.toFixed(2)}%</Badge>
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

        {/* Featured Plans — the payload builder sorts subscription plans by
            USD-normalised price ascending, so this list is the site's
            "cheapest plans" view. */}
        <section ref={featuredRef} className="mb-16 scroll-mt-20">
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
                          {/* The API returns each plan's own currency, and this
                              card used to print "$" over all of them -- GLM
                              Coding Lite is ¥118/month, which rendered as $118
                              and overstated it sevenfold. is_contact_sales is
                              checked first because those rows store price=0 to
                              mean "no public price", not "free". */}
                          {plan.is_contact_sales
                            ? (locale === 'zh' ? '按需报价' : 'Custom')
                            : plan.price === 0
                              ? (locale === 'zh' ? '免费' : 'Free')
                              : formatPrice(plan.price ?? 0, (plan.currency as CurrencyCode) || 'USD', locale)}
                        </div>
                        <div className="text-sm text-zinc-500">
                          {plan.is_contact_sales
                            ? (locale === 'zh' ? '联系销售' : 'Contact sales')
                            : plan.price === 0
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
                            {formatModelName(model.name)}
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
        </>
        )}

        {/* Browse by Provider / search results */}
        <section ref={resultsRef} className="mb-16 scroll-mt-20">
          <div className="flex items-center gap-2 mb-6">
            <Building2 className="w-6 h-6 text-blue-500" />
            <h2 className="text-2xl font-bold">
              {isSearching
                ? (locale === 'zh' ? `🔍 搜索结果` : `🔍 Search results`)
                : t('browseByProvider')}
            </h2>
          </div>

          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-zinc-500">
                {locale === 'zh'
                  ? (isSearching
                      ? `${visibleModelCount} 个模型与“${deferredSearchQuery}”相关`
                      : `共 ${visibleModelCount} 个模型`)
                  : (isSearching
                      ? `${visibleModelCount} ${visibleModelCount === 1 ? 'model' : 'models'} matched "${deferredSearchQuery}"`
                      : `${visibleModelCount} ${visibleModelCount === 1 ? 'model' : 'models'} available`)}
              </p>
              {chinaOnly && !isSearching && (
                <button
                  type="button"
                  onClick={() => setChinaOnly(false)}
                  className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100"
                >
                  🇨🇳 {locale === 'zh' ? '仅国内模型' : 'China models only'} ✕
                </button>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              <span>{locale === 'zh' ? '排序' : 'Sort by'}</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as 'elo' | 'plans' | 'name' | 'context')}
                className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <option value="elo">Arena ELO</option>
                <option value="context">{locale === 'zh' ? '上下文长度' : 'Context length'}</option>
                <option value="plans">{locale === 'zh' ? '套餐数量' : 'Plan count'}</option>
                <option value="name">{locale === 'zh' ? '名称' : 'Name'}</option>
              </select>
            </label>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredModelsByProvider.map((item) => (
              <ProviderGroupCard key={item.provider.id} locale={locale} group={item} />
            ))}
          </div>

          {filteredModelsByProvider.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-zinc-500">
                {locale === 'zh'
                  ? (isSearching
                      ? `没有找到与 "${deferredSearchQuery}" 相关的模型`
                      : chinaOnly
                        ? '暂未收录国内模型的套餐对比'
                        : '暂无模型')
                  : (isSearching
                      ? `No models found for "${deferredSearchQuery}"`
                      : chinaOnly
                        ? 'No China-region model comparisons indexed yet'
                        : 'No models available')}
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
            <CapabilityCard
              icon="🏆"
              title={t('arenaRanking')}
              description={t('topRated')}
              active={!chinaOnly && sortBy === 'elo'}
              onClick={() => applyCapability({ sort: 'elo', china: false, target: 'results' })}
            />
            <CapabilityCard
              icon="📏"
              title={t('longestContext')}
              description={t('bestForDocs')}
              active={!chinaOnly && sortBy === 'context'}
              onClick={() => applyCapability({ sort: 'context', china: false, target: 'results' })}
            />
            <CapabilityCard
              icon="💰"
              title={t('cheapestPlans')}
              description={t('bestValue')}
              onClick={() => applyCapability({ target: 'featured' })}
            />
            <CapabilityCard
              icon="🇨🇳"
              title={t('chinaAccessible')}
              description={t('noVPN')}
              active={chinaOnly}
              onClick={() => applyCapability({ sort: 'elo', china: true, target: 'results' })}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

/**
 * One tile in the "browse by capability" grid. These are in-page controls
 * (sort/filter/scroll), not links: this is the subscription-plans page, so a
 * tile that promised "cheapest plans" and landed on pay-per-token API
 * pricing was a category error.
 */
function CapabilityCard({
  icon,
  title,
  description,
  active = false,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="w-full text-left focus:outline-none">
      <Card
        className={`h-full cursor-pointer transition-shadow hover:shadow-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
          active ? 'border-blue-400 ring-2 ring-blue-500' : ''
        }`}
      >
        <CardContent className="p-6 text-center">
          <div className="text-3xl mb-2">{icon}</div>
          <h3 className="font-bold mb-1">{title}</h3>
          <p className="text-sm text-zinc-500">{description}</p>
        </CardContent>
      </Card>
    </button>
  );
}

/**
 * One provider tile in the browse-by-provider grid. The "+N more models"
 * row used to be plain text, so a provider with more than three models
 * offered no way to reach the rest from this page.
 */
function ProviderGroupCard({ locale, group }: { locale: string; group: ProviderModelGroup }) {
  const isZh = locale === 'zh';
  const [expanded, setExpanded] = useState(false);
  const visibleModels = expanded ? group.models : group.models.slice(0, 3);
  const hiddenCount = group.models.length - 3;

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          {getProviderLogoSrc(group.provider) ? (
            <img
              src={getProviderLogoSrc(group.provider)!}
              alt={group.provider.name}
              className="w-12 h-12 object-contain"
            />
          ) : (
            <span className="text-4xl">{getProviderLogoFallback(group.provider, "🏢")}</span>
          )}
          <div>
            <h3 className="font-bold text-xl">{group.provider.name}</h3>
            <p className="text-sm text-zinc-500">
              {group.models.length} {group.models.length === 1
                ? (isZh ? '个模型' : 'model')
                : (isZh ? '个模型' : 'models')}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {visibleModels.map((model: any) => (
            <Link
              key={model.id}
              href={`/${locale}/compare/plans/${model.slug}`}
              className="block p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{formatModelName(model.name)}</span>
                <Badge variant="secondary" className="text-xs">
                  {model.planCount || 0} {model.planCount === 1
                    ? (isZh ? '个套餐' : 'plan')
                    : (isZh ? '个套餐' : 'plans')}
                </Badge>
              </div>
            </Link>
          ))}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              className="w-full pt-2 text-center text-sm font-medium text-blue-600 hover:underline"
            >
              {expanded
                ? (isZh ? '收起' : 'Show less')
                : (isZh ? `展开其余 ${hiddenCount} 个模型` : `+${hiddenCount} more models`)}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
