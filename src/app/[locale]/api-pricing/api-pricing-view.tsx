"use client";

import { useState, useMemo, useDeferredValue } from "react";
import Link from "next/link";
import { useTranslations } from '@/lib/translations';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, BarChart3, BookOpen, Check, ExternalLink, Filter, Search, Globe, MapPin, HelpCircle } from "lucide-react";
import SiteHeader from '@/components/SiteHeader';
import {
  formatPrice,
  calculateSavingsPercent,
} from "@/lib/currency";
import { getProviderLogoFallback, getProviderLogoSrc } from "@/lib/provider-branding";
import type { ChannelPrice, GroupedProduct } from "@/lib/grouped-products";
import type { ApiPricingStats, FaqItem } from "@/lib/api-pricing-copy";
import { modelFreshnessTime } from "@/lib/model-freshness";
import { getProviderVisitRel, getProviderVisitUrl } from "@/lib/provider-links";
import { formatModelName } from '@/lib/model-names';
// Currency-normalised cheapest-channel selection. These are pure, module-scope
// functions (see channel-price-utils.ts) so the React Compiler can preserve the
// memoization of `filteredProducts` below — that memo is what keeps filtering
// 320 models off the keystroke path.
import {
  usd,
  getLowestPriceUSD,
  normalizeChannelType,
} from "@/lib/channel-price-utils";

const INITIAL_VISIBLE_MODELS = 36;
const LOAD_MORE_MODELS = 36;

function ProviderVisitLink({
  provider,
  label,
}: {
  provider: ChannelPrice['providers'];
  label: string;
}) {
  const href = getProviderVisitUrl(provider, 'api');
  if (!href) return <span className="text-zinc-400">-</span>;

  return (
    <Button asChild variant="outline" size="xs">
      <a href={href} target="_blank" rel={getProviderVisitRel(provider, 'api')}>
        {label}
        <ExternalLink />
      </a>
    </Button>
  );
}

/**
 * The interactive half of /api-pricing: search, sort and the four filters.
 *
 * `products` arrives as a prop from the server component rather than from an
 * effect. It used to be `useState([])` + `useEffect(fetch)`, which meant the
 * server rendered `loading=true` and emitted nothing but a spinner — 63
 * characters of HTML on the page CLAUDE.md calls the site's core SEO surface.
 * Filtering stays here and stays client-side, so it is still instant.
 */
export default function ApiPricingView({
  locale,
  products,
  initialQuery,
  stats,
  faqs,
}: {
  locale: string;
  products: GroupedProduct[];
  /** Initial search term, e.g. from ?q=gpt (the WebSite SearchAction target). */
  initialQuery?: string;
  stats: ApiPricingStats;
  faqs: FaqItem[];
}) {
  const t = useTranslations('apiPricing');
  const isZh = locale === "zh";

  // 获取嵌套翻译的辅助函数
  const tChina = () => t('china' as any);
  const tGlobal = () => t('global' as any);

  const [searchQuery, setSearchQuery] = useState(() => initialQuery?.trim() ?? "");
  const [sortBy, setSortBy] = useState<"price" | "name" | "elo" | "latest">("elo");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [regionFilter, setRegionFilter] = useState<"all" | "global" | "china">("all");
  const [channelTypeFilter, setChannelTypeFilter] = useState<"all" | "official" | "cloud" | "aggregator" | "reseller">("all");
  const [chinaAccessOnly, setChinaAccessOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_MODELS);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase();
    const filtered = products.filter(p => {
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

      // Region filter: match if the product's primary producer is in the
      // selected region, OR at least one of its tracked channels is. The
      // producer fallback is important for models like GLM / Kimi where we
      // haven't imported the official CN platform's channel prices yet —
      // Zhipu and Moonshot are CN producers, so their models should still
      // surface under "🇨🇳 China" even if we only track aggregator channels.
      if (regionFilter !== "all") {
        const producerMatch = p.providers?.region === regionFilter;
        const channelMatch = p.versions.some((cp) => cp.providers?.region === regionFilter);
        if (!producerMatch && !channelMatch) return false;
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

      // China-access-only toggle: the product is CN-usable if either its
      // primary producer is China-accessible (e.g. Zhipu, Moonshot, Qwen)
      // or at least one tracked channel is. Producer-side check handles
      // the data gap where official CN platform prices aren't in DB yet.
      if (chinaAccessOnly) {
        const producerAccess =
          p.providers?.access_from_china === true || p.providers?.region === 'china';
        const channelAccess = p.versions.some((cp) => cp.providers?.access_from_china === true);
        if (!producerAccess && !channelAccess) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "price":
          const priceA = getLowestPriceUSD(a);
          const priceB = getLowestPriceUSD(b);
          return sortOrder === "asc"
            ? (priceA || Infinity) - (priceB || Infinity)
            : (priceB || Infinity) - (priceA || Infinity);
        case "name":
          return sortOrder === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        case "elo":
          const eloA = a.benchmark_arena_elo || 0;
          const eloB = b.benchmark_arena_elo || 0;
          return sortOrder === "asc" ? eloA - eloB : eloB - eloA;
        case "latest":
          return sortOrder === "asc"
            ? modelFreshnessTime(a) - modelFreshnessTime(b)
            : modelFreshnessTime(b) - modelFreshnessTime(a);
        default:
          return 0;
      }
    });

    return filtered;
  }, [products, deferredSearchQuery, sortBy, sortOrder, regionFilter, channelTypeFilter, chinaAccessOnly]);

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <SiteHeader locale={locale} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            {t('subtitle')}
          </p>
          <div className="mb-6 flex flex-wrap gap-4 text-sm font-medium">
            <Link href={`/${locale}/guides`} className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
              <BookOpen className="h-4 w-4" />
              {isZh ? '阅读价格指南' : 'Read pricing guides'}
            </Link>
            <Link href={`/${locale}/reports/api-price-index`} className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
              <BarChart3 className="h-4 w-4" />
              {isZh ? '查看 API 价格指数' : 'View the API Price Index'}
            </Link>
          </div>
          {/* Stats strip — real counts from the payload, gives the page
              crawlable, data-specific intro copy. */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { value: stats.modelCount, label: isZh ? "模型" : "models" },
              { value: stats.channelCount, label: isZh ? "API 渠道" : "API channels" },
              { value: stats.providerCount, label: isZh ? "供应商" : "providers" },
              { value: stats.chinaModelCount, label: isZh ? "可中国直连" : "China-reachable" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border bg-white px-4 py-3 dark:bg-zinc-900">
                <div className="text-2xl font-bold">{s.value.toLocaleString()}</div>
                <div className="text-xs text-zinc-500">{s.label}</div>
              </div>
            ))}
          </div>
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
                    const [by, order] = value.split("-") as ["price" | "name" | "elo" | "latest", "asc" | "desc"];
                    setSortBy(by);
                    setSortOrder(order);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('sortBy')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latest-desc">{t('latestFirst')}</SelectItem>
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
                {filteredProducts.slice(0, visibleCount).map((product) => {
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
                  const officialPrices = product.versions.filter(cp => (cp.providers.type === 'official' || cp.providers.type === 'producer') && cp.input_price_per_1m != null);
                  const cheapestOfficial = officialPrices.length > 0
                    ? officialPrices.reduce((min, cp) =>
                        // 折算成 USD 再比大小：官方渠道里同时有 CNY 和 USD 定价，
                        // 直接比原始数字会把国内官方价当成最贵的那个，于是所有
                        // "省 x%" 都是相对错误的基准算出来的。
                        (usd(cp.input_price_per_1m, cp.currency) ?? Infinity) <
                        (usd(min.input_price_per_1m, min.currency) ?? Infinity) ? cp : min
                      )
                    : null;

                  return (
                    <div key={product.id} className="border-b pb-6 last:border-0">
                      {/* 模型名称和基本信息 */}
                      <div className="flex items-start gap-4 mb-4">
                        {getProviderLogoSrc(product.providers) ? (
                          <img
                            src={getProviderLogoSrc(product.providers)!}
                            alt={product.providers?.name || formatModelName(product.name)}
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
                              {formatModelName(product.name)}
                            </Link>
                            {product.benchmark_arena_elo && (
                              <Badge variant="outline" className="ml-2" title="Agent Arena net improvement">
                                Agent {product.benchmark_arena_elo}%
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            {product.providers?.slug ? (
                              <Link href={`/${locale}/plans/${product.providers.slug}`} className="hover:text-blue-600 hover:underline">
                                {product.providers.name}
                              </Link>
                            ) : (
                              product.providers?.name
                            )}
                            {' • '}
                            {product.context_window ? `${product.context_window.toLocaleString()} tokens` : 'N/A'}
                            {(product.released_at || product.created_at) && (
                              <>
                                {' • '}
                                {product.released_at
                                  ? locale === 'zh' ? '发布于' : 'Released'
                                  : locale === 'zh' ? '收录于' : 'Added'}{' '}
                                {new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
                                  dateStyle: 'medium',
                                  timeZone: 'Asia/Singapore',
                                }).format(new Date(product.released_at ?? product.created_at!))}
                              </>
                            )}
                            {' • '}
                            <Link href={`/${locale}/compare/plans/${product.slug}`} className="text-blue-600 hover:underline">
                              {locale === 'zh' ? '对比订阅计划' : 'Compare plans'}
                            </Link>
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
                            <TableHead className="w-24 text-right">{locale === 'zh' ? '访问' : 'Visit'}</TableHead>
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
                              // No raw-number pre-check: calculateSavingsPercent
                              // already converts both sides to USD and returns a
                              // negative number when the channel is dearer, and
                              // every render site gates on `> 0`. The old guard
                              // compared ¥ against $ and so hid the badge on
                              // exactly the CN channels that are cheapest.
                              const savingsChina = cheapestOfficial && cheapestOfficial.input_price_per_1m != null &&
                                  chinaVersion.input_price_per_1m != null
                                ? calculateSavingsPercent(
                                    chinaVersion.input_price_per_1m,
                                    chinaVersion.currency || 'USD',
                                    cheapestOfficial.input_price_per_1m,
                                    cheapestOfficial.currency || 'USD'
                                  )
                                : 0;
                              const savingsGlobal = cheapestOfficial && cheapestOfficial.input_price_per_1m != null &&
                                  globalVersion.input_price_per_1m != null
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
                                  <TableCell className="text-right">
                                    <ProviderVisitLink
                                      provider={chinaVersion.providers}
                                      label={locale === 'zh' ? '访问' : 'Visit'}
                                    />
                                  </TableCell>
                                </TableRow>
                              );
                            }

                            // 标准单行显示（非合并的国内/国际版本）
                            return prices.map((cp, idx) => {
                              const savings = cheapestOfficial && cheapestOfficial.input_price_per_1m != null &&
                                  cp.input_price_per_1m != null
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
                                      {t(`channelTypes.${normalizeChannelType(cp.providers.type)}` as any)}
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
                                      <Badge variant="outline" className="text-xs">{t('officialBaseline')}</Badge>
                                    ) : (
                                      <span className="text-zinc-400">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <ProviderVisitLink
                                      provider={cp.providers}
                                      label={locale === 'zh' ? '访问' : 'Visit'}
                                    />
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
                {visibleCount < filteredProducts.length && (
                  <div className="flex flex-col items-center gap-2 border-t pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setVisibleCount((count) => count + LOAD_MORE_MODELS)}
                    >
                      {isZh ? '加载更多模型' : 'Load more models'}
                    </Button>
                    <p className="text-xs text-zinc-500">
                      {isZh
                        ? `已显示 ${Math.min(visibleCount, filteredProducts.length)} / ${filteredProducts.length}`
                        : `Showing ${Math.min(visibleCount, filteredProducts.length)} of ${filteredProducts.length}`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* FAQ — visible mirror of the FAQPage JSON-LD emitted by the server
            component, built from the same stats/faqs so they never drift. */}
        {faqs.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <HelpCircle className="w-6 h-6 text-blue-600" />
              {isZh ? "常见问题" : "Frequently asked questions"}
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {faqs.map((faq, i) => (
                <Card key={i}>
                  <CardContent className="py-4">
                    <h3 className="font-semibold mb-1">{faq.question}</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {faq.answer}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
