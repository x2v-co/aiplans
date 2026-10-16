import { gatewaySubscriptionEconomics, type GatewaySubscriptionPlan } from './gateway-subscription';

/** Row shape for the 「网关订阅」 section on the /plans overview. */
export type GatewaySectionSource = GatewaySubscriptionPlan & {
  id: number;
  name: string;
  provider_name: string;
  provider_slug: string;
};

export type GatewaySectionRow = {
  id: number;
  name: string;
  providerName: string;
  href: string;
  priceText: string;
  creditText: string;
  multipleText: string;
};

export const GATEWAY_SECTION_ID = 'gateway-subscriptions';

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

/** Only valid USD gateway subscriptions; best multiple first. Empty list => section hidden. */
export function buildGatewaySectionRows(plans: GatewaySectionSource[], locale: string): GatewaySectionRow[] {
  const zh = locale === 'zh';
  return plans
    .map(p => ({ p, e: gatewaySubscriptionEconomics(p) }))
    .filter((x): x is { p: GatewaySectionSource; e: NonNullable<typeof x.e> } => x.e !== null)
    .sort((a, b) => b.e.creditMultiple - a.e.creditMultiple || a.p.id - b.p.id)
    .map(({ p, e }) => ({
      id: p.id,
      name: p.name,
      providerName: p.provider_name,
      href: `/${locale}/providers/${p.provider_slug}`,
      priceText: zh ? `${money(e.feeUsd)}/月` : `${money(e.feeUsd)}/mo`,
      creditText: zh ? `${money(e.creditUsd)} 额度` : `${money(e.creditUsd)} credit`,
      multipleText: `${e.creditMultiple.toFixed(2)}×`,
    }));
}

export function gatewaySectionCopy(locale: string) {
  const zh = locale === 'zh';
  return {
    title: zh ? '网关订阅' : 'Gateway subscriptions',
    description: zh
      ? '固定月费换取 AI 网关的美元额度，按网关单价扣减。倍率 = 额度 ÷ 月费。'
      : 'A flat monthly fee buys USD credit on an AI gateway, drawn down at gateway rates. Multiple = credit ÷ fee.',
    price: zh ? '月费' : 'Monthly fee',
    credit: zh ? '额度' : 'Credit',
    multiple: zh ? '倍率' : 'Multiple',
    view: zh ? '查看详情' : 'View details',
  };
}
