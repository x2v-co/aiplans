import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, BadgeCheck, Gift, Mail, ShieldCheck, SquarePen } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildMetadata, breadcrumbList, faqPage, jsonLd, SITE_URL, type Locale } from '@/lib/seo';

const ISSUE_URL = 'https://github.com/x2v-co/aiplans/issues/new?template=provider-listing.yml';
const CONTACT_EMAIL = 'contact@aiplans.dev';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: '/submit-provider',
    title: {
      en: 'Submit an AI Provider or Exclusive Offer | aiplans.dev',
      zh: '提交 AI 供应商或专属优惠 | aiplans.dev',
    },
    description: {
      en: 'Share a provider pricing API, model endpoint, public JSON, or exclusive discount so aiplans.dev can list and update your data accurately.',
      zh: '提交供应商价格 API、模型接口、公开 JSON 或专属优惠，帮助 aiplans.dev 准确收录并自动更新数据。',
    },
  });
}

const fields = {
  en: [
    'Preferred: pricing API, models API, public JSON, OpenAPI spec, or stable docs endpoint',
    'Auth and rate-limit notes if the endpoint is not public',
    'Registration or invite URL for users',
    'Official contact for future pricing/model verification',
    'Manual model and pricing details only when no data source exists',
    'Optional exclusive offer for aiplans.dev users',
  ],
  zh: [
    '优先提供：价格 API、模型 API、公开 JSON、OpenAPI spec 或稳定文档接口',
    '如果接口非公开，请说明鉴权方式和频率限制',
    '用户注册入口或邀请链接',
    '用于后续价格/模型校验的官方联系方式',
    '只有没有数据源时，才需要人工填写模型和价格细节',
    '可选的 aiplans.dev 用户专属优惠',
  ],
};

const offerExamples = {
  en: ['Coupon code AIPLANS', 'Free credits for new users', 'First top-up discount', 'Long-term recharge bonus', 'Enterprise discount or contact-sales route'],
  zh: ['优惠码 AIPLANS', '新用户赠送额度', '首充折扣', '长期充值返利', '企业折扣或专属销售入口'],
};

export default async function SubmitProviderPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isZh = locale === 'zh';
  const pageUrl = `${SITE_URL}/${locale}/submit-provider`;
  const mailSubject = encodeURIComponent(isZh ? '提交供应商收录信息 - aiplans.dev' : 'Provider listing request - aiplans.dev');
  const mailHref = `mailto:${CONTACT_EMAIL}?subject=${mailSubject}`;

  const breadcrumbJson = breadcrumbList([
    { name: isZh ? '首页' : 'Home', url: `${SITE_URL}/${locale}` },
    { name: isZh ? '提交供应商' : 'Submit provider', url: pageUrl },
  ]);
  const faqJson = faqPage([
    {
      question: isZh ? '收录是否需要付费？' : 'Is listing paid?',
      answer: isZh
        ? '不需要。aiplans.dev 会基于公开或可验证信息进行中立收录。专属优惠、赞助或联盟链接会单独标识，不影响价格比较的透明性。'
        : 'No. aiplans.dev lists providers from public or verifiable information. Exclusive offers, sponsorships, and affiliate links are labeled separately and do not change neutral price comparisons.',
    },
    {
      question: isZh ? '提交后多久上线？' : 'How long does review take?',
      answer: isZh
        ? '取决于信息完整度。最容易处理的是可机器读取的数据源，例如价格 API、模型 API、公开 JSON 或稳定文档接口；没有数据源时再人工提交模型和价格。'
        : 'It depends on completeness. Machine-readable sources such as pricing APIs, model APIs, public JSON, or stable docs endpoints are easiest to review; manual model and price fields are the fallback.',
    },
  ]);
  const webPageJson = jsonLd({
    '@type': 'WebPage',
    name: isZh ? '提交 AI 供应商或专属优惠' : 'Submit an AI provider or exclusive offer',
    url: pageUrl,
    description: isZh
      ? '提交 AI API 供应商数据源、模型价格和专属优惠，帮助 aiplans.dev 保持价格数据准确并可持续更新。'
      : 'Submit AI API provider data sources, model pricing, and exclusive offers to help keep aiplans.dev accurate and continuously updated.',
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJson }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJson }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: webPageJson }} />
      <SiteHeader locale={locale} />

      <main className="container mx-auto px-4 py-12">
        <section className="mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-4">
            {isZh ? '供应商与优惠提交' : 'Provider and deal submissions'}
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            {isZh ? '提交 AI 供应商数据源、价格或专属优惠' : 'Submit a provider data source, pricing update, or exclusive offer'}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            {isZh
              ? 'aiplans.dev 帮助开发者比较同一模型在官方、云厂商、聚合平台和转售渠道中的价格。欢迎供应商优先提供可抓取的数据源，帮助我们准确收录并持续更新模型、价格、地区可用性和优惠。'
              : 'aiplans.dev helps developers compare the same model across official, cloud, aggregator, and reseller channels. Providers can share machine-readable data sources first, so we can list and update models, prices, regions, and deals accurately.'}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <a href={ISSUE_URL} target="_blank" rel="noopener noreferrer">
                <SquarePen className="h-4 w-4" />
                {isZh ? '提交 GitHub Issue' : 'Open GitHub issue'}
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={mailHref}>
                <Mail className="h-4 w-4" />
                {isZh ? '邮件提交' : 'Submit by email'}
              </a>
            </Button>
          </div>
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BadgeCheck className="h-5 w-5 text-blue-600" />
                {isZh ? '免费中立收录' : 'Neutral listing'}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {isZh
                ? '收录不等于付费排名。我们会基于公开或可验证信息展示价格、模型覆盖和可用性。'
                : 'Listing is not paid ranking. We display pricing, model coverage, and availability from public or verifiable sources.'}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Gift className="h-5 w-5 text-blue-600" />
                {isZh ? '专属优惠展示' : 'Exclusive offer display'}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {isZh
                ? '如果提供专属优惠，我们可以在供应商页和优惠区展示，并标记优惠条件和验证状态。'
                : 'If you provide an exclusive offer, we can show it on provider pages and deal sections with terms and verification status.'}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                {isZh ? '可持续校验' : 'Ongoing verification'}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {isZh
                ? '最理想的是接入你们的价格 API、模型 API 或公开 JSON。后续价格或模型变化即可自动更新，并保留最后验证时间。'
                : 'The best path is a pricing API, models API, or public JSON. Future model or price changes can then update automatically, with last-verified timestamps where possible.'}
            </CardContent>
          </Card>
        </section>

        <section className="mt-12 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>{isZh ? '优先提供数据源' : 'Prefer data sources'}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                {fields[isZh ? 'zh' : 'en'].map((field) => (
                  <li key={field} className="flex gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-blue-600" aria-hidden="true" />
                    <span>{field}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{isZh ? '优惠形式示例' : 'Offer examples'}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
                {offerExamples[isZh ? 'zh' : 'en'].map((offer) => (
                  <li key={offer} className="flex items-start gap-2">
                    <Gift className="mt-0.5 h-4 w-4 text-blue-600" />
                    <span>{offer}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 rounded-lg bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
                {isZh
                  ? '推荐优惠码：AIPLANS。也可以使用你们已有的归因链接或优惠码。'
                  : 'Recommended code: AIPLANS. Existing tracking links or coupon codes are also fine.'}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-12 rounded-2xl border bg-white p-6 shadow-sm dark:bg-zinc-950">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">{isZh ? '已经被收录？' : 'Already listed?'}</h2>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                {isZh
                  ? '如果你代表某个已收录供应商，可以提交更新、认领联系方式，或补充专属优惠。'
                  : 'If you represent a listed provider, submit updates, claim the contact, or add an exclusive offer.'}
              </p>
            </div>
            <Link href={`/${locale}/plans`} className="inline-flex items-center text-sm font-medium text-blue-600 hover:underline">
              {isZh ? '查看供应商列表' : 'Browse providers'} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
