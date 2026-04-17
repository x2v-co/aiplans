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

export default function PriceHistoryChart({ history, locale }: PriceHistoryChartProps) {
  const [mode, setMode] = useState<'input' | 'output'>('input');
  const isZh = locale === 'zh';

  const { providers, series } = useMemo(() => {
    const providerMap = new Map<string, { slug: string; name: string }>();
    for (const row of history) {
      if (!providerMap.has(row.providerSlug)) {
        providerMap.set(row.providerSlug, {
          slug: row.providerSlug,
          name: row.providerName,
        });
      }
    }
    const providerList = Array.from(providerMap.values());

    const byTs = new Map<string, Record<string, number | string>>();
    for (const row of history) {
      const ts = row.recordedAt.slice(0, 10);
      const price = mode === 'input' ? row.newInputPrice : row.newOutputPrice;
      if (price == null) continue;
      const key = row.providerSlug;
      const existing = byTs.get(ts) ?? { ts };
      existing[key] = price;
      byTs.set(ts, existing);
    }

    const sorted = Array.from(byTs.values()).sort((a, b) =>
      String(a.ts).localeCompare(String(b.ts)),
    );

    const filledSeries: Record<string, number | string>[] = [];
    const lastSeen: Record<string, number> = {};
    for (const row of sorted) {
      const merged: Record<string, number | string> = { ts: row.ts };
      for (const p of providerList) {
        if (row[p.slug] != null) {
          lastSeen[p.slug] = row[p.slug] as number;
        }
        if (lastSeen[p.slug] != null) {
          merged[p.slug] = lastSeen[p.slug];
        }
      }
      filledSeries.push(merged);
    }

    return { providers: providerList, series: filledSeries };
  }, [history, mode]);

  if (history.length === 0 || providers.length === 0) {
    return (
      <div className="rounded-md border p-4 text-sm text-zinc-500">
        {isZh
          ? '这个模型暂无历史价格记录。新价格变动会在下一次 scraper 抓取后入库。'
          : 'No price history yet. New price changes will appear after the next scraper run.'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
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
        <span className="ml-auto text-xs text-zinc-500">
          {isZh
            ? `${history.length} 次变动 · ${providers.length} 个渠道`
            : `${history.length} changes · ${providers.length} channels`}
        </span>
      </div>

      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="ts" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              label={{
                value: isZh ? 'USD / 1M tokens' : 'USD / 1M tokens',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 11, fill: '#6b7280' },
              }}
            />
            <Tooltip
              contentStyle={{ fontSize: 12 }}
              formatter={(value) => (typeof value === 'number' ? value.toFixed(4) : String(value))}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {providers.map((p, i) => (
              <Line
                key={p.slug}
                type="monotone"
                dataKey={p.slug}
                name={p.name}
                stroke={COLORS[i % COLORS.length]}
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
