'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  formatIndexScore,
  formatTaskCost,
  formatTaskTime,
  type CodingAgentRow,
} from '@/lib/coding-agents-format';

type SortKey = 'index' | 'deepswe' | 'terminalbench' | 'sweatlas' | 'cost' | 'time';

const SOURCE_LEADERBOARD = 'https://artificialanalysis.ai/agents/coding-agents';
const SOURCE_METHODOLOGY = 'https://artificialanalysis.ai/methodology/coding-agents-benchmarking';

export default function CodingAgentsView({
  locale,
  rows,
  indexVersion,
  sourceMaterializedAt,
}: {
  locale: string;
  rows: CodingAgentRow[];
  indexVersion: string | null;
  sourceMaterializedAt: string | null;
}) {
  const isZh = locale === 'zh';
  const [sortKey, setSortKey] = useState<SortKey>('index');

  const sorted = useMemo(() => {
    // Scores rank high→low; cost and time rank low→high.
    const ascending = sortKey === 'cost' || sortKey === 'time';
    const value = (row: CodingAgentRow): number => {
      switch (sortKey) {
        case 'deepswe': return row.deepsweScore ?? -1;
        case 'terminalbench': return row.terminalbenchScore ?? -1;
        case 'sweatlas': return row.sweatlasScore ?? -1;
        case 'cost': return row.costPerTaskUsd ?? Number.POSITIVE_INFINITY;
        case 'time': return row.wallTimePerTaskSec ?? Number.POSITIVE_INFINITY;
        default: return row.indexScore;
      }
    };
    return [...rows].sort((a, b) => {
      const diff = ascending ? value(a) - value(b) : value(b) - value(a);
      return diff !== 0 ? diff : a.agentDisplayLabel.localeCompare(b.agentDisplayLabel);
    });
  }, [rows, sortKey]);

  const bestIndex = rows.reduce((max, row) => Math.max(max, row.indexScore), 0);
  const snapshotDate = sourceMaterializedAt ? sourceMaterializedAt.slice(0, 10) : null;

  const copy = {
    title: isZh ? '编程智能体排行榜' : 'Coding Agent Leaderboard',
    subtitle: isZh
      ? '真实软件工程任务中的智能体表现、每任务 API 成本与执行时间'
      : 'How coding agents perform on real software-engineering tasks, with API cost and runtime per task',
    indexCol: isZh ? '指数' : 'Index',
    costCol: isZh ? '每任务成本' : 'Cost / task',
    timeCol: isZh ? '每任务耗时' : 'Time / task',
    modelCol: isZh ? '智能体 / 模型' : 'Agent / model',
    rankCol: '#',
    sort: isZh ? '排序' : 'Sort',
    sortOptions: {
      index: isZh ? '综合指数（高→低）' : 'Coding Agent Index (high → low)',
      deepswe: 'DeepSWE v1.1',
      terminalbench: 'Terminal-Bench 4.0',
      sweatlas: 'SWE-Atlas-QnA',
      cost: isZh ? '每任务成本（低→高）' : 'Cost / task (low → high)',
      time: isZh ? '每任务耗时（短→长）' : 'Time / task (fast → slow)',
    },
    explainerTitle: isZh ? '指数如何构成' : 'How the index is built',
    explainer: isZh
      ? 'Artificial Analysis 让每个智能体在三个基准上各跑三遍取 pass@1：DeepSWE v1.1（113 个软件工程任务）、Terminal-Bench 4.0（66 个终端任务）与 SWE-Atlas-QnA（124 个技术问答）。综合指数为三项等权平均。成本按供应商 token 报价 × 实测 token 用量计算，不含订阅套餐。'
      : 'Each agent runs three attempts per task across three suites — DeepSWE v1.1 (113 software-engineering tasks), Terminal-Bench 4.0 (66 terminal tasks) and SWE-Atlas-QnA (124 technical Q&A tasks) — scored as pass@1. The index is their equal-weight average. Cost is measured token usage × provider token prices, not subscription plans.',
    empty: isZh
      ? '榜单数据尚未导入。每晚的抓取任务会从 Artificial Analysis 同步最新快照。'
      : 'Leaderboard data has not been imported yet. The nightly job syncs the latest snapshot from Artificial Analysis.',
    plansCta: isZh ? '对比这些智能体的订阅套餐' : 'Compare subscription plans for these agents',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <SiteHeader locale={locale} />
      <main className="container mx-auto max-w-6xl px-4 pt-10 pb-20">
        <nav className="mb-3 text-xs text-zinc-500">
          <Link href={`/${locale}`} className="hover:text-zinc-800 dark:hover:text-zinc-200">{isZh ? '首页' : 'Home'}</Link>
          <span className="mx-1.5">/</span>
          <span>{isZh ? '编程智能体' : 'Coding agents'}</span>
        </nav>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{copy.title}</h1>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">{copy.subtitle}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
          {indexVersion && <Badge variant="outline">Coding Agent Index {indexVersion}</Badge>}
          {snapshotDate && <span>{isZh ? '快照日期' : 'Snapshot'}: {snapshotDate}</span>}
        </div>

        {rows.length === 0 ? (
          <Card className="mt-8"><CardContent className="py-12 text-center text-zinc-500">{copy.empty}</CardContent></Card>
        ) : (
          <>
            <div className="mt-6 flex items-center justify-end gap-2">
              <span className="text-sm text-zinc-500">{copy.sort}</span>
              <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
                <SelectTrigger className="w-[260px]" aria-label={copy.sort}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(copy.sortOptions) as SortKey[]).map((key) => (
                    <SelectItem key={key} value={key}>{copy.sortOptions[key]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card className="mt-3 overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableHead className="w-10 text-right">{copy.rankCol}</TableHead>
                      <TableHead>{copy.modelCol}</TableHead>
                      <TableHead className="text-right">{copy.indexCol}</TableHead>
                      <TableHead className="hidden text-right md:table-cell">DeepSWE</TableHead>
                      <TableHead className="hidden text-right lg:table-cell">Terminal-Bench</TableHead>
                      <TableHead className="hidden text-right lg:table-cell">SWE-Atlas</TableHead>
                      <TableHead className="text-right">{copy.costCol}</TableHead>
                      <TableHead className="text-right">{copy.timeCol}</TableHead>
                    </TableHeader>
                    <TableBody>
                      {sorted.map((row, index) => {
                        const modelLabel = row.modelName ?? row.agentDisplayLabel.replace(/^[^-]+-\s*/, '');
                        return (
                          <TableRow key={row.hostModelSlug + row.agentName} className={index === 0 && sortKey === 'index' ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}>
                            <TableCell className="text-right text-zinc-500">{index + 1}</TableCell>
                            <TableCell>
                              <div className="font-medium text-zinc-900 dark:text-zinc-100">{row.agentName}</div>
                              <div className="text-xs text-zinc-500">
                                {row.modelSlug ? (
                                  <Link href={`/${locale}/models/${row.modelSlug}`} className="text-blue-600 hover:underline dark:text-blue-400">
                                    {modelLabel}
                                  </Link>
                                ) : modelLabel}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5">
                                {formatIndexScore(row.indexScore, locale)}
                                {row.indexScore === bestIndex && sortKey === 'index' && (
                                  <Badge className="bg-emerald-600 hover:bg-emerald-600">{isZh ? '最佳' : 'Best'}</Badge>
                                )}
                              </span>
                            </TableCell>
                            <TableCell className="hidden text-right tabular-nums text-zinc-600 dark:text-zinc-400 md:table-cell">
                              {row.deepsweScore != null ? formatIndexScore(row.deepsweScore, locale) : '—'}
                            </TableCell>
                            <TableCell className="hidden text-right tabular-nums text-zinc-600 dark:text-zinc-400 lg:table-cell">
                              {row.terminalbenchScore != null ? formatIndexScore(row.terminalbenchScore, locale) : '—'}
                            </TableCell>
                            <TableCell className="hidden text-right tabular-nums text-zinc-600 dark:text-zinc-400 lg:table-cell">
                              {row.sweatlasScore != null ? formatIndexScore(row.sweatlasScore, locale) : '—'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatTaskCost(row.costPerTaskUsd, locale)}</TableCell>
                            <TableCell className="text-right tabular-nums text-zinc-600 dark:text-zinc-400">{formatTaskTime(row.wallTimePerTaskSec, locale)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-8">
              <CardContent className="py-6">
                <h2 className="text-base font-semibold">{copy.explainerTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{copy.explainer}</p>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <a href={SOURCE_LEADERBOARD} target="_blank" rel="noreferrer"
                     className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400">
                    Artificial Analysis <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <a href={SOURCE_METHODOLOGY} target="_blank" rel="noreferrer"
                     className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400">
                    {isZh ? '方法论' : 'Methodology'} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <Link href={`/${locale}/agents`} className="text-blue-600 hover:underline dark:text-blue-400">
                    {copy.plansCta} →
                  </Link>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
