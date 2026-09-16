import type { Metadata } from 'next';
import { buildMetadata, breadcrumbList, faqPage, jsonLd, SITE_URL, type Locale } from '@/lib/seo';
import { getCodingAgentLeaderboard } from '@/lib/coding-agents';
import CodingAgentsView from './coding-agents-view';

const FAQS = {
  en: [
    {
      question: 'What is the Artificial Analysis Coding Agent Index?',
      answer: 'A composite score for coding agents (Claude Code, Codex, Devin Fusion CLI and others) running real software-engineering tasks. It is the equal-weight average of pass@1 on three suites: DeepSWE v1.1 (113 tasks), Terminal-Bench 4.0 (66 tasks) and SWE-Atlas-QnA (124 tasks), with three attempts per task.',
    },
    {
      question: 'Why does cost per task vary so much between agents?',
      answer: 'Cost per task is measured API spend — actual token consumption multiplied by the host model\'s token prices. Agents that use long-context reasoning or take more steps (such as Claude Code on Fable 5.1) can cost 50x more per task than efficient combinations like Codex on DeepSeek V4, even when their index scores are close.',
    },
    {
      question: 'Does the same model score the same in every agent?',
      answer: 'No. The harness matters: the same host model (for example Fable 5.1 or GPT-6 Astra) achieves different index scores, costs and runtimes in Claude Code, Codex or Devin Fusion CLI. Each row on this page is one agent × model configuration, not a model-only score.',
    },
    {
      question: 'How often is this leaderboard updated?',
      answer: 'Artificial Analysis re-runs evaluations as agents and models ship new versions; aiplans.dev syncs the public snapshot nightly and shows the snapshot date at the top of the table.',
    },
  ],
  zh: [
    {
      question: '什么是 Artificial Analysis 编程智能体指数？',
      answer: '这是 Claude Code、Codex、Devin Fusion CLI 等编程智能体在真实软件工程任务上的综合分。三项基准等权平均：DeepSWE v1.1（113 个任务）、Terminal-Bench 4.0（66 个任务）与 SWE-Atlas-QnA（124 个任务），每个任务跑三遍取 pass@1。',
    },
    {
      question: '为什么不同智能体每任务成本差这么多？',
      answer: '每任务成本按实测 token 用量 × 承载模型的 token 报价计算。使用长上下文推理或步骤更多的智能体（如 Fable 5.1 上的 Claude Code）每任务成本可能是 Codex + DeepSeek V4 这类高效组合的 50 倍，即使两者指数接近。',
    },
    {
      question: '同一个模型在不同智能体里分数一样吗？',
      answer: '不一样。Harness 本身影响结果：同一个承载模型（如 Fable 5.1、GPT-6 Astra）在 Claude Code、Codex、Devin Fusion CLI 中的指数、成本和耗时都不同。本表每一行是一个「智能体 × 模型」配置，不是单纯模型分。',
    },
    {
      question: '榜单多久更新？',
      answer: 'Artificial Analysis 会随智能体和模型新版本持续重跑评测；aiplans.dev 每晚同步公开快照，并在表格顶部显示快照日期。',
    },
  ],
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: '/coding-agents',
    title: {
      en: 'Coding Agent Leaderboard 2026 · Claude Code vs Codex, Cost per Task | aiplans.dev',
      zh: '2026 编程智能体排行榜 · Claude Code 对比 Codex、每任务成本 | aiplans.dev',
    },
    description: {
      en: 'Compare coding agents on the Artificial Analysis Coding Agent Index: Claude Code, Codex, Devin Fusion CLI and more, with DeepSWE, Terminal-Bench and SWE-Atlas scores plus cost and runtime per task.',
      zh: '按 Artificial Analysis 编程智能体指数对比 Claude Code、Codex、Devin Fusion CLI 等编程智能体，含 DeepSWE、Terminal-Bench、SWE-Atlas 分数及每任务成本与耗时。',
    },
  });
}

export default async function CodingAgentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isZh = locale === 'zh';
  const loc = (isZh ? 'zh' : 'en') as Locale;
  const leaderboard = await getCodingAgentLeaderboard();

  const crumbs = breadcrumbList([
    { name: isZh ? '首页' : 'Home', url: `${SITE_URL}/${locale}` },
    { name: isZh ? '编程智能体' : 'Coding agents', url: `${SITE_URL}/${locale}/coding-agents` },
  ]);

  const itemList = jsonLd({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Artificial Analysis Coding Agent Index ${leaderboard.indexVersion ?? ''}`.trim(),
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    numberOfItems: leaderboard.rows.length,
    itemListElement: leaderboard.rows.map((row, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: row.agentDisplayLabel,
      ...(row.modelSlug ? { url: `${SITE_URL}/${locale}/models/${row.modelSlug}` } : {}),
    })),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemList }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqPage(FAQS[loc]) }} />
      <CodingAgentsView
        locale={locale}
        rows={leaderboard.rows}
        indexVersion={leaderboard.indexVersion}
        sourceMaterializedAt={leaderboard.sourceMaterializedAt}
      />
    </>
  );
}
