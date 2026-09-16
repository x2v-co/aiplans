import Link from 'next/link';
import { Bot } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  formatIndexScore,
  formatTaskCost,
  formatTaskTime,
  type CodingAgentRow,
} from '@/lib/coding-agents-format';

/**
 * Harness-level coding-agent results for one host model. The same model can
 * appear under multiple agents (e.g. Fable 5.1 in Claude Code and Devin
 * Fusion CLI), so rows are agent configurations, not model scores.
 */
export default function CodingAgentModelSection({ rows, locale }: { rows: CodingAgentRow[]; locale: string }) {
  const isZh = locale === 'zh';
  if (rows.length === 0) return null;

  return (
    <section className="mb-8" aria-labelledby="coding-agents-heading">
      <div className="mb-4">
        <h2 id="coding-agents-heading" className="flex items-center gap-2 text-2xl font-bold">
          <Bot className="h-5 w-5 text-blue-600" />
          {isZh ? '编程智能体表现' : 'Coding agent performance'}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {isZh
            ? 'Artificial Analysis Coding Agent Index：同一模型在不同智能体（Claude Code、Codex 等）中的每任务表现、API 成本与耗时，按智能体配置分别评测。'
            : 'Artificial Analysis Coding Agent Index: per-task performance, API cost and runtime when this model runs inside different agents (Claude Code, Codex, …). Each configuration is evaluated separately.'}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <Card key={`${row.agentName}-${row.hostModelSlug}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm leading-5">{row.agentName}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{formatIndexScore(row.indexScore, locale)}</div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-zinc-500">
                <span>{isZh ? '每任务' : 'Cost/task'}: <span className="tabular-nums text-zinc-700 dark:text-zinc-300">{formatTaskCost(row.costPerTaskUsd, locale)}</span></span>
                <span>{isZh ? '耗时' : 'Time/task'}: <span className="tabular-nums text-zinc-700 dark:text-zinc-300">{formatTaskTime(row.wallTimePerTaskSec, locale)}</span></span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-3 text-sm">
        <Link href={`/${locale}/coding-agents`} className="text-blue-600 hover:underline dark:text-blue-400">
          {isZh ? '查看完整编程智能体排行榜 →' : 'View the full coding agent leaderboard →'}
        </Link>
      </div>
    </section>
  );
}
