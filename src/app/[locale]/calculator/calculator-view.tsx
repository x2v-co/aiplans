'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import Link from 'next/link';
import { Calculator, Check, Clipboard, Info, Search, Share2, X } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { estimateApiCost, type ApiUsage } from '@/lib/api-cost-calculator';
import { formatPrice, type CurrencyCode } from '@/lib/currency';
import { formatModelName } from '@/lib/model-names';
import type { GroupedProduct } from '@/lib/grouped-products';

const MAX_MODELS = 4;

export interface CalculatorInitialState {
  period: 'day' | 'month';
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cacheRate: number;
  batchRate: number;
  region: 'all' | 'china' | 'global';
  modelSlugs: string[];
}

function compactTokens(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    notation: 'compact', maximumFractionDigits: 1,
  }).format(value);
}

export default function CalculatorView({
  locale,
  products,
  initialState,
}: {
  locale: string;
  products: GroupedProduct[];
  initialState: CalculatorInitialState;
}) {
  const isZh = locale === 'zh';
  const [period, setPeriod] = useState(initialState.period);
  const [requests, setRequests] = useState(initialState.requests);
  const [inputTokens, setInputTokens] = useState(initialState.inputTokens);
  const [outputTokens, setOutputTokens] = useState(initialState.outputTokens);
  const [cacheRate, setCacheRate] = useState(initialState.cacheRate);
  const [batchRate, setBatchRate] = useState(initialState.batchRate);
  const [region, setRegion] = useState(initialState.region);
  const [selected, setSelected] = useState(initialState.modelSlugs);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const selectedProducts = useMemo(() => selected
    .map((slug) => products.find((product) => product.slug === slug))
    .filter((product): product is GroupedProduct => Boolean(product)), [products, selected]);

  const pickerProducts = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    const candidates = query
      ? products.filter((product) => [product.name, product.slug, product.providers?.name]
          .filter(Boolean).some((value) => String(value).toLowerCase().includes(query)))
      : [...products].sort((a, b) => {
          const score = (b.benchmark_arena_elo ?? -1) - (a.benchmark_arena_elo ?? -1);
          return score || (b.released_at || '').localeCompare(a.released_at || '');
        }).slice(0, 40);
    return candidates.slice(0, 80);
  }, [deferredSearch, products]);

  const usage: ApiUsage = {
    period,
    requests,
    inputTokensPerRequest: inputTokens,
    outputTokensPerRequest: outputTokens,
    cacheHitRate: cacheRate / 100,
    batchRate: batchRate / 100,
  };

  const estimates = selectedProducts.flatMap((product) => product.versions
    .filter((channel) => region === 'all' || channel.providers.region === region)
    .map((channel) => ({
      product,
      channel,
      estimate: estimateApiCost(usage, channel),
    })));

  const isFreeChannel = (item: (typeof estimates)[number]) =>
    item.channel.input_price_per_1m === 0 && item.channel.output_price_per_1m === 0;
  const free = estimates.filter(isFreeChannel);
  const paid = estimates.filter((item) => !isFreeChannel(item))
    .sort((a, b) => a.estimate.monthlyCostUsd - b.estimate.monthlyCostUsd);
  const totals = estimates[0]?.estimate;

  const toggleModel = (slug: string) => {
    setSelected((current) => current.includes(slug)
      ? current.filter((value) => value !== slug)
      : current.length >= MAX_MODELS ? [...current.slice(1), slug] : [...current, slug]);
  };

  const share = async () => {
    const params = new URLSearchParams({
      period,
      requests: String(requests),
      input: String(inputTokens),
      output: String(outputTokens),
      cache: String(cacheRate),
      batch: String(batchRate),
      region,
      models: selected.join(','),
    });
    const url = `${window.location.origin}/${locale}/calculator?${params}`;
    window.history.replaceState(null, '', url);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <SiteHeader locale={locale} />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 max-w-3xl">
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <Calculator className="h-7 w-7 text-blue-600" />
            {isZh ? 'AI API 月成本计算器' : 'AI API monthly cost calculator'}
          </h1>
          <p className="mt-3 leading-7 text-zinc-600 dark:text-zinc-400">
            {isZh
              ? '输入真实调用模式，同时比较最多 4 个模型的全部可用渠道。原价保留渠道币种，排名统一按美元折算。'
              : 'Enter your real request pattern and compare every available channel for up to four models. Native prices stay in their published currency; ranking is normalised to USD.'}
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" aria-label={isZh ? '成本参数' : 'Cost inputs'}>
          <Card>
            <CardHeader><CardTitle>{isZh ? '1. 用量' : '1. Usage'}</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-2 block">{isZh ? '计算周期' : 'Usage period'}</Label>
                <div className="inline-flex rounded-md border p-1" role="group">
                  {(['day', 'month'] as const).map((value) => (
                    <Button key={value} type="button" size="sm" variant={period === value ? 'default' : 'ghost'} onClick={() => setPeriod(value)}>
                      {value === 'day' ? (isZh ? '每日' : 'Daily') : (isZh ? '每月' : 'Monthly')}
                    </Button>
                  ))}
                </div>
                {period === 'day' && <p className="mt-2 text-xs text-zinc-500">{isZh ? '每日用量按 30 天折算为月度。' : 'Daily usage is converted using a 30-day month.'}</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <div>
                  <Label htmlFor="requests">{period === 'day' ? (isZh ? '每天请求数' : 'Requests / day') : (isZh ? '每月请求数' : 'Requests / month')}</Label>
                  <Input id="requests" className="mt-2" type="number" min={0} value={requests} onChange={(event) => setRequests(Math.max(0, Number(event.target.value)))} />
                </div>
                <div>
                  <Label htmlFor="input-tokens">{isZh ? '平均输入 Token' : 'Avg input tokens'}</Label>
                  <Input id="input-tokens" className="mt-2" type="number" min={0} value={inputTokens} onChange={(event) => setInputTokens(Math.max(0, Number(event.target.value)))} />
                </div>
                <div>
                  <Label htmlFor="output-tokens">{isZh ? '平均输出 Token' : 'Avg output tokens'}</Label>
                  <Input id="output-tokens" className="mt-2" type="number" min={0} value={outputTokens} onChange={(event) => setOutputTokens(Math.max(0, Number(event.target.value)))} />
                </div>
              </div>
              <div>
                <div className="mb-2 flex justify-between text-sm"><Label htmlFor="cache-rate">{isZh ? '缓存命中率' : 'Cache hit rate'}</Label><span>{cacheRate}%</span></div>
                <input id="cache-rate" className="w-full accent-blue-600" type="range" min="0" max="100" step="5" value={cacheRate} onChange={(event) => setCacheRate(Number(event.target.value))} />
                <p className="mt-1 text-xs text-zinc-500">{isZh ? '渠道未公布缓存价格时，按普通输入价计算。' : 'Channels without a published cache price use the regular input price.'}</p>
              </div>
              <div>
                <div className="mb-2 flex justify-between text-sm"><Label htmlFor="batch-rate">{isZh ? 'Batch 请求比例' : 'Batch request share'}</Label><span>{batchRate}%</span></div>
                <input id="batch-rate" className="w-full accent-blue-600" type="range" min="0" max="100" step="5" value={batchRate} onChange={(event) => setBatchRate(Number(event.target.value))} />
                <p className="mt-1 text-xs text-zinc-500">{isZh ? '按常见的 50% Batch 折扣估算；使用前需确认渠道是否支持。' : 'Assumes the common 50% Batch discount; confirm channel eligibility before use.'}</p>
              </div>
              {totals && (
                <div className="grid grid-cols-3 gap-3 border-t pt-5 text-center">
                  <div><div className="font-semibold">{compactTokens(totals.monthlyRequests, locale)}</div><div className="text-xs text-zinc-500">{isZh ? '请求/月' : 'requests/mo'}</div></div>
                  <div><div className="font-semibold">{compactTokens(totals.monthlyInputTokens, locale)}</div><div className="text-xs text-zinc-500">{isZh ? '输入/月' : 'input/mo'}</div></div>
                  <div><div className="font-semibold">{compactTokens(totals.monthlyOutputTokens, locale)}</div><div className="text-xs text-zinc-500">{isZh ? '输出/月' : 'output/mo'}</div></div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{isZh ? '2. 模型与地区' : '2. Models and region'}</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-5 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isZh ? '搜索模型或厂商' : 'Search model or vendor'} />
                </div>
                <Select value={region} onValueChange={(value) => setRegion(value as typeof region)}>
                  <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isZh ? '全部地区' : 'All regions'}</SelectItem>
                    <SelectItem value="china">{isZh ? '中国可用' : 'China'}</SelectItem>
                    <SelectItem value="global">{isZh ? '国际渠道' : 'Global'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="mb-4 flex min-h-9 flex-wrap gap-2">
                {selectedProducts.map((product) => (
                  <Badge key={product.slug} variant="secondary" className="gap-1 py-1.5">
                    {formatModelName(product.name)}
                    <button type="button" onClick={() => toggleModel(product.slug)} aria-label={isZh ? `移除 ${product.name}` : `Remove ${product.name}`}><X className="h-3.5 w-3.5" /></button>
                  </Badge>
                ))}
                <span className="self-center text-xs text-zinc-500">{selected.length}/{MAX_MODELS}</span>
              </div>
              <div className="max-h-80 overflow-y-auto border-y py-2">
                {pickerProducts.map((product) => {
                  const active = selected.includes(product.slug);
                  return (
                    <button key={product.slug} type="button" onClick={() => toggleModel(product.slug)} className="flex w-full items-center justify-between gap-3 px-2 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900">
                      <span className="min-w-0"><span className="block truncate font-medium">{formatModelName(product.name)}</span><span className="block truncate text-xs text-zinc-500">{product.providers?.name || ''} · {product.versionCounts} {isZh ? '个渠道' : 'channels'}</span></span>
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${active ? 'border-blue-600 bg-blue-600 text-white' : ''}`}>{active && <Check className="h-3.5 w-3.5" />}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8" aria-labelledby="results-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="results-heading" className="text-2xl font-bold">{isZh ? '月度成本对比' : 'Monthly cost comparison'}</h2>
              <p className="mt-1 text-sm text-zinc-500">{isZh ? '付费渠道按美元折算后的月成本升序排列。' : 'Paid channels are sorted by USD-normalised monthly cost.'}</p>
            </div>
            <Button type="button" variant="outline" onClick={share} className="gap-2">
              {copied ? <Clipboard className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              {copied ? (isZh ? '链接已复制' : 'Link copied') : (isZh ? '分享结果' : 'Share results')}
            </Button>
          </div>

          {selectedProducts.length === 0 ? (
            <div className="border-y py-14 text-center text-zinc-500">{isZh ? '请至少选择一个模型。' : 'Select at least one model.'}</div>
          ) : estimates.length === 0 ? (
            <div className="border-y py-14 text-center text-zinc-500">{isZh ? '所选地区暂无可用渠道。' : 'No channels match the selected region.'}</div>
          ) : (
            <>
              {free.length > 0 && (
                <div className="mb-5 border-l-4 border-emerald-500 bg-emerald-50 px-4 py-4 dark:bg-emerald-950/20">
                  <div className="font-semibold text-emerald-900 dark:text-emerald-200">{isZh ? `${free.length} 个标价为零的渠道` : `${free.length} zero-priced channels`}</div>
                  <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">{isZh ? '免费渠道通常有速率或用量限制，因此不与付费渠道争夺“最便宜”排名。' : 'Free channels usually have rate or usage limits, so they are listed separately from the paid ranking.'}</p>
                  <div className="mt-3 flex flex-wrap gap-2">{free.map(({ product, channel }) => <Badge key={`${product.id}-${channel.id}`} variant="outline">{formatModelName(product.name)} · {channel.providers.name}</Badge>)}</div>
                </div>
              )}
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="min-w-44">{isZh ? '模型' : 'Model'}</TableHead>
                      <TableHead className="min-w-36">{isZh ? '渠道' : 'Channel'}</TableHead>
                      <TableHead>{isZh ? '输入价' : 'Input price'}</TableHead>
                      <TableHead>{isZh ? '输出价' : 'Output price'}</TableHead>
                      <TableHead>{isZh ? '缓存' : 'Cache'}</TableHead>
                      <TableHead className="text-right">{isZh ? '预估月费' : 'Est. monthly'}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {paid.map(({ product, channel, estimate }, index) => (
                        <TableRow key={`${product.id}-${channel.id}`}>
                          <TableCell><Link href={`/${locale}/models/${product.slug}`} className="font-medium text-blue-600 hover:underline">{formatModelName(product.name)}</Link></TableCell>
                          <TableCell><span className="font-medium">{channel.providers.name}</span><span className="block text-xs text-zinc-500">{channel.providers.region === 'china' ? (isZh ? '中国' : 'China') : (isZh ? '国际' : 'Global')}</span></TableCell>
                          <TableCell className="font-mono whitespace-nowrap">{formatPrice(channel.input_price_per_1m, channel.currency, locale)}<span className="block text-xs text-zinc-500">/1M</span></TableCell>
                          <TableCell className="font-mono whitespace-nowrap">{formatPrice(channel.output_price_per_1m, channel.currency, locale)}<span className="block text-xs text-zinc-500">/1M</span></TableCell>
                          <TableCell className="font-mono whitespace-nowrap">{channel.cached_input_price_per_1m == null ? '—' : formatPrice(channel.cached_input_price_per_1m, channel.currency, locale)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <span className="text-lg font-bold">{formatPrice(estimate.monthlyCostUsd, 'USD' as CurrencyCode, locale)}</span>
                            {index === 0 && <Badge className="ml-2 bg-emerald-600">{isZh ? '最低付费' : 'Lowest paid'}</Badge>}
                            <span className="block text-xs text-zinc-500">{channel.currency !== 'USD' ? `${formatPrice(estimate.monthlyCost, channel.currency, locale)} ${isZh ? '原币' : 'native'}` : (isZh ? '折算 USD' : 'USD normalised')}</span>
                            {batchRate > 0 && <span className="block text-xs text-zinc-500">{isZh ? 'Batch 节省' : 'Batch saved'} {formatPrice(estimate.batchSavings, channel.currency, locale)}</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              {batchRate > 0 && <p className="mt-3 flex gap-2 text-xs leading-5 text-zinc-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{isZh ? 'Batch 折扣是场景假设，不代表所有渠道均支持；最终账单以渠道规则为准。' : 'The Batch discount is a scenario assumption, not a claim that every channel supports it. Confirm provider rules before purchasing.'}</p>}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
