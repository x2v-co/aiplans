"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useTranslations } from '@/lib/translations';
import { useParams } from 'next/navigation';
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

interface GroupedProduct {
  id: number;
  name: string;
  slug: string;
  provider_id: number;
  context_window: number;
  benchmark_mmlu: number;
  benchmark_arena_elo: number;
  providers?: {
    id: number;
    name: string;
    slug: string;
    logo_url: string;
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
  product_id: number;
  channel_id: number;
  input_price_per_1m: number;
  output_price_per_1m: number;
  currency: CurrencyCode;
  price_unit: PriceUnit;
  channels: {
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
    let filtered = products.filter(p => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(query) || p.baseName.toLowerCase().includes(query);
      }
      return true;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "price":
          // 使用最便宜的官方价格比较
          const priceA = getCheapestOfficialPrice(a);
          const priceB = getCheapestOfficialPrice(b);
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
  }, [products, searchQuery, sortBy, sortOrder]);

  function getCheapestOfficialPrice(product: GroupedProduct): number | null {
    const officialPrices = product.versions.filter(cp =>
      cp.channels.type === 'official'
    );
    if (officialPrices.length === 0) return null;
    const prices = officialPrices.map(cp => cp.input_price_per_1m).filter((p): p is number => p != null);
    if (prices.length === 0) return null;
    return Math.min(...prices);
  }

  const clearFilters = () => {
    setSearchQuery("");
  };

  const hasActiveFilters = searchQuery !== "";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // 对价格进行分组（按同一模型的同一版本）
  const pricesByVersion = new Map<string, ChannelPrice[]>();
  products.forEach(p => {
    p.versions.forEach(cp => {
      const key = `${p.baseName}|${cp.channels.name}|${cp.channels.region}`;
      if (!pricesByVersion.has(key)) {
        pricesByVersion.set(key, []);
      }
      pricesByVersion.get(key)!.push(cp);
    });
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 dark:bg-black/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <span className="text-2xl">💰</span>
            <span className="text-xl font-bold">PlanPrice.ai</span>
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  placeholder={t('searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div>
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
                    <SelectItem value="price-asc">{t('priceLowToHigh')}</SelectItem>
                    <SelectItem value="price-desc">{t('priceHighToLow')}</SelectItem>
                    <SelectItem value="name-asc">{t('nameAZ')}</SelectItem>
                    <SelectItem value="name-desc">{t('nameZA')}</SelectItem>
                    <SelectItem value="elo-desc">{t('performanceHighToLow')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                    const key = cp.channels.name;
                    if (!versionsByChannel.has(key)) {
                      versionsByChannel.set(key, []);
                    }
                    versionsByChannel.get(key)!.push(cp);
                  });

                  // 获取最便宜的官方价格（用于计算节省）
                  const officialPrices = product.versions.filter(cp => cp.channels.type === 'official' && cp.input_price_per_1m != null);
                  const cheapestOfficial = officialPrices.length > 0
                    ? officialPrices.reduce((min, cp) =>
                        (cp.input_price_per_1m || Infinity) < (min.input_price_per_1m || Infinity) ? cp : min
                      )
                    : null;

                  return (
                    <div key={product.id} className="border-b pb-6 last:border-0">
                      {/* 模型名称和基本信息 */}
                      <div className="flex items-start gap-4 mb-4">
                        {product.providers?.logo_url && (
                          <img
                            src={product.providers.logo_url}
                            alt={product.providers.name}
                            className="w-12 h-12 rounded-lg flex-shrink-0"
                          />
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
                            const chinaVersion = prices.find(cp => cp.channels.region === 'china');
                            const globalVersion = prices.find(cp => cp.channels.region === 'global');
                            const isOfficial = prices.some(cp => cp.channels.type === 'official');

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
                                          {chinaVersion.channels.access_from_china && (
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
                                        {cp.channels.name}
                                      </span>
                                      {cp.channels.access_from_china && (
                                        <Check className="w-3 h-3 text-green-600" />
                                      )}
                                      {cp.channels.region === 'china' && (
                                        <Badge className="ml-2 text-xs" variant="outline">
                                          🇨🇳
                                        </Badge>
                                      )}
                                      {cp.channels.region === 'global' && (
                                        <Badge className="ml-2 text-xs" variant="outline">
                                          🌍
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline">
                                      {t(`channelTypes.${cp.channels.type}` as any)}
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
            <span className="font-medium">PlanPrice.ai</span>
          </div>
          <p className="text-sm text-zinc-500">
            {t('pricesUpdated', { date: new Date().toLocaleDateString() })}
          </p>
        </div>
      </footer>
    </div>
  );
}
