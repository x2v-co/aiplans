import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import VerticalModelDetailPage from '@/components/vertical-model-detail-page';
import { NonLlmCatalog, nonLlmCopy } from '@/components/non-llm-catalog';
import { getVerticalModelCatalog } from '@/lib/vertical-models';
import { getVerticalModelDetail } from '@/lib/vertical-model-detail';
import { decodeSlugParam } from '@/lib/route-params';
import { buildMetadata, breadcrumbList, SITE_URL } from '@/lib/seo';

type Kind = 'voice-model' | 'image-model';
type Params = Promise<{ locale: string; slug?: string }>;
const copyKeys = (kind: Kind) => kind === 'voice-model' ? { title: 'voiceTitle', description: 'voiceDescription' } as const
  : { title: 'imageTitle', description: 'imageDescription' } as const;

export async function nonLlmMetadata(kind: Kind, params: Params): Promise<Metadata> {
  const { locale, slug: rawSlug } = await params;
  const slug = rawSlug == null ? undefined : decodeSlugParam(rawSlug);
  const item = slug == null ? undefined : (await getVerticalModelDetail(kind, slug)).item;
  const keys = copyKeys(kind);
  const title = (language: string) => `${item ? `${item.name} · ` : ''}${nonLlmCopy(language)[keys.title]} | aiplans.dev`;
  return buildMetadata({ locale: locale === 'zh' ? 'zh' : 'en', path: `/${kind}s${slug == null ? '' : `/${slug}`}`,
    title: { en: title('en'), zh: title('zh') },
    description: { en: nonLlmCopy('en')[keys.description], zh: nonLlmCopy('zh')[keys.description] } });
}

export async function NonLlmPage({ kind, params }: { kind: Kind; params: Params }) {
  const { locale, slug: rawSlug } = await params;
  const t = nonLlmCopy(locale);
  const keys = copyKeys(kind);
  const slug = rawSlug == null ? undefined : decodeSlugParam(rawSlug);
  const detail = slug == null ? undefined : await getVerticalModelDetail(kind, slug);
  const crumbs = breadcrumbList([
    { name: t[keys.title], url: `${SITE_URL}/${locale}/${kind}s` },
    ...(detail ? [{ name: detail.item.name, url: `${SITE_URL}/${locale}/${kind}s/${slug}` }] : []),
  ]);
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />
    {detail ? <VerticalModelDetailPage locale={locale} kind={kind} detail={detail} /> : <>
      <SiteHeader locale={locale} />
      <main className="container mx-auto px-4 py-14">
        <h1 className="text-4xl font-bold">{t[keys.title]}</h1><p className="mt-5">{t[keys.description]}</p>
        <NonLlmCatalog items={await getVerticalModelCatalog(kind)} locale={locale} /><p className="mt-6">{t.unknown}</p>
      </main>
    </>}
  </>;
}
