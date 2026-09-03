"use client";

import { useState, useMemo, useDeferredValue } from "react";
import Link from "next/link";
import { useTranslations } from "@/lib/translations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Check, Search, Star, Layers, DollarSign, HelpCircle } from "lucide-react";
import SiteHeader from '@/components/SiteHeader';
import { formatPrice, calculateSavingsPercent } from "@/lib/currency";
import { getProviderLogoFallback, getProviderLogoSrc } from "@/lib/provider-branding";
import type { GroupedProduct } from "@/lib/grouped-products";
import {
  usd,
  getCheapestChannel,
  getCheapestOfficialChannel,
} from "@/lib/channel-price-utils";
import type { FaqItem } from "./faqs";

const MAX_SELECT = 4;

// Flagship defaults when the URL doesn't preselect models and the benchmark
// join returns no usable scores (e.g. a stale dev DB). The first two slugs
// present in the dataset are used; this keeps the SSR'd default a sensible
// comparison instead of an alphabetically-first junk row.
const DEFAULT_SLUGS = [
  "claude-opus-4",
  "gpt-4o",
  "deepseek-chat",
  "gemini-2.5-pro",
];

function formatContext(ctx: number | null | undefined, locale: string): string {
  if (!ctx || ctx <= 0) return "—";
  if (ctx >= 1_000_000) {
    return `${(ctx / 1_000_000).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 1 })}M`;
  }
  return `${Math.round(ctx / 1000).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}K`;
}

interface Comparison {
  product: GroupedProduct;
  cheapest: ReturnType<typeof getCheapestChannel>;
  official: ReturnType<typeof getCheapestOfficialChannel>;
  inputUsd: number | null;
  outputUsd: number | null;
  savings: number | null;
}

/**
 * Interactive half of /compare/models: the model picker (max 4, FIFO) and the
 * side-by-side cards + table. `products` and `initialSlugs` arrive from the
 * server component, so the default two-model comparison is in the served HTML
 * — no effect fetch, no spinner for crawlers.
 */
export default function CompareModelsView({
  locale,
  products,
  initialSlugs,
  faqs,
}: {
  locale: string;
  products: GroupedProduct[];
  initialSlugs: string[];
  faqs: FaqItem[];
}) {
  const t = useTranslations("compareModels");
  const isZh = locale === "zh";
  const tNav = useTranslations("nav");

  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery);

  const [selected, setSelected] = useState<string[]>(() => {
    const bySlug = new Map(products.map((p) => [p.slug, p] as const));
    // Start from whatever valid slugs the URL preselected (e.g. the CTA from a
    // model's plan comparison passes one), then fill up to two so the SSR'd
    // page always shows a comparison rather than the "select 2 models" state.
    const seeds = initialSlugs.filter((s) => bySlug.has(s)).slice(0, MAX_SELECT);
    const ordered = new Set(seeds);

    // Top-up candidates, in priority order: highest Agent-scored models, then
    // well-known flagships present in the dataset, then alphabetical.
    const topScored = [...products]
      .filter((p) => p.benchmark_arena_elo != null)
      .sort((a, b) => (b.benchmark_arena_elo ?? -1) - (a.benchmark_arena_elo ?? -1))
      .map((p) => p.slug);
    const curated = DEFAULT_SLUGS.filter((s) => bySlug.has(s));
    const alphabetical = [...products]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => p.slug);

    for (const slug of [...topScored, ...curated, ...alphabetical]) {
      if (ordered.size >= 2) break;
      ordered.add(slug);
    }
    return Array.from(ordered).slice(0, MAX_SELECT);
  });

  const toggleSelect = (slug: string) => {
    setSelected((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= MAX_SELECT) return [...prev.slice(1), slug];
      return [...prev, slug];
    });
  };

  const pickerProducts = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const filtered = q
      ? products.filter((p) =>
          [p.name, p.slug, p.baseName, p.providers?.name]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)),
        )
      : // Without a query, show the highest-scored models first and cap the
        // list so we don't render 250+ toggle buttons at once.
        [...products].sort(
          (a, b) => (b.benchmark_arena_elo ?? -1) - (a.benchmark_arena_elo ?? -1),
        );
    return q ? filtered : filtered.slice(0, 60);
  }, [products, deferredQuery]);

  const selectedProducts = useMemo(
    () =>
      selected
        .map((slug) => products.find((p) => p.slug === slug))
        .filter((p): p is GroupedProduct => Boolean(p)),
    [selected, products],
  );

  // Per-model cheapest channel, USD-normalised for cross-model comparison, plus
  // the official baseline for the "vs Official" row.
  const comparisons = useMemo<Comparison[]>(
    () =>
      selectedProducts.map((product) => {
        const cheapest = getCheapestChannel(product);
        const official = getCheapestOfficialChannel(product);
        const inputUsd = cheapest
          ? usd(cheapest.input_price_per_1m, cheapest.currency || "USD")
          : null;
        const outputUsd = cheapest
          ? usd(cheapest.output_price_per_1m, cheapest.currency || "USD")
          : null;
        const savings =
          cheapest &&
          official &&
          cheapest.input_price_per_1m != null &&
          official.input_price_per_1m != null
            ? calculateSavingsPercent(
                cheapest.input_price_per_1m,
                cheapest.currency || "USD",
                official.input_price_per_1m,
                official.currency || "USD",
              )
            : null;
        return { product, cheapest, official, inputUsd, outputUsd, savings };
      }),
    [selectedProducts],
  );

  // Winners are relative to the current selection, not absolute thresholds, so
  // the badges stay meaningful no matter which models are picked.
  const eloValues = comparisons
    .map((c) => c.product.benchmark_arena_elo)
    .filter((v): v is number => v != null);
  const bestElo = eloValues.length ? Math.max(...eloValues) : null;
  const ctxValues = comparisons
    .map((c) => c.product.context_window)
    .filter((v): v is number => v != null && v > 0);
  const largestCtx = ctxValues.length ? Math.max(...ctxValues) : null;
  const inValues = comparisons
    .map((c) => c.inputUsd)
    .filter((v): v is number => v != null);
  const cheapestInput = inValues.length ? Math.min(...inValues) : null;
  const outValues = comparisons
    .map((c) => c.outputUsd)
    .filter((v): v is number => v != null);
  const cheapestOutput = outValues.length ? Math.min(...outValues) : null;

  const gridCols =
    comparisons.length >= 4
      ? "sm:grid-cols-2 xl:grid-cols-4"
      : comparisons.length === 3
        ? "sm:grid-cols-2 lg:grid-cols-3"
        : "sm:grid-cols-2";

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <SiteHeader locale={locale} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
          <p className="text-zinc-600 dark:text-zinc-400 max-w-3xl">{t("subtitle")}</p>
        </div>

        {/* Model picker */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-4 flex-wrap">
              <span>{t("selectorTitle")}</span>
              <Badge variant="outline">{t("selectedCount", { count: selected.length })}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-sm text-zinc-500 mb-4">{t("selectorHint")}</p>
            <div className="flex flex-wrap gap-2">
              {pickerProducts.map((product) => {
                const isSelected = selected.includes(product.slug);
                const logoSrc = getProviderLogoSrc(product.providers);
                return (
                  <Button
                    key={product.id}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleSelect(product.slug)}
                    className="gap-2 max-w-full"
                  >
                    {logoSrc ? (
                      <img
                        src={logoSrc}
                        alt=""
                        aria-hidden="true"
                        className="w-4 h-4 rounded-sm object-contain"
                      />
                    ) : (
                      <span aria-hidden="true">
                        {getProviderLogoFallback(product.providers, "🤖")}
                      </span>
                    )}
                    <span className="truncate">{product.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </Button>
                );
              })}
              {pickerProducts.length === 0 && (
                <span className="text-sm text-zinc-500 py-2">{t("pleaseSelect")}</span>
              )}
            </div>
          </CardContent>
        </Card>

        {comparisons.length < 2 ? (
          <Card>
            <CardContent className="py-16 text-center text-zinc-500">
              {t("pleaseSelect")}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Comparison cards */}
            <div className={`grid gap-4 mb-8 grid-cols-1 ${gridCols}`}>
              {comparisons.map(({ product, cheapest }) => {
                const logoSrc = getProviderLogoSrc(product.providers);
                return (
                  <Card key={product.id} className="overflow-hidden">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3 mb-4">
                        {logoSrc ? (
                          <img
                            src={logoSrc}
                            alt={product.providers?.name || product.name}
                            className="w-10 h-10 rounded-lg flex-shrink-0 object-contain"
                          />
                        ) : (
                          <span className="text-3xl flex-shrink-0">
                            {getProviderLogoFallback(product.providers, "🤖")}
                          </span>
                        )}
                        <div className="min-w-0">
                          <Link
                            href={`/${locale}/models/${product.slug}`}
                            className="font-bold hover:text-blue-600 block truncate"
                          >
                            {product.name}
                          </Link>
                          <p className="text-sm text-zinc-500 truncate">
                            {product.providers?.name}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3">
                          <div className="text-xs text-zinc-500 mb-1">{t("agentScore")}</div>
                          <div className="text-xl font-bold">
                            {product.benchmark_arena_elo != null
                              ? `${product.benchmark_arena_elo}%`
                              : "—"}
                          </div>
                        </div>
                        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3">
                          <div className="text-xs text-zinc-500 mb-1">{t("contextWindow")}</div>
                          <div className="text-xl font-bold">
                            {formatContext(product.context_window, locale)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3">
                          <div className="text-xs text-zinc-500 mb-1">{t("cheapestInput")}</div>
                          <div className="text-base font-semibold font-mono">
                            {cheapest
                              ? formatPrice(
                                  cheapest.input_price_per_1m,
                                  cheapest.currency || "USD",
                                  locale,
                                )
                              : "—"}
                          </div>
                        </div>
                        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3">
                          <div className="text-xs text-zinc-500 mb-1">{t("cheapestOutput")}</div>
                          <div className="text-base font-semibold font-mono">
                            {cheapest
                              ? formatPrice(
                                  cheapest.output_price_per_1m,
                                  cheapest.currency || "USD",
                                  locale,
                                )
                              : "—"}
                          </div>
                        </div>
                      </div>

                      <Link href={`/${locale}/models/${product.slug}`}>
                        <Button variant="outline" size="sm" className="w-full gap-1">
                          {t("details")} <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Detailed table */}
            <Card className="mb-8">
              <CardContent className="p-0 sm:p-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-44">{t("title")}</TableHead>
                      {comparisons.map(({ product }) => (
                        <TableHead key={product.id} className="text-center min-w-[140px]">
                          <Link
                            href={`/${locale}/models/${product.slug}`}
                            className="hover:text-blue-600 inline-flex items-center gap-2 justify-center"
                          >
                            {(() => {
                              const logoSrc = getProviderLogoSrc(product.providers);
                              return logoSrc ? (
                                <img
                                  src={logoSrc}
                                  alt=""
                                  aria-hidden="true"
                                  className="w-5 h-5 rounded-sm object-contain"
                                />
                              ) : (
                                <span aria-hidden="true">
                                  {getProviderLogoFallback(product.providers, "🤖")}
                                </span>
                              );
                            })()}
                            <span className="truncate max-w-[120px]">{product.name}</span>
                          </Link>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                      <TableCell colSpan={comparisons.length + 1} className="font-semibold text-xs uppercase tracking-wide text-zinc-500">
                        {t("groups.performance")}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">{t("fields.agentScore")}</TableCell>
                      {comparisons.map(({ product }) => (
                        <TableCell key={product.id} className="text-center">
                          <span className="font-semibold">
                            {product.benchmark_arena_elo != null
                              ? `${product.benchmark_arena_elo}%`
                              : "—"}
                          </span>
                          {bestElo != null && product.benchmark_arena_elo === bestElo && (
                            <Badge className="ml-2 bg-green-600 text-xs">{t("badges.best")}</Badge>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>

                    <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                      <TableCell colSpan={comparisons.length + 1} className="font-semibold text-xs uppercase tracking-wide text-zinc-500">
                        {t("groups.context")}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">{t("fields.contextWindow")}</TableCell>
                      {comparisons.map(({ product }) => (
                        <TableCell key={product.id} className="text-center">
                          <span className="font-semibold">
                            {formatContext(product.context_window, locale)}
                          </span>
                          {largestCtx != null && product.context_window === largestCtx && (
                            <Badge className="ml-2 bg-orange-500 text-xs">{t("badges.largest")}</Badge>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>

                    <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                      <TableCell colSpan={comparisons.length + 1} className="font-semibold text-xs uppercase tracking-wide text-zinc-500">
                        {t("groups.pricing")}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">{t("fields.inputPrice")}</TableCell>
                      {comparisons.map(({ product, cheapest, inputUsd }) => (
                        <TableCell key={product.id} className="text-center font-mono">
                          {cheapest ? (
                            <span className="font-semibold">
                              {formatPrice(
                                cheapest.input_price_per_1m,
                                cheapest.currency || "USD",
                                locale,
                              )}
                            </span>
                          ) : (
                            <span className="text-zinc-400">{t("noChannelPrices")}</span>
                          )}
                          {cheapest && cheapestInput != null && inputUsd === cheapestInput && (
                            <Badge className="ml-2 bg-green-600 text-xs">{t("badges.cheapest")}</Badge>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">{t("fields.outputPrice")}</TableCell>
                      {comparisons.map(({ product, cheapest, outputUsd }) => (
                        <TableCell key={product.id} className="text-center font-mono">
                          {cheapest ? (
                            <span className="font-semibold">
                              {formatPrice(
                                cheapest.output_price_per_1m,
                                cheapest.currency || "USD",
                                locale,
                              )}
                            </span>
                          ) : (
                            <span className="text-zinc-400">{t("noChannelPrices")}</span>
                          )}
                          {cheapest && cheapestOutput != null && outputUsd === cheapestOutput && (
                            <Badge className="ml-2 bg-green-600 text-xs">{t("badges.cheapest")}</Badge>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">{t("fields.vsOfficial")}</TableCell>
                      {comparisons.map(({ product, cheapest, official, savings }) => (
                        <TableCell key={product.id} className="text-center">
                          {!cheapest ? (
                            <span className="text-zinc-400">—</span>
                          ) : !official ? (
                            <span className="text-zinc-400 text-xs">{t("noOfficialPrice")}</span>
                          ) : savings != null && savings > 0 ? (
                            <span className="text-green-600 font-semibold">-{savings}%</span>
                          ) : savings === 0 ? (
                            <Badge variant="outline" className="text-xs">{t("badges.same")}</Badge>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>

                    <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                      <TableCell colSpan={comparisons.length + 1} className="font-semibold text-xs uppercase tracking-wide text-zinc-500">
                        {t("groups.links")}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">{t("viewAllPrices")}</TableCell>
                      {comparisons.map(({ product }) => (
                        <TableCell key={product.id} className="text-center">
                          <Link
                            href={`/${locale}/models/${product.slug}`}
                            className="text-blue-600 hover:underline text-sm inline-flex items-center gap-1"
                          >
                            {t("details")} <ArrowRight className="w-3 h-3" />
                          </Link>
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">{t("comparePlansForModel")}</TableCell>
                      {comparisons.map(({ product }) => (
                        <TableCell key={product.id} className="text-center">
                          <Link
                            href={`/${locale}/compare/plans/${product.slug}`}
                            className="text-blue-600 hover:underline text-sm inline-flex items-center gap-1"
                          >
                            {tNav("comparePlans")} <ArrowRight className="w-3 h-3" />
                          </Link>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Recommendation */}
            <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 border-0">
              <CardContent className="p-8 text-white">
                <h2 className="text-xl font-bold mb-1">{t("recommendation.title")}</h2>
                <p className="text-blue-100 mb-6 text-sm">{t("recommendation.subtitle")}</p>
                <div className={`grid gap-4 grid-cols-1 ${gridCols}`}>
                  {comparisons.map(({ product, inputUsd }) => {
                    const logoSrc = getProviderLogoSrc(product.providers);
                    return (
                      <div key={product.id} className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                        <div className="flex items-center gap-2 mb-3">
                          {logoSrc ? (
                            <img
                              src={logoSrc}
                              alt=""
                              aria-hidden="true"
                              className="w-7 h-7 rounded bg-white/20 p-0.5 object-contain"
                            />
                          ) : (
                            <span className="text-xl" aria-hidden="true">
                              {getProviderLogoFallback(product.providers, "🤖")}
                            </span>
                          )}
                          <span className="font-semibold truncate">{product.name}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {bestElo != null && product.benchmark_arena_elo === bestElo && (
                            <Badge className="bg-emerald-400 text-emerald-950 gap-1">
                              <Star className="w-3 h-3" /> {t("recBadges.topRated")}
                            </Badge>
                          )}
                          {largestCtx != null && product.context_window === largestCtx && (
                            <Badge className="bg-sky-400 text-sky-950 gap-1">
                              <Layers className="w-3 h-3" /> {t("recBadges.largestContext")}
                            </Badge>
                          )}
                          {cheapestInput != null && inputUsd === cheapestInput && (
                            <Badge className="bg-violet-300 text-violet-950 gap-1">
                              <DollarSign className="w-3 h-3" /> {t("recBadges.lowestPrice")}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* FAQ — visible mirror of the FAQPage JSON-LD emitted by page.tsx. */}
        {faqs.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <HelpCircle className="w-6 h-6 text-blue-600" />
              {isZh ? "常见问题" : "Frequently asked questions"}
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
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
