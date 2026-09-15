import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AiCatalogKind } from '@/lib/ai-vertical-catalog';
import type { VerticalModelDetail } from '@/lib/vertical-model-detail';
import { verticalKindPath } from '@/lib/vertical-model-detail';

function formatMoney(value: number | null, currency: string | null): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: value < 1 ? 4 : 2,
  }).format(value);
}

export default function VerticalModelDetailPage({
  locale,
  kind,
  detail,
}: {
  locale: string;
  kind: AiCatalogKind;
  detail: VerticalModelDetail;
}) {
  const isZh = locale === 'zh';
  const { item, plans, usagePrices } = detail;
  const parentPath = verticalKindPath(kind);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <SiteHeader locale={locale} />
      <main className="container mx-auto px-4 py-10">
        <Link href={`/${locale}/${parentPath}`} className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100">
          <ArrowLeft className="h-4 w-4" />
          {isZh ? '返回列表' : 'Back to list'}
        </Link>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{item.modelCategory}</Badge>
              <Badge variant={item.status === 'available' ? 'secondary' : 'outline'}>{item.status}</Badge>
              <Badge variant="outline">{item.pricingConfidence}</Badge>
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">{item.name}</h1>
            <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">{item.provider}</p>
            <p className="mt-6 max-w-3xl leading-8 text-zinc-700 dark:text-zinc-300">{item.bestFor}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {item.url && (
                <a href={item.url} target="_blank" rel="noreferrer">
                  <Button className="gap-2">
                    {isZh ? '打开官方页面' : 'Open official page'}
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              )}
              {item.sourceUrls?.map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="gap-2">
                    {source.label}
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              ))}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{isZh ? '数据口径' : 'Data basis'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <div className="text-zinc-500">{isZh ? '输入 → 输出' : 'Input → Output'}</div>
                <div className="mt-1 font-medium">{item.inputModalities?.join(', ')} → {item.outputModalities?.join(', ')}</div>
              </div>
              <div>
                <div className="text-zinc-500">{isZh ? '计价单位' : 'Pricing unit'}</div>
                <div className="mt-1 font-medium">{item.pricingUnit ?? item.unit}</div>
              </div>
              <div>
                <div className="text-zinc-500">{isZh ? '访问方式' : 'Access'}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.access?.map((access) => <Badge key={access} variant="secondary">{access}</Badge>)}
                </div>
              </div>
              <div>
                <div className="text-zinc-500">{isZh ? '最后核验' : 'Last verified'}</div>
                <div className="mt-1 font-medium">{item.lastVerified ?? '—'}</div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{isZh ? '能力标签' : 'Capabilities'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {item.capabilities.map((capability) => (
                  <Badge key={capability} variant="outline">{capability}</Badge>
                ))}
              </div>
              {item.notes && <p className="mt-5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{item.notes}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{isZh ? '价格与套餐状态' : 'Pricing and plans status'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
              <p>
                {item.pricing}
              </p>
              <p className="text-zinc-500">
                {isZh
                  ? '说明：多模态模型的计费可能是秒、次、积分、分钟、套餐额度或企业合同，不会强行换算成 token 价格。只有来源可验证时才写入下方表格。'
                  : 'Note: multimodal pricing can be seconds, generations, credits, minutes, plan allowances or enterprise contracts. It is not forced into token pricing; only verified source-backed rows appear below.'}
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{isZh ? '价格来源与用量单位' : 'Pricing sources and usage units'}</CardTitle>
            </CardHeader>
            <CardContent>
              {usagePrices.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  {isZh ? '暂无结构化价格来源行；当前只展示官方计价单位和顶部来源链接。' : 'No structured pricing reference row yet; showing official pricing unit and source links above.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {usagePrices.map((price) => (
                    <div key={price.id} className="rounded-lg border p-3 text-sm">
                      <div className="font-semibold">
                        {price.price_kind}: {price.price == null ? (isZh ? '见官方来源' : 'See official source') : formatMoney(price.price, price.currency)} / {price.unit}
                      </div>
                      <div className="mt-1 text-zinc-500">{price.provider_name}{price.plan_name ? ` · ${price.plan_name}` : ''}</div>
                      {price.source_url && <a className="mt-1 inline-block text-blue-600 hover:underline" href={price.source_url} target="_blank" rel="noreferrer">{isZh ? '价格来源' : 'Price source'}</a>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{isZh ? '相关套餐' : 'Related plans'}</CardTitle>
            </CardHeader>
            <CardContent>
              {plans.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  {isZh ? '暂无已映射套餐。下一步会把 Runway、Kling、Pika、Luma、Suno、Udio 等套餐写入 plans。' : 'No mapped plan yet. Next step is to materialize plans for Runway, Kling, Pika, Luma, Suno, Udio and similar providers.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {plans.map((plan) => (
                    <div key={plan.id} className="rounded-lg border p-3 text-sm">
                      <div className="font-semibold">{plan.name}</div>
                      <div className="mt-1 text-zinc-500">{plan.provider_name} · {plan.tier ?? 'plan'}</div>
                      <div className="mt-1">
                        {plan.is_contact_sales
                          ? (isZh ? '联系销售' : 'Contact sales')
                          : plan.price == null
                            ? (isZh ? '见官方价格来源' : 'See official pricing source')
                            : `${formatMoney(plan.price, plan.currency)} ${plan.price_unit ?? ''}`}
                      </div>
                      {plan.included_usage_unit && (
                        <div className="mt-1 text-zinc-500">{plan.included_usage_amount ?? '—'} {plan.included_usage_unit}</div>
                      )}
                      {plan.source === 'manual' && (
                        <Badge variant="outline" className="mt-2">{isZh ? '人工核验引用' : 'manual reference'}</Badge>
                      )}
                      {plan.last_verified && (
                        <div className="mt-2 text-xs text-zinc-500">{isZh ? '核验' : 'Verified'}: {plan.last_verified.slice(0, 10)}</div>
                      )}
                      {plan.notes?.match(/Source: (https:\/\/\S+)/)?.[1] && (
                        <a className="mt-2 inline-flex items-center gap-1 text-blue-600 hover:underline" href={plan.notes.match(/Source: (https:\/\/\S+)/)?.[1]} target="_blank" rel="noreferrer">
                          {isZh ? '官方价格来源' : 'Official pricing source'}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
