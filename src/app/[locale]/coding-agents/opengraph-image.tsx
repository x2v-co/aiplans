import { ImageResponse } from 'next/og';
import { ogTemplate, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-template';
import { getCodingAgentLeaderboard } from '@/lib/coding-agents';
import { formatIndexScore } from '@/lib/coding-agents-format';

export const alt = 'Coding Agent Leaderboard — aiplans.dev';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isZh = locale === 'zh';
  const leaderboard = await getCodingAgentLeaderboard();
  const top = leaderboard.rows[0];

  return new ImageResponse(
    ogTemplate({
      kicker: isZh ? '编程智能体' : 'Coding Agents',
      title: isZh ? '编程智能体排行榜' : 'Coding Agent Leaderboard',
      subtitle: isZh
        ? 'Claude Code、Codex、Devin 等智能体在真实软件工程任务上的表现、成本与耗时'
        : 'Claude Code, Codex, Devin and more: performance, cost and runtime on real engineering tasks',
      stats: [
        { label: isZh ? '参评配置' : 'Configs', value: String(leaderboard.rows.length || '—') },
        {
          label: isZh ? '榜首' : 'Top agent',
          value: top ? `${top.agentName} ${formatIndexScore(top.indexScore, 'en')}` : '—',
        },
        { label: isZh ? '指数版本' : 'Index', value: leaderboard.indexVersion ?? '—' },
      ],
      locale: isZh ? 'zh' : 'en',
    }),
    size,
  );
}
