import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Building2 } from 'lucide-react';
import { ProviderLogo } from '@/components/provider-logo';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import SiteHeader from '@/components/SiteHeader';
import { buildProvidersIndexCopy, getProvidersForIndex } from '@/lib/providers-index';
import { buildMetadata, breadcrumbList, jsonLd, SITE_URL, type Locale } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const providers = await getProvidersForIndex();
  const en = buildProvidersIndexCopy('en', providers.length);
  const zh = buildProvidersIndexCopy('zh', providers.length);
  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: '/providers',
    title: { en: en.title, zh: zh.title },
    description: { en: en.description, zh: zh.description },
  });
}

export default async function ProvidersIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const loc = (locale === 'zh' ? 'zh' : 'en') as Locale;
  const isZh = loc === 'zh';
  const providers = await getProvidersForIndex();
  const copy = buildProvidersIndexCopy(loc, providers.length);

  const breadcrumbJson = breadcrumbList([
    { name: isZh ? '首页' : 'Home', url: `${SITE_URL}/${locale}` },
    { name: copy.breadcrumb, url: `${SITE_URL}/${locale}/providers` },
  ]);
  const itemListJson = jsonLd({
    '@type': 'ItemList',
    name: copy.heading,
    numberOfItems: providers.length,
    itemListElement: providers.slice(0, 50).map((provider, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${SITE_URL}/${locale}/providers/${encodeURIComponent(provider.slug)}`,
      name: provider.name,
    })),
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJson }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJson }} />
      <SiteHeader locale={locale} />

      <main className="container mx-auto px-4 py-12">
        <section className="mx-auto mb-12 max-w-4xl text-center">
          <Badge variant="secondary" className="mb-4">{isZh ? '供应商目录' : 'Provider catalog'}</Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{copy.heading}</h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            {copy.intro}
          </p>
        </section>

        <section aria-labelledby="providers-list-heading">
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-500" />
            <h2 id="providers-list-heading" className="text-2xl font-bold">{copy.listHeading}</h2>
            <Badge variant="outline">{providers.length}</Badge>
          </div>

          {providers.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {providers.map((provider) => (
                <Link
                  key={provider.id}
                  href={`/${locale}/providers/${encodeURIComponent(provider.slug)}`}
                  className="group block h-full"
                >
                  <Card className="flex h-full flex-col transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:hover:border-blue-800 dark:hover:bg-blue-950/20">
                    <CardContent className="flex flex-1 flex-col p-6">
                      <div className="mb-4 flex items-start gap-4">
                        <ProviderLogo provider={provider} size={56} className="rounded-lg" />
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-xl font-bold group-hover:text-blue-600">{provider.name}</h3>
                          {provider.region === 'china' && (
                            <Badge variant="secondary" className="mt-1 text-xs">
                              🇨🇳 {isZh ? '国内' : 'China'}
                            </Badge>
                          )}
                        </div>
                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-1 group-hover:text-blue-600" />
                      </div>

                      {provider.description && (
                        <p className="mb-4 line-clamp-2 text-sm text-zinc-500">{provider.description}</p>
                      )}

                      <div className="mt-auto flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-sm">
                          {copy.modelCount(provider.model_count)}
                        </Badge>
                        <span className="text-sm font-medium text-blue-600">{copy.viewProvider}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-zinc-500">{copy.empty}</p>
              </CardContent>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}
