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
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Check, Filter, X, Search } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface Product {
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
  };
}

interface ChannelPrice {
  id: number;
  product_id: number;
  channel_id: number;
  input_price_per_1m: number;
  output_price_per_1m: number;
  channels: {
    id: number;
    name: string;
    type: string;
    region: string;
    access_from_china: boolean;
    provider_id?: number;
    providers?: {
      logo_url: string;
    };
  };
  products: {
    id: number;
    name: string;
    slug: string;
    providers?: {
      id: number;
      name: string;
      logo_url: string;
    };
  };
}

export default function ApiPricingPage() {
  const t = useTranslations('apiPricing');
  const tNav = useTranslations('nav');
  const params = useParams();
  const locale = params.locale as string;

  const [products, setProducts] = useState<Product[]>([]);
  const [channelPrices, setChannelPrices] = useState<ChannelPrice[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [selectedChannelTypes, setSelectedChannelTypes] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [showChinaOnly, setShowChinaOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"price" | "name" | "elo">("price");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    async function fetchData() {
      try {
        const [productsRes, pricesRes] = await Promise.all([
          fetch("/api/products?type=llm"),
          fetch("/api/channels/1"),
        ]);

        const productsData = await productsRes.json();
        setProducts(productsData);

        // Fetch channel prices for each product
        const pricesPromises = productsData.map((p: Product) =>
          fetch(`/api/channels/${p.id}`).then(res => res.json())
        );
        const allPrices = await Promise.all(pricesPromises);
        setChannelPrices(allPrices.flat());
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Get unique providers from products
  const providers = useMemo(() => {
    const unique = new Map<number, { name: string; logo: string }>();
    products.forEach(p => {
      if (p.providers && !unique.has(p.provider_id)) {
        unique.set(p.provider_id, {
          name: p.providers.name,
          logo: p.providers.logo_url
        });
      }
    });
    return Array.from(unique.entries()).map(([id, data]) => ({ id, ...data }));
  }, [products]);

  // Get unique channel types
  const channelTypes = useMemo(() => {
    const types = new Set(channelPrices.map(cp => cp.channels.type));
    return Array.from(types);
  }, [channelPrices]);

  // Get unique regions
  const regions = useMemo(() => {
    const r = new Set(channelPrices.map(cp => cp.channels.region).filter(Boolean));
    return Array.from(r);
  }, [channelPrices]);

  // Filtered and sorted prices
  const filteredPrices = useMemo(() => {
    let filtered = channelPrices.filter(cp => {
      const product = products.find(p => p.id === cp.product_id);
      if (!product) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchProduct = product.name.toLowerCase().includes(query);
        const matchChannel = cp.channels.name.toLowerCase().includes(query);
        if (!matchProduct && !matchChannel) return false;
      }

      // Provider filter
      if (selectedProviders.length > 0 && product.provider_id) {
        if (!selectedProviders.includes(product.provider_id.toString())) return false;
      }

      // Channel type filter
      if (selectedChannelTypes.length > 0) {
        if (!selectedChannelTypes.includes(cp.channels.type)) return false;
      }

      // Region filter
      if (selectedRegions.length > 0 && cp.channels.region) {
        if (!selectedRegions.includes(cp.channels.region)) return false;
      }

      // China only filter
      if (showChinaOnly && !cp.channels.access_from_china) return false;

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "price":
          return sortOrder === "asc"
            ? (a.input_price_per_1m || 0) - (b.input_price_per_1m || 0)
            : (b.input_price_per_1m || 0) - (a.input_price_per_1m || 0);
        case "name":
          const nameA = products.find(p => p.id === a.product_id)?.name || "";
          const nameB = products.find(p => p.id === b.product_id)?.name || "";
          return sortOrder === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        case "elo":
          const eloA = products.find(p => p.id === a.product_id)?.benchmark_arena_elo || 0;
          const eloB = products.find(p => p.id === b.product_id)?.benchmark_arena_elo || 0;
          return sortOrder === "asc" ? eloA - eloB : eloB - eloA;
        default:
          return 0;
      }
    });

    return filtered;
  }, [channelPrices, products, searchQuery, selectedProviders, selectedChannelTypes, selectedRegions, showChinaOnly, sortBy, sortOrder]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedProviders([]);
    setSelectedChannelTypes([]);
    setSelectedRegions([]);
    setShowChinaOnly(false);
  };

  const hasActiveFilters = searchQuery || selectedProviders.length > 0 || selectedChannelTypes.length > 0 || selectedRegions.length > 0 || showChinaOnly;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Group prices by product for display
  const pricesByProduct: Record<number, ChannelPrice[]> = {};
  for (const cp of filteredPrices) {
    if (!pricesByProduct[cp.product_id]) {
      pricesByProduct[cp.product_id] = [];
    }
    pricesByProduct[cp.product_id].push(cp);
  }

  const filteredProducts = products.filter(p => pricesByProduct[p.id]?.length > 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      {/* Header */}
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

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            {t('subtitle')}
          </p>
        </div>

        {/* Filters */}
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
              {/* Search */}
              <div className="lg:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    placeholder={t('searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Provider Filter */}
              <Select
                value={selectedProviders[0] || "all"}
                onValueChange={(value) => setSelectedProviders(value === "all" ? [] : [value])}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('allProviders')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allProviders')}</SelectItem>
                  {providers.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.logo} {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Channel Type Filter */}
              <Select
                value={selectedChannelTypes[0] || "all"}
                onValueChange={(value) => setSelectedChannelTypes(value === "all" ? [] : [value])}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('channelType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allTypes')}</SelectItem>
                  {channelTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {t(`channelTypes.${type}` as any)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Region Filter */}
              <Select
                value={selectedRegions[0] || "all"}
                onValueChange={(value) => setSelectedRegions(value === "all" ? [] : [value])}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('region')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allRegions')}</SelectItem>
                  <SelectItem value="global">{t('global')}</SelectItem>
                  <SelectItem value="china">{t('china')}</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort */}
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

            {/* China Only & Active Filters */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="china-only"
                  checked={showChinaOnly}
                  onCheckedChange={(checked) => setShowChinaOnly(checked as boolean)}
                />
                <label htmlFor="china-only" className="text-sm cursor-pointer">
                  {t('chinaAccessOnly')}
                </label>
              </div>

              {/* Active filter badges */}
              <div className="flex flex-wrap gap-2">
                {selectedProviders.map(id => {
                  const provider = providers.find(p => p.id === parseInt(id));
                  return provider ? (
                    <Badge key={id} variant="secondary" className="gap-1 pr-1">
                      <img src={provider.logo} alt={provider.name} className="w-4 h-4 rounded" />
                      {provider.name}
                      <button onClick={() => setSelectedProviders(prev => prev.filter(p => p !== id))} className="ml-1 hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ) : null;
                })}
                {selectedChannelTypes.map(type => (
                  <Badge key={type} variant="secondary" className="gap-1 pr-1">
                    {t(`channelTypes.${type}` as any)}
                    <button onClick={() => setSelectedChannelTypes(prev => prev.filter(t => t !== type))} className="ml-1 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                {selectedRegions.map(region => (
                  <Badge key={region} variant="secondary" className="gap-1 pr-1">
                    {region === "global" ? t('global') : region === "china" ? t('china') : region}
                    <button onClick={() => setSelectedRegions(prev => prev.filter(r => r !== region))} className="ml-1 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                {showChinaOnly && (
                  <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 pr-1">
                    🇨🇳 {t('chinaAccessOnly')}
                    <button onClick={() => setShowChinaOnly(false)} className="ml-1 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
              </div>

              <span className="ml-auto text-sm text-zinc-500">
                {t('results', { count: filteredPrices.length })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Table */}
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('model')}</TableHead>
                    <TableHead>{t('channel')}</TableHead>
                    <TableHead>{t('type')}</TableHead>
                    <TableHead className="text-right">{t('inputPer1M')}</TableHead>
                    <TableHead className="text-right">{t('outputPer1M')}</TableHead>
                    <TableHead className="text-center">{t('chinaAccess')}</TableHead>
                    <TableHead className="text-right">{t('savings')}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const prices = pricesByProduct[product.id] || [];
                    const cheapest = prices.reduce((min, cp) =>
                      (cp.input_price_per_1m || 0) < (min.input_price_per_1m || Infinity) ? cp : min
                    , prices[0]);

                    return prices.map((cp, idx) => {
                      const isCheapest = cp.id === cheapest?.id;
                      const officialPrice = prices.find(p => p.channels.type === 'official');
                      const savings = officialPrice && officialPrice.input_price_per_1m > cp.input_price_per_1m
                        ? (((officialPrice.input_price_per_1m - cp.input_price_per_1m) / officialPrice.input_price_per_1m) * 100).toFixed(0)
                        : '0';

                      return (
                        <TableRow key={cp.id} className={idx > 0 ? "border-t-0" : ""}>
                          {idx === 0 && (
                            <TableCell rowSpan={prices.length} className="font-medium align-top">
                              <Link href={`/${locale}/models/${product.slug}`} className="hover:text-blue-600">
                                {product.name}
                              </Link>
                              <div className="flex items-center gap-1 text-xs text-zinc-500 mt-1">
                                {product.providers && (
                                  <>
                                    <img src={product.providers.logo_url} alt={product.providers.name} className="w-4 h-4 rounded" />
                                    <span>{product.providers.name}</span>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={isCheapest ? "font-medium" : ""}>
                                {cp.channels.name}
                              </span>
                              {isCheapest && (
                                <Badge className="bg-green-600 text-xs">{t('cheapest')}</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {t(`channelTypes.${cp.channels.type}` as any)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${cp.input_price_per_1m?.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${cp.output_price_per_1m?.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">
                            {cp.channels.access_from_china ? (
                              <Check className="w-4 h-4 text-green-600 mx-auto" />
                            ) : (
                              <span className="text-zinc-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(savings) > 0 ? (
                              <span className="text-green-600 font-medium">-{savings}%</span>
                            ) : (
                              <span className="text-zinc-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Link href={`/${locale}/models/${product.slug}`}>
                              <Button variant="ghost" size="sm" className="gap-1">
                                {t('details')} <ArrowRight className="w-3 h-3" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
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
