'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type PriceHistoryPoint = {
  channelPriceId: number;
  providerSlug: string;
  providerName: string;
  recordedAt: string;
  newInputPrice: number | null;
  newOutputPrice: number | null;
  currency: string | null;
};

export type PriceHistoryChartProps = {
  history: PriceHistoryPoint[];
  locale: 'en' | 'zh';
  /** Providers considered the vendor's own channels (official/producer), selected by default. */
  officialProviderSlugs?: string[];
};

const COLORS = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#a855f7',
];

/** USD value of one native-currency point. Only CNY rows occur in practice. */
const TO_USD: Record<string, number> = { CNY: 0.14, USD: 1 };

function toUsd(price: number, currency: string | null): number {
  const rate = currency ? (TO_USD[currency] ?? 1) : 1;
  return price * rate;
}

type SeriesMeta = {
  slug: string;
  name: string;
  /** Line key, e.g. "qwen|CNY" when one provider carries several currencies. */
  key: string;
  color: string;
  currency: string;
};

export default function PriceHistoryChart({ history, locale, officialProviderSlugs = [] }: PriceHistoryChartProps) {
  const [mode, setMode] = useState<'input' | 'output'>('input');
  const [unit, setUnit] = useState<'usd' | 'native'>('usd');
  const isZh = locale === 'zh';

  const { seriesMeta, series, currencies } = useMemo(() => {
    // One line per provider + currency (a few providers carry both CNY and USD rows).
    const meta = new Map<string, SeriesMeta>();
    let colorIndex = 0;
    for (const row of history) {
      const currency = row.currency ?? 'USD';
      const key = `${row.providerSlug}|${currency}`;
      if (!meta.has(key)) {
        meta.set(key, {
          slug: row.providerSlug,
          name: row.providerName,
          key,
          color: COLORS[colorIndex++ % COLORS.length],
          currency,
        });
      }
    }
    const metaList = Array.from(meta.values());

    const byTs = new Map<string, Record<string, number>>();
    for (const row of history) {
      const native = mode === 'input' ? row.newInputPrice : row.newOutputPrice;
      if (native == null) continue;
      const ts = row.recordedAt.slice(0, 10);
      const key = `${row.providerSlug}|${row.currency ?? 'USD'}`;
      // Native mode plots the raw value; USD mode converts for a common axis.
      const value = unit === 'usd' ? toUsd(native, row.currency) : native;
      const existing = byTs.get(ts) ?? {};
      existing[key] = value;
      byTs.set(ts, existing);
    }

    const sorted = Array.from(byTs.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);

    // Forward-fill so a line stays flat between that provider's own changes.
    const lastSeen: Record<string, number> = {};
    const filled = sorted.map(row => {
      const merged: Record<string, number> = {};
      for (const m of metaList) {
        if (row[m.key] != null) lastSeen[m.key] = row[m.key];
        if (lastSeen[m.key] != null) merged[m.key] = lastSeen[m.key];
      }
      return merged;
    });

    const currencySet = new Set(metaList.map(m => m.currency));
    return { seriesMeta: metaList, series: filled, currencies: currencySet };
  }, [history, mode, unit]);

  // Provider-level selection (currency variants share one checkbox).
  const [hiddenSlugs, setHiddenSlugs] = useState<Set<string> | null>(null);
  const effectiveHidden = useMemo(() => {
    if (hiddenSlugs !== null) return hiddenSlugs;
    // Default: official channels, but only when they actually have history —
    // otherwise the chart would start empty for models whose official row
    // is newer than the price-history table.
    const present = new Set(seriesMeta.map(m => m.slug));
    const officialPresent = [...present].filter(s => officialProviderSlugs.includes(s));
    if (officialPresent.length === 0) return new Set<string>();
    return new Set([...present].filter(s => !officialPresent.includes(s)));
  }, [hiddenSlugs, seriesMeta, officialProviderSlugs]);

  if (history.length === 0 || seriesMeta.length === 0) {
    return (
      <div className="rounded-md border p-4 text-sm text-zinc-500">
        {isZh
          ? '这个模型暂无历史价格记录。新价格变动会在下一次 scraper 抓取后入库。'
          : 'No price history yet. New price changes will appear after the next scraper run.'}
      </div>
    );
  }

  const toggle = (slug: string) => {
    setHiddenSlugs(prev => {
      const base = new Set(prev ?? effectiveHidden);
      if (base.has(slug)) base.delete(slug);
      else base.add(slug);
      return base;
    });
  };

  const selectAll = () => setHiddenSlugs(new Set());
  const selectOfficial = () => {
    const official = new Set(officialProviderSlugs);
    if (official.size === 0) return;
    setHiddenSlugs(new Set(seriesMeta.map(m => m.slug).filter(s => !official.has(s))));
  };

  const visibleMeta = seriesMeta.filter(m => !effectiveHidden.has(m.slug));
  const mixedCurrencies = currencies.size > 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMode('input')}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            mode === 'input'
              ? 'bg-blue-600 text-white'
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
          }`}
        >
          {isZh ? '输入价' : 'Input'}
        </button>
        <button
          type="button"
          onClick={() => setMode('output')}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            mode === 'output'
              ? 'bg-blue-600 text-white'
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
          }`}
        >
          {isZh ? '输出价' : 'Output'}
        </button>
        <span className="mx-1 h-4 w-px bg-zinc-300" />
        <button
          type="button"
          onClick={() => setUnit('usd')}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            unit === 'usd'
              ? 'bg-zinc-800 text-white'
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
          }`}
        >
          USD
        </button>
        <button
          type="button"
          onClick={() => setUnit('native')}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            unit === 'native'
              ? 'bg-zinc-800 text-white'
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
          }`}
        >
          {isZh ? '原币种' : 'Native'}
        </button>
        <button
          type="button"
          onClick={selectAll}
          className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:text-zinc-800 hover:underline"
        >
          {isZh ? '全部渠道' : 'All channels'}
        </button>
        {officialProviderSlugs.length > 0 && (
          <button
            type="button"
            onClick={selectOfficial}
            className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:text-zinc-800 hover:underline"
          >
            {isZh ? '仅官方' : 'Official only'}
          </button>
        )}
        <span className="ml-auto text-xs text-zinc-500">
          {isZh
            ? `${history.length} 次变动 · ${visibleMeta.length}/${seriesMeta.length} 个渠道`
            : `${history.length} changes · ${visibleMeta.length}/${seriesMeta.length} channels`}
        </span>
      </div>

      {mixedCurrencies && unit === 'usd' && (
        <p className="text-xs text-zinc-500">
          {isZh
            ? '不同币种已按汇率折算为 USD（CNY×0.14）后绘制；切到「原币种」看各家原始报价。'
            : 'Mixed currencies plotted in USD (CNY ~0.14); switch to Native for raw list prices.'}
        </p>
      )}
      {mixedCurrencies && unit === 'native' && (
        <p className="text-xs text-amber-600">
          {isZh
            ? '原币种模式下各线单位不同（CNY/USD），仅适合同币种渠道比较。'
            : 'Native mode mixes units (CNY/USD) on one axis; compare same-currency lines only.'}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {seriesMeta.map(m => {
          const active = !effectiveHidden.has(m.slug);
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => toggle(m.slug)}
              aria-pressed={active}
              title={`${m.name} · ${m.currency}`}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-opacity ${
                active ? 'border-zinc-300 bg-white' : 'border-zinc-200 bg-zinc-50 opacity-45'
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
              {m.name}
              {m.currency !== 'USD' && <span className="text-zinc-400">{m.currency}</span>}
            </button>
          );
        })}
      </div>

      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="ts" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              label={{
                value: unit === 'usd'
                  ? 'USD / 1M tokens'
                  : currencies.size === 1
                    ? `${[...currencies][0]} / 1M tokens`
                    : `${isZh ? '原币种' : 'Native'} / 1M`,
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 11, fill: '#6b7280' },
              }}
            />
            <Tooltip
              contentStyle={{ fontSize: 12 }}
              formatter={(value) => (typeof value === 'number' ? value.toFixed(4) : String(value))}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, cursor: 'pointer' }}
              onClick={(entry) => {
                const key = (entry as { dataKey?: unknown }).dataKey;
                if (typeof key !== 'string') return;
                const meta = seriesMeta.find(m => m.key === key);
                if (meta) toggle(meta.slug);
              }}
            />
            {visibleMeta.map(m => (
              <Line
                key={m.key}
                type="monotone"
                dataKey={m.key}
                name={m.currency === 'USD' ? m.name : `${m.name} (${m.currency})`}
                stroke={m.color}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
