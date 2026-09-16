import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { catalogForKind, type AiCatalogKind } from '@/lib/ai-vertical-catalog';

/**
 * Lightweight site-search index for the header command palette: one request
 * when the palette first opens, then all filtering/ranking runs client-side
 * via lib/search-match so typing stays instant. Only models with a live
 * detail target (an available channel or a plan) are included — the palette
 * must never link to a page that 404s or renders empty.
 */
export const dynamic = 'force-dynamic';

type ModelRow = { slug: string; name: string; provider_name: string | null; provider_slug: string | null };
type PlanRow = { id: number; name: string; provider_name: string; provider_slug: string };
type ProviderRow = { slug: string; name: string };

const STATIC_PAGE_DEFS: Array<{ slug: string; kind?: AiCatalogKind; title: string; zhTitle: string; baseKeywords: string[] }> = [
  { slug: 'models', title: 'General AI Models', zhTitle: '通用大模型', baseKeywords: ['models', 'llm', 'general models', 'gpt', 'claude', 'gemini'] },
  { slug: 'agents', kind: 'agent', title: 'AI Agent Plans', zhTitle: 'AI Agent 套餐', baseKeywords: ['agent', 'coding agent'] },
  { slug: 'creative-plans', kind: 'creative-plan', title: 'AI Creative Plans', zhTitle: 'AI 创作套餐', baseKeywords: ['creative', 'video plan', 'image plan', 'music plan'] },
  { slug: 'video-models', kind: 'video-model', title: 'AI Video Models', zhTitle: 'AI 视频模型', baseKeywords: ['video', 'text to video', 'image to video'] },
  { slug: 'compare/video-models', kind: 'video-model', title: 'Compare Video Models', zhTitle: '视频模型对比', baseKeywords: ['video compare', 'arena ai video', 'vbench'] },
  { slug: 'coding-agents', title: 'Coding Agent Leaderboard', zhTitle: '编程智能体排行榜', baseKeywords: ['coding agent', 'claude code', 'codex', 'devin', 'deepswe', 'terminal-bench', 'swe-atlas', 'cost per task'] },
  { slug: 'music-models', kind: 'music-model', title: 'AI Music Models', zhTitle: 'AI 音乐模型', baseKeywords: ['music', 'audio'] },
  { slug: 'world-models', kind: 'world-model', title: 'AI World Models', zhTitle: 'AI 世界模型', baseKeywords: ['world model', 'simulation'] },
];

const STATIC_PAGES = STATIC_PAGE_DEFS.map((page) => ({
  slug: page.slug,
  title: page.title,
  zhTitle: page.zhTitle,
  keywords: [
    ...page.baseKeywords,
    ...(page.kind ? catalogForKind(page.kind).flatMap((item) => [item.name, item.provider, ...item.capabilities]) : []),
  ],
}));

export async function GET() {
  try {
    const [models, plans, providers] = await Promise.all([
      sql<ModelRow[]>`
        SELECT m.slug, m.name,
               p.name AS provider_name,
               p.slug AS provider_slug
        FROM models m
        LEFT JOIN providers p ON p.id = m.provider_ids[1]
        WHERE m.type = 'llm'
          AND (
            EXISTS (
              SELECT 1 FROM api_channel_prices cp
              WHERE cp.model_id = m.id AND cp.is_available = true
            )
            OR EXISTS (
              SELECT 1 FROM model_plan_mapping mpm
              WHERE mpm.model_id = m.id AND mpm.plan_id IS NOT NULL
            )
          )
        ORDER BY m.name
      `,
      sql<PlanRow[]>`
        SELECT pl.id, pl.name,
               p.name AS provider_name,
               p.slug AS provider_slug
        FROM plans pl
        JOIN providers p ON p.id = pl.provider_id
        ORDER BY p.name, pl.name
      `,
      sql<ProviderRow[]>`
        SELECT slug, name
        FROM providers
        ORDER BY name
      `,
    ]);

    const payload = {
      models: models.map((m) => ({
        slug: m.slug,
        name: m.name,
        providerName: m.provider_name ?? null,
        providerSlug: m.provider_slug ?? null,
      })),
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        providerName: p.provider_name,
        providerSlug: p.provider_slug,
      })),
      providers: providers.map((p) => ({ slug: p.slug, name: p.name })),
      pages: STATIC_PAGES,
    };

    const response = NextResponse.json(payload);
    response.headers.set('Cache-Control', 'private, max-age=300');
    return response;
  } catch (error) {
    console.error('Error building search index:', error);
    return NextResponse.json({ error: 'Failed to build search index' }, { status: 500 });
  }
}
