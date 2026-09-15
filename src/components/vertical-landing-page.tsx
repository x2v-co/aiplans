import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import SiteHeader from '@/components/SiteHeader';
import type { AiVerticalKind } from '@/lib/ai-verticals';
import { verticalPageCopy } from '@/lib/ai-verticals';

const CTA_LINKS: Record<AiVerticalKind, { primary: string; secondary: string }> = {
  agent: { primary: '/plans', secondary: '/compare/models' },
  'creative-plan': { primary: '/plans', secondary: '/video-models' },
  'video-model': { primary: '/api-pricing', secondary: '/creative-plans' },
  'music-model': { primary: '/creative-plans', secondary: '/video-models' },
  'world-model': { primary: '/video-models', secondary: '/compare/models' },
};

export default function VerticalLandingPage({ locale, kind }: { locale: string; kind: AiVerticalKind }) {
  const copy = verticalPageCopy(kind, locale);
  const links = CTA_LINKS[kind];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <SiteHeader locale={locale} />
      <main className="container mx-auto px-4 py-14">
        <section className="mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-4">{copy.eyebrow}</Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{copy.title}</h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            {copy.description}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={`/${locale}${links.primary}`}>
              <Button size="lg" className="gap-2">
                {copy.primaryCta}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href={`/${locale}${links.secondary}`}>
              <Button size="lg" variant="outline">{copy.secondaryCta}</Button>
            </Link>
          </div>
        </section>

        <section className="mt-16" aria-labelledby={`${kind}-cards-heading`}>
          <div className="mb-8 max-w-3xl">
            <h2 id={`${kind}-cards-heading`} className="text-2xl font-bold">{copy.cardsTitle}</h2>
            <p className="mt-3 leading-7 text-zinc-600 dark:text-zinc-400">{copy.cardsDescription}</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {copy.cards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title} className="h-full">
                  <CardContent className="flex h-full flex-col p-6">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold">{card.title}</h3>
                    <p className="mt-3 flex-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{card.description}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {card.tags.map((tag) => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mt-16" aria-labelledby={`${kind}-examples-heading`}>
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 id={`${kind}-examples-heading`} className="text-2xl font-bold">{copy.examplesTitle}</h2>
            <Badge variant="outline">{copy.examples.length}</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {copy.examples.map((example) => (
              <Card key={`${example.provider}-${example.name}`} className="h-full">
                <CardContent className="flex h-full flex-col p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{example.provider}</p>
                  <h3 className="mt-1 text-lg font-bold">{example.name}</h3>
                  <p className="mt-3 flex-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{example.note}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {example.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-2xl font-bold">{copy.metricsTitle}</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {copy.metrics.map((metric) => (
                  <div key={metric} className="flex gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{metric}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/20">
            <CardContent className="p-6">
              <h2 className="text-2xl font-bold">{copy.noteTitle}</h2>
              <p className="mt-4 leading-7 text-zinc-700 dark:text-zinc-300">{copy.note}</p>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
