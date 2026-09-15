'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, ExternalLink } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { AiBenchmarkSummary, AiCatalogItem } from '@/lib/ai-vertical-catalog';
import { getVerticalProviderLogo } from '@/lib/vertical-provider-logos';
import { verticalBenchmarkSummaryFallback } from '@/lib/vertical-benchmark-summaries';

const MAX_SELECT = 4;

function providerSlug(item: AiCatalogItem): string {
  if (item.providerSlug) return item.providerSlug;
  return item.provider.toLowerCase().replace(/\/.*$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function providerLogo(item: AiCatalogItem): string | undefined {
  return item.providerLogoUrl ?? getVerticalProviderLogo(providerSlug(item));
}

function summariesFor(item: AiCatalogItem): AiBenchmarkSummary[] {
  if (item.benchmarkSummaries && item.benchmarkSummaries.length > 0) return item.benchmarkSummaries;
  return item.slug ? verticalBenchmarkSummaryFallback(item.slug) : [];
}

function rankValue(item: AiCatalogItem): number | null {
  const rank = summariesFor(item).find((summary) => summary.metricName === 'ARENA_RANK');
  return rank ? rank.value : null;
}

function summaryValue(item: AiCatalogItem, predicate: (summary: AiBenchmarkSummary) => boolean): string {
  const summary = summariesFor(item).find(predicate);
  if (!summary) return '—';
  if (summary.unit === 'rank') return `#${Math.round(summary.value).toLocaleString()}`;
  if (summary.unit === 'percent' || summary.unit === '%') return `${summary.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  return summary.value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function uniqueValues(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.flatMap((value) => (value ? value.split(',').map((part) => part.trim()).filter(Boolean) : [])))];
}

export default function VideoModelCompareView({ locale, models }: { locale: string; models: AiCatalogItem[] }) {
  const isZh = locale === 'zh';
  const ranked = useMemo(() => [...models].sort((a, b) => {
    const ar = rankValue(a) ?? Number.MAX_SAFE_INTEGER;
    const br = rankValue(b) ?? Number.MAX_SAFE_INTEGER;
    return ar - br || a.name.localeCompare(b.name);
  }), [models]);

  const [query, setQuery] = useState('');
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(() => ranked.slice(0, 3).map((item) => item.slug).filter((slug): slug is string => Boolean(slug)));
  const selected = selectedSlugs.map((slug) => models.find((item) => item.slug === slug)).filter((item): item is AiCatalogItem => Boolean(item));

  const filtered = ranked.filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [item.name, item.provider, item.slug, ...(item.capabilities ?? [])].some((value) => value?.toLowerCase().includes(q));
  });

  const toggle = (slug: string | undefined) => {
    if (!slug) return;
    setSelectedSlugs((current) => {
      if (current.includes(slug)) return current.filter((item) => item !== slug);
      return [...current, slug].slice(-MAX_SELECT);
    });
  };

  const comparisonRows = [
    {
      label: isZh ? 'Arena AI 视频排名' : 'Arena AI video rank',
      value: (item: AiCatalogItem) => summaryValue(item, (summary) => summary.metricName === 'ARENA_RANK'),
    },
    {
      label: 'VBench',
      value: (item: AiCatalogItem) => summaryValue(item, (summary) => summary.benchmarkSlug === 'vbench' && summary.metricName === 'TOTAL_SCORE'),
    },
    {
      label: 'VBench++',
      value: (item: AiCatalogItem) => summaryValue(item, (summary) => summary.benchmarkSlug === 'vbench-plus' && summary.metricName === 'TOTAL_SCORE'),
    },
    {
      label: isZh ? '输入 → 输出' : 'Input → Output',
      value: (item: AiCatalogItem) => `${(item.inputModalities ?? []).join(', ') || '—'} → ${(item.outputModalities ?? []).join(', ') || '—'}`,
    },
    {
      label: isZh ? '访问方式' : 'Access',
      value: (item: AiCatalogItem) => (item.access ?? []).join(', ') || '—',
    },
    {
      label: isZh ? '计价单位' : 'Pricing unit',
      value: (item: AiCatalogItem) => item.pricingUnit ?? item.unit ?? '—',
    },
    {
      label: isZh ? '价格置信度' : 'Pricing confidence',
      value: (item: AiCatalogItem) => item.pricingConfidence ?? '—',
    },
    {
      label: isZh ? '状态' : 'Status',
      value: (item: AiCatalogItem) => item.status,
    },
  ];

  const sharedCapabilities = selected.length > 0
    ? selected.reduce<string[]>((acc, item, index) => {
      const caps = item.capabilities ?? [];
      if (index === 0) return caps;
      return acc.filter((capability) => caps.includes(capability));
    }, [])
    : [];
  const allCapabilityTags = uniqueValues(selected.map((item) => item.capabilities.join(',')));

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <SiteHeader locale={locale} />
      <main className="container mx-auto px-4 py-12">
        <section className="mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-4">{isZh ? '视频模型对比' : 'Video model compare'}</Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {isZh ? '视频模型横向对比' : 'Compare video generation models'}
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            {isZh
              ? '选择 2–4 个视频模型，对比 Arena AI 视频排名、VBench / VBench++、输入输出模态、访问方式和计价口径。排名和分数保留原始来源，不合成为站内总分。'
              : 'Select 2–4 video models to compare Arena AI video rank, VBench / VBench++, modalities, access paths and pricing units. Scores keep their original source and are not merged into a site-wide score.'}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={`/${locale}/video-models`}>
              <Button variant="outline">{isZh ? '返回视频模型目录' : 'Back to video catalog'}</Button>
            </Link>
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[340px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>{isZh ? '选择模型' : 'Select models'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isZh ? '搜索视频模型…' : 'Search video models…'} />
              <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                {filtered.map((item) => {
                  const checked = item.slug ? selectedSlugs.includes(item.slug) : false;
                  const logo = providerLogo(item);
                  return (
                    <button
                      key={item.slug ?? item.name}
                      type="button"
                      onClick={() => toggle(item.slug)}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${checked ? 'border-blue-400 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30' : 'hover:border-blue-200 hover:bg-blue-50/40 dark:hover:border-blue-900 dark:hover:bg-blue-950/20'}`}
                    >
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {logo && <img src={logo} alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded-md object-contain" />}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{item.name}</div>
                          <div className="truncate text-xs text-zinc-500">{item.provider}</div>
                        </div>
                        <Badge variant={checked ? 'default' : 'outline'}>{summaryValue(item, (summary) => summary.metricName === 'ARENA_RANK')}</Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs leading-5 text-zinc-500">
                {isZh ? '最多选择 4 个；选择第 5 个会自动替换最早选择的模型。' : 'Select up to 4 models; choosing a 5th replaces the earliest selection.'}
              </p>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="p-5">
                  <div className="text-3xl font-bold">{models.length}</div>
                  <div className="mt-1 text-sm text-zinc-500">{isZh ? '视频模型' : 'video models'}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="text-3xl font-bold">{models.filter((item) => rankValue(item) != null).length}</div>
                  <div className="mt-1 text-sm text-zinc-500">{isZh ? '有 Arena 排名' : 'with Arena rank'}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="text-3xl font-bold">{selected.length}</div>
                  <div className="mt-1 text-sm text-zinc-500">{isZh ? '正在对比' : 'selected'}</div>
                </CardContent>
              </Card>
            </div>

            <div className="overflow-x-auto rounded-xl border bg-white dark:bg-zinc-950">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
                  <tr>
                    <th className="sticky left-0 z-10 w-48 bg-zinc-50 px-4 py-3 dark:bg-zinc-900">{isZh ? '维度' : 'Dimension'}</th>
                    {selected.map((item) => (
                      <th key={item.slug} className="min-w-56 px-4 py-3">
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {providerLogo(item) && <img src={providerLogo(item)} alt="" width={24} height={24} className="h-6 w-6 rounded object-contain" />}
                          <div>
                            <div className="font-semibold normal-case text-zinc-900 dark:text-zinc-100">{item.name}</div>
                            <div className="normal-case text-zinc-500">{item.provider}</div>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.label} className="border-t">
                      <th className="sticky left-0 z-10 bg-white px-4 py-4 text-left font-medium dark:bg-zinc-950">{row.label}</th>
                      {selected.map((item) => (
                        <td key={`${item.slug}-${row.label}`} className="px-4 py-4 text-zinc-700 dark:text-zinc-300">{row.value(item)}</td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t">
                    <th className="sticky left-0 z-10 bg-white px-4 py-4 text-left font-medium dark:bg-zinc-950">{isZh ? '详情' : 'Details'}</th>
                    {selected.map((item) => (
                      <td key={`${item.slug}-details`} className="px-4 py-4">
                        <Link href={`/${locale}/video-models/${item.slug}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                          {isZh ? '打开详情页' : 'Open detail'} <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{isZh ? '能力标签' : 'Capability tags'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-2 text-sm font-medium">{isZh ? '共同能力' : 'Shared capabilities'}</div>
                  <div className="flex flex-wrap gap-2">
                    {sharedCapabilities.length > 0 ? sharedCapabilities.map((capability) => <Badge key={capability} variant="secondary">{capability}</Badge>) : <span className="text-sm text-zinc-500">—</span>}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium">{isZh ? '全部相关能力' : 'All selected capabilities'}</div>
                  <div className="flex flex-wrap gap-2">
                    {allCapabilityTags.map((capability) => <Badge key={capability} variant="outline">{capability}</Badge>)}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/20">
              <CardContent className="p-5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {isZh
                  ? '数据说明：Arena AI 当前公开 payload 暴露 video 排名，但没有独立 audio/music 排名；VBench / VBench++ 和 Arena AI 的评测口径不同，不应直接相加或合成为一个总分。'
                  : 'Data note: Arena AI currently exposes public video ranks, but no separate audio/music rank. VBench / VBench++ and Arena AI use different evaluation setups and should not be added into one combined score.'}
                <a href="https://arena.ai/leaderboard/video" target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-blue-600 hover:underline">
                  arena.ai <ExternalLink className="h-3 w-3" />
                </a>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
