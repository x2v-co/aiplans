import { Badge } from '@/components/ui/badge';
import { ModelPlanCard, type ModelPlanCardRow } from '@/components/model-plan-card';
import { planKindDescription, planKindIcon, planKindLabel } from '@/lib/plan-kinds';
import type { groupModelPlansByOwnership } from '@/lib/model-plan-groups';
import type { ModelUsagePriceRow } from '@/lib/model-usage-prices';

export function ModelPlanGroups({ groups, locale, now, usagePrices, recommendedPlanIds, bestValuePlanId }: {
  groups: ReturnType<typeof groupModelPlansByOwnership<ModelPlanCardRow>>;
  locale: string;
  now: Date;
  usagePrices: ModelUsagePriceRow[];
  recommendedPlanIds: Set<number>;
  bestValuePlanId: number | null;
}) {
  const isZh = locale === 'zh';
  return groups.map(({ official, kindGroups }) => <div key={String(official)} className="mb-8 min-w-0 last:mb-0" data-plan-group={official ? 'official' : 'third-party'}>
    <h3 className="mb-3 text-xl font-semibold">{official
      ? isZh ? '官方套餐' : 'Official plans'
      : isZh ? '第三方套餐' : 'Third-party plans'}</h3>
    {official && <p className="mb-4 text-sm text-zinc-500">{isZh
      ? '以下为模型厂商的官网套餐，不代表每个套餐均包含此型号；具体模型可用性及额度请以官网为准。'
      : 'These are the model producer’s plans. A plan may not include this exact model; check the official site for current model availability and allowances.'}</p>}
    {kindGroups.map(({ kind, plans }) => <div key={kind} className="mb-6 min-w-0 last:mb-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h4 className="text-lg font-semibold">{planKindIcon(kind)} {planKindLabel(kind, locale)}</h4>
        <Badge variant="secondary" className="font-normal">{isZh ? `${plans.length} 个套餐` : `${plans.length} plan${plans.length === 1 ? '' : 's'}`}</Badge>
      </div>
      <p className="mb-4 text-sm text-zinc-500">{planKindDescription(kind, locale)}</p>
      <div className="grid min-w-0 grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-4">
        {plans.map(plan => <ModelPlanCard key={plan.id} plan={plan} locale={locale} now={now}
          usagePrices={usagePrices.filter(row => row.plan_id === plan.id)}
          recommended={recommendedPlanIds.has(plan.id)} bestValue={plan.id === bestValuePlanId} />)}
      </div>
    </div>)}
  </div>);
}
