import type { Metadata } from 'next';
import VerticalLandingPage from '@/components/vertical-landing-page';
import { buildMetadata, breadcrumbList, SITE_URL, type Locale } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: '/agents',
    title: {
      en: 'AI Agent Plans Compared · Devin, Claude Code, Codex | aiplans.dev',
      zh: 'AI Agent 套餐对比 · Devin、Claude Code、Codex | aiplans.dev',
    },
    description: {
      en: 'Compare AI agent and coding agent plans by monthly price, credits, concurrency, browser access, filesystem access, code execution and approval controls.',
      zh: '按月费、credits、并发、浏览器访问、文件系统、代码执行和审批控制对比 AI Agent 与 Coding Agent 套餐。',
    },
  });
}

export default async function AgentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isZh = locale === 'zh';
  const crumbs = breadcrumbList([
    { name: isZh ? '首页' : 'Home', url: `${SITE_URL}/${locale}` },
    { name: isZh ? 'Agent 套餐' : 'Agent Plans', url: `${SITE_URL}/${locale}/agents` },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />
      <VerticalLandingPage locale={locale} kind="agent" />
    </>
  );
}
