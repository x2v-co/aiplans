/**
 * Gateway subscriptions (plan_kind = 'gateway_subscription'): a flat monthly
 * fee buys a fixed USD credit on an AI gateway, drawn down at that gateway's
 * per-token rates for the covered models (first entry: Vercel Token Pass).
 *
 * The comparable figures are derived only from published plan fields, so no
 * token allowance is invented:
 *   credit multiple = monthly credit / monthly fee   (Token Pass: 80 / 30 ≈ 2.67×)
 *   cost factor     = monthly fee / monthly credit   (Token Pass: 30 / 80 = 0.375)
 * A covered model's effective rate is its gateway per-token rate × cost factor,
 * assuming the whole credit is used. This matches the "list-price multiple"
 * idea in the quota proposal (aiplans#199) without depending on it.
 */
export type GatewaySubscriptionPlan = {
  plan_kind: string | null;
  price: number | null;
  currency: string | null;
  monthly_api_credit_usd?: number | null;
  has_overage_pricing?: boolean | null;
};

export type GatewaySubscriptionEconomics = {
  creditUsd: number;
  feeUsd: number;
  creditMultiple: number;
  costFactor: number;
  hardStop: boolean;
};

export function isGatewaySubscription(plan: Pick<GatewaySubscriptionPlan, 'plan_kind'>): boolean {
  return plan.plan_kind === 'gateway_subscription';
}

/** null unless the plan is a USD gateway subscription with a positive fee and credit. */
export function gatewaySubscriptionEconomics(plan: GatewaySubscriptionPlan): GatewaySubscriptionEconomics | null {
  if (!isGatewaySubscription(plan)) return null;
  const fee = plan.price;
  const credit = plan.monthly_api_credit_usd;
  if ((plan.currency ?? 'USD').toUpperCase() !== 'USD') return null;
  if (fee == null || credit == null || !(fee > 0) || !(credit > 0)) return null;
  return {
    creditUsd: credit,
    feeUsd: fee,
    creditMultiple: credit / fee,
    costFactor: fee / credit,
    hardStop: plan.has_overage_pricing === false,
  };
}

/** Effective $/1M for a covered model, given the gateway's own per-token rate. */
export function gatewayEffectiveRate(ratePer1m: number, economics: GatewaySubscriptionEconomics): number {
  return ratePer1m * economics.costFactor;
}

export function gatewaySubscriptionSummary(economics: GatewaySubscriptionEconomics, locale: string): string[] {
  const zh = locale === 'zh';
  const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
  const lines = [
    zh
      ? `每月 ${money(economics.feeUsd)} 换 ${money(economics.creditUsd)} 额度（${economics.creditMultiple.toFixed(2)}×）`
      : `${money(economics.feeUsd)}/mo buys ${money(economics.creditUsd)} credit (${economics.creditMultiple.toFixed(2)}×)`,
    zh
      ? `额度用满时，等效价 = 网关单价 × ${economics.costFactor.toFixed(3)}`
      : `If fully used, effective rate = gateway rate × ${economics.costFactor.toFixed(3)}`,
  ];
  if (economics.hardStop) lines.push(zh ? '用完即停，无超额计费' : 'Hard stop when credit runs out; no overage');
  return lines;
}
