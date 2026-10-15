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
    {detail ? <VerticalModelDetailPage locale={locale} kind={kind} detail={detail} /> : <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <SiteHeader locale={locale} />
      <main className="container mx-auto px-4 py-14">
        <section className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t[keys.title]}</h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">{t[keys.description]}</p>
        </section>
        {await (async () => {
          const items = await getVerticalModelCatalog(kind);
          return <section className="mt-12">
            <div className="flex items-end justify-between gap-4">
              <p className="text-sm text-zinc-500">{t.unknown}</p>
              <span className="shrink-0 rounded-full border px-2.5 py-0.5 text-sm font-medium">{items.length}</span>
            </div>
            <NonLlmCatalog items={items} locale={locale} />
          </section>;
        })()}
      </main>
    </div>}
  </>;
}
