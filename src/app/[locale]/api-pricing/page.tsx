"use client";

import { useState, useEffect, useMemo, useDeferredValue } from "react";
import Link from "next/link";
import { useTranslations } from '@/lib/translations';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Check, Filter, Search, Globe, MapPin } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  formatPrice,
  formatPriceSimple,
  calculateSavingsPercent,
  type CurrencyCode,
  type PriceUnit,
} from "@/lib/currency";
import { convertToUSD } from "@/lib/currency-conversion";
import { getProviderLogoFallback, getProviderLogoSrc } from "@/lib/provider-branding";

interface GroupedProduct {
  id: number;
  name: string;
  slug: string;
  provider_ids: number[];
  context_window: number;
  benchmark_arena_elo: number | null;
  providers?: {
    id: number;
    name: string;
    slug: string;
    logo: string;
    logo_url?: string;
    region?: string;
  };
  baseName: string;
  versions: ChannelPrice[];
  hasChinaVersion: boolean;
  hasGlobalVersion: boolean;
  cheapestChina?: ChannelPrice;
  cheapestGlobal?: ChannelPrice;
  versionCounts: number;
}

interface ChannelPrice {
  id: number;
  model_id: number;
  provider_id: number;
  input_price_per_1m: number;
  output_price_per_1m: number;
  currency: CurrencyCode;
  price_unit: PriceUnit;
  providers: {
    id: number;
    name: string;
    slug: string;
    type: string;
    region: string;
    access_from_china: boolean;
  };
}

export default function ApiPricingPage() {
  const t = useTranslations('apiPricing');
  const tNav = useTranslations('nav');
  const params = useParams();
  const locale = params.locale as string;

  // 获取嵌套翻译的辅助函数
  const tChina = () => t('china' as any);
  const tGlobal = () => t('global' as any);

  const [products, setProducts] = useState<GroupedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"price" | "name" | "elo">("elo");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [regionFilter, setRegionFilter] = useState<"all" | "global" | "china">("all");
  const [channelTypeFilter, setChannelTypeFilter] = useState<"all" | "official" | "cloud" | "aggregator" | "reseller">("all");
  const [chinaAccessOnly, setChinaAccessOnly] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/products/grouped?type=llm");
        const data = await res.json();
        setProducts(data);
      } catch (error) {
        console.error("Error fetching grouped data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase();
    let filtered = products.filter(p => {
      // Search across model name + all channel provider names
      if (normalizedQuery) {
        const searchValues = [
          p.name,
          p.slug,
          p.baseName,
          p.providers?.name,
          ...p.versions.flatMap((cp) => [cp.providers?.name, cp.providers?.slug]),
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());

        if (!searchValues.some((value) => value.includes(normalizedQuery))) return false;
      }

      // Region filter: keep the product only if at least one of its channels
      // is in the selected region (so "China" shows models that have at
      // least one China-accessible channel, etc.)
      if (regionFilter !== "all") {
        const hasRegion = p.versions.some((cp) => cp.providers?.region === regionFilter);
        if (!hasRegion) return false;
      }

      // Channel type filter: keep if any channel matches the selected type.
      // "official" also matches "producer" for backward-compat with older rows.
      if (channelTypeFilter !== "all") {
        const hasType = p.versions.some((cp) => {
          const t = cp.providers?.type;
          if (channelTypeFilter === "official") return t === "official" || t === "producer";
          return t === channelTypeFilter;
        });
        if (!hasType) return false;
      }

      // China-access-only toggle: only models with at least one
      // China-accessible channel
      if (chinaAccessOnly) {
        const hasChinaAccess = p.versions.some((cp) => cp.providers?.access_from_china === true);
        if (!hasChinaAccess) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "price":
          const priceA = getLowestDisplayedPrice(a);
          const priceB = getLowestDisplayedPrice(b);
          return sortOrder === "asc"
            ? (priceA || Infinity) - (priceB || Infinity)
            : (priceB || Infinity) - (priceA || Infinity);
        case "name":
          return sortOrder === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        case "elo":
          const eloA = a.benchmark_arena_elo || 0;
          const eloB = b.benchmark_arena_elo || 0;
          return sortOrder === "asc" ? eloA - eloB : eloB - eloA;
        default:
          return 0;
      }
    });

    return filtered;
  }, [products, deferredSearchQuery, sortBy, sortOrder, regionFilter, channelTypeFilter, chinaAccessOnly]);

  function getCheapestOfficialPrice(product: GroupedProduct): number | null {
    const officialPrices = product.versions.filter(cp =>
      cp.providers.type === 'official' || cp.providers.type === 'producer'
    );
    if (officialPrices.length === 0) return null;
    const prices = officialPrices.map(cp => cp.input_price_per_1m).filter((p): p is number => p != null);
    if (prices.length === 0) return null;
    return Math.min(...prices);
  }

  function getLowestDisplayedPrice(product: GroupedProduct): number | null {
    const prices = product.versions
      .map((cp) => cp.input_price_per_1m)
      .filter((price): price is number => price != null);

    if (prices.length === 0) return getCheapestOfficialPrice(product);
    return Math.min(...prices);
  }

  const clearFilters = () => {
    setSearchQuery("");
    setRegionFilter("all");
    setChannelTypeFilter("all");
    setChinaAccessOnly(false);
  };

  const hasActiveFilters =
    searchQuery !== "" ||
    regionFilter !== "all" ||
    channelTypeFilter !== "all" ||
    chinaAccessOnly;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
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
            <Link href={`/${locale}/compare/plans`} className="text-sm font-medium hover:text-blue-600">
              {tNav('comparePlans')}
            </Link>
            <Link href={`/${locale}/api-pricing`} className="text-sm font-medium text-blue-600">
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

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            {t('subtitle')}
          </p>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4" />
              <span className="font-medium">{t('filters')}</span>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto text-xs h-7">
                  {t('clearAll')}
                </Button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  placeholder={t('searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div>
                <Select value={regionFilter} onValueChange={(v) => setRegionFilter(v as typeof regionFilter)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('region')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allRegions')}</SelectItem>
                    <SelectItem value="global">{t('global')}</SelectItem>
                    <SelectItem value="china">{t('china')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={channelTypeFilter} onValueChange={(v) => setChannelTypeFilter(v as typeof channelTypeFilter)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('channelType')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allTypes')}</SelectItem>
                    <SelectItem value="official">{t('channelTypes.official' as any)}</SelectItem>
                    <SelectItem value="cloud">{t('channelTypes.cloud' as any)}</SelectItem>
                    <SelectItem value="aggregator">{t('channelTypes.aggregator' as any)}</SelectItem>
                    <SelectItem value="reseller">{t('channelTypes.reseller' as any)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="lg:col-span-2">
                <Select
                  value={`${sortBy}-${sortOrder}`}
                  onValueChange={(value) => {
                    const [by, order] = value.split("-") as ["price" | "name" | "elo", "asc" | "desc"];
                    setSortBy(by);
                    setSortOrder(order);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('sortBy')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="elo-desc">{t('performanceHighToLow')}</SelectItem>
                    <SelectItem value="elo-asc">{locale === 'zh' ? '⭐ 性能从低到高' : '⭐ Performance (Low to High)'}</SelectItem>
                    <SelectItem value="price-asc">{t('priceLowToHigh')}</SelectItem>
                    <SelectItem value="price-desc">{t('priceHighToLow')}</SelectItem>
                    <SelectItem value="name-asc">{t('nameAZ')}</SelectItem>
                    <SelectItem value="name-desc">{t('nameZA')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="lg:col-span-2 flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={chinaAccessOnly}
                    onChange={(e) => setChinaAccessOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                  />
                  <MapPin className="w-4 h-4 text-zinc-400" />
                  {t('chinaAccessOnly')}
                </label>
              </div>
            </div>
            <div className="mt-4 text-sm text-zinc-500">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'model' : 'models'}
              {deferredSearchQuery.trim() ? ` matched "${deferredSearchQuery}"` : ''}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('modelChannelPrices')}</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                {t('noResults')}
              </div>
            ) : (
              <div className="space-y-6">
                {filteredProducts.map((product) => {
                  // 按渠道名称分组版本
                  const versionsByChannel = new Map<string, ChannelPrice[]>();
                  product.versions.forEach(cp => {
                    const key = cp.providers.name;
                    if (!versionsByChannel.has(key)) {
                      versionsByChannel.set(key, []);
                    }
                    versionsByChannel.get(key)!.push(cp);
                  });

                  // 获取最便宜的官方价格（用于计算节省）
                  const officialPrices = product.versions.filter(cp => (cp.providers.type === 'official' || cp.providers.type === 'producer' || cp.providers.type === 'producer') && cp.input_price_per_1m != null);
                  const cheapestOfficial = officialPrices.length > 0
                    ? officialPrices.reduce((min, cp) =>
                        (cp.input_price_per_1m || Infinity) < (min.input_price_per_1m || Infinity) ? cp : min
                      )
                    : null;

                  return (
                    <div key={product.id} className="border-b pb-6 last:border-0">
                      {/* 模型名称和基本信息 */}
                      <div className="flex items-start gap-4 mb-4">
                        {getProviderLogoSrc(product.providers) ? (
                          <img
                            src={getProviderLogoSrc(product.providers)!}
                            alt={product.providers?.name || product.name}
                            className="w-12 h-12 rounded-lg flex-shrink-0"
                          />
                        ) : (
                          <span className="text-4xl flex-shrink-0">{getProviderLogoFallback(product.providers, "🤖")}</span>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Link
                              href={`/${locale}/models/${product.slug}`}
                              className="text-xl font-bold hover:text-blue-600"
                            >
                              {product.name}
                            </Link>
                            {product.benchmark_arena_elo && (
                              <Badge variant="outline" className="ml-2">
                                ⭐ {product.benchmark_arena_elo}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            {product.providers?.name} • {product.context_window ? product.context_window.toLocaleString() : 'N/A'} tokens
                          </p>
                        </div>
                      </div>

                      {/* 国内版和国际版价格表格 */}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('channel')}</TableHead>
                            <TableHead className="text-center w-20">{t('region')}</TableHead>
                            <TableHead className="text-right">{t('inputPer1M')}</TableHead>
                            <TableHead className="text-right">{t('outputPer1M')}</TableHead>
                            <TableHead className="text-right">{t('savings')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Array.from(versionsByChannel.entries()).map(([channelName, prices]) => {
                            // 按国内/国际版本分组
                            const chinaVersion = prices.find(cp => cp.providers.region === 'china');
                            const globalVersion = prices.find(cp => cp.providers.region === 'global');
                            const isOfficial = prices.some(cp => cp.providers.type === 'official' || cp.providers.type === 'producer' || cp.providers.type === 'producer');

                            // 如果是官方渠道且同时有国内和国际版本，合并显示
                            if (isOfficial && chinaVersion && globalVersion) {
                              const savingsChina = cheapestOfficial && cheapestOfficial.input_price_per_1m != null &&
                                  chinaVersion.input_price_per_1m != null &&
                                  chinaVersion.input_price_per_1m < cheapestOfficial.input_price_per_1m
                                ? calculateSavingsPercent(
                                    chinaVersion.input_price_per_1m,
                                    chinaVersion.currency || 'USD',
                                    cheapestOfficial.input_price_per_1m,
                                    cheapestOfficial.currency || 'USD'
                                  )
                                : 0;
                              const savingsGlobal = cheapestOfficial && cheapestOfficial.input_price_per_1m != null &&
                                  globalVersion.input_price_per_1m != null &&
                                  globalVersion.input_price_per_1m < cheapestOfficial.input_price_per_1m
                                ? calculateSavingsPercent(
                                    globalVersion.input_price_per_1m,
                                    globalVersion.currency || 'USD',
                                    cheapestOfficial.input_price_per_1m,
                                    cheapestOfficial.currency || 'USD'
                                  )
                                : 0;

                              return (
                                <TableRow key={channelName}>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className="flex flex-col gap-1">
                                        {/* 国内版 */}
                                        <div key="china-version" className="flex items-center gap-2">
                                          <MapPin className="w-3 h-3 text-zinc-400" />
                                          <span className="text-sm font-medium">
                                            {channelName} {tChina()}
                                          </span>
                                          {chinaVersion.providers.access_from_china && (
                                            <Check className="w-3 h-3 text-green-600" />
                                          )}
                                        </div>
                                        {/* 国际版 */}
                                        <div key="global-version" className="flex items-center gap-2">
                                          <Globe className="w-3 h-3 text-zinc-400" />
                                          <span className="text-sm font-medium">
                                            {channelName} {tGlobal()}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline">
                                      {t('channelTypes.official')}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-1">
                                      {/* 国内版价格 */}
                                      <div key="china-input-price" className="flex items-center gap-2">
                                        <span className="text-zinc-500">{t('china')}:</span>
                                        <span className="font-mono text-sm">
                                          {formatPrice(chinaVersion.input_price_per_1m, chinaVersion.currency || 'USD', locale)}
                                        </span>
                                      </div>
                                      {/* 国际版价格 */}
                                      <div key="global-input-price" className="flex items-center gap-2">
                                        <span className="text-zinc-500">{t('global')}:</span>
                                        <span className="font-mono text-sm">
                                          {formatPrice(globalVersion.input_price_per_1m, globalVersion.currency || 'USD', locale)}
                                        </span>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-1">
                                      {/* 国内版价格 */}
                                      <div key="china-output-price" className="flex items-center gap-2">
                                        <span className="text-zinc-500">{t('china')}:</span>
                                        <span className="font-mono text-sm">
                                          {formatPrice(chinaVersion.output_price_per_1m, chinaVersion.currency || 'USD', locale)}
                                        </span>
                                      </div>
                                      {/* 国际版价格 */}
                                      <div key="global-output-price" className="flex items-center gap-2">
                                        <span className="text-zinc-500">{t('global')}:</span>
                                        <span className="font-mono text-sm">
                                          {formatPrice(globalVersion.output_price_per_1m, globalVersion.currency || 'USD', locale)}
                                        </span>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex flex-col gap-1">
                                      {/* 国内版节省 */}
                                      <div key="china-savings" className="flex items-center gap-2">
                                        <span className="text-zinc-500">{t('china')}:</span>
                                        {savingsChina > 0 ? (
                                          <span className="text-green-600 font-medium text-sm">-{savingsChina}%</span>
                                        ) : (
                                          <span className="text-zinc-400 text-sm">-</span>
                                        )}
                                      </div>
                                      {/* 国际版节省 */}
                                      <div key="global-savings" className="flex items-center gap-2">
                                        <span className="text-zinc-500">{t('global')}:</span>
                                        {savingsGlobal > 0 ? (
                                          <span className="text-green-600 font-medium text-sm">-{savingsGlobal}%</span>
                                        ) : (
                                          <span className="text-zinc-400 text-sm">-</span>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            }

                            // 标准单行显示（非合并的国内/国际版本）
                            return prices.map((cp, idx) => {
                              const savings = cheapestOfficial && cheapestOfficial.input_price_per_1m != null &&
                                  cp.input_price_per_1m != null &&
                                  cp.input_price_per_1m < cheapestOfficial.input_price_per_1m
                                ? calculateSavingsPercent(
                                    cp.input_price_per_1m,
                                    cp.currency || 'USD',
                                    cheapestOfficial.input_price_per_1m,
                                    cheapestOfficial.currency || 'USD'
                                  )
                                : 0;

                              return (
                                <TableRow key={`${cp.id}-${idx}`}>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <span className={cp === cheapestOfficial ? "font-medium" : ""}>
                                        {cp.providers.name}
                                      </span>
                                      {cp.providers.access_from_china && (
                                        <Check className="w-3 h-3 text-green-600" />
                                      )}
                                      {cp.providers.region === 'china' && (
                                        <Badge className="ml-2 text-xs" variant="outline">
                                          🇨🇳
                                        </Badge>
                                      )}
                                      {cp.providers.region === 'global' && (
                                        <Badge className="ml-2 text-xs" variant="outline">
                                          🌍
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline">
                                      {t(`channelTypes.${cp.providers.type}` as any)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {formatPrice(cp.input_price_per_1m, cp.currency || 'USD', locale)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {formatPrice(cp.output_price_per_1m, cp.currency || 'USD', locale)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {savings > 0 ? (
                                      <span className="text-green-600 font-medium">-{savings}%</span>
                                    ) : cp === cheapestOfficial ? (
                                      <Badge className="bg-green-600 text-xs">{t('cheapest')}</Badge>
                                    ) : (
                                      <span className="text-zinc-400">-</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            });
                          })}
                        </TableBody>
                      </Table>

                      {/* 详情按钮 */}
                      <div className="mt-4 flex justify-end">
                        <Link href={`/${locale}/models/${product.slug}`}>
                          <Button variant="ghost" size="sm" className="gap-1">
                            {t('details')} <ArrowRight className="w-3 h-3" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="border-t py-8 mt-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">💰</span>
            <span className="font-medium">aiplans.dev</span>
          </div>
          <p className="text-sm text-zinc-500">
            {t('pricesUpdated', { date: new Date().toLocaleDateString() })}
          </p>
        </div>
      </footer>
    </div>
  );
}
