import React from 'react';
import { formatPrice, type CurrencyCode } from '@/lib/currency';

type PlanPrice = {
  price?: number | string | null;
  price_unit?: string | null;
  annual_price?: number | string | null;
  price_yearly_monthly?: number | string | null;
  is_contact_sales?: boolean | null;
};

function amount(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function providerPlanPrice(plan: PlanPrice, showYearly: boolean) {
  const monthly = amount(plan.price);
  const annualMonthly = amount(plan.price_yearly_monthly);
  const annual = amount(plan.annual_price) ?? (annualMonthly == null ? null : annualMonthly * 12);
  const useAnnual = showYearly && annual != null;
  const value = useAnnual ? annual : monthly;
  const unit = useAnnual ? 'per_year' : plan.price_unit;
  const fallback = showYearly && annual == null && monthly != null && monthly > 0 && unit === 'per_month';
  return { price: value, price_unit: unit, fallback };
}

/** Keep the amount and billing unit together: an annual tab is not evidence
 * that a monthly-only plan has an annual price. */
export function ProviderPlanPrice({ plan, showYearly, currency, locale }: {
  plan: PlanPrice;
  showYearly: boolean;
  currency: CurrencyCode;
  locale: string;
}) {
  const isZh = locale === 'zh';
  const { price: value, price_unit: unit, fallback } = providerPlanPrice(plan, showYearly);
  const unitLabel = unit === 'per_month' ? (isZh ? '月' : 'mo')
    : unit === 'per_year' ? (isZh ? '年' : 'year') : unit?.replaceAll('_', ' ');
  return <>
    <span className="text-3xl font-bold">
      {plan.is_contact_sales ? (isZh ? '按需报价' : 'Custom')
        : value == null ? (isZh ? '价格未知' : 'Price unknown')
        : value === 0 ? (isZh ? '免费' : 'Free')
        : formatPrice(value, currency, locale)}
    </span>
    {!plan.is_contact_sales && value != null && value > 0 && unitLabel && (
      <span className="text-zinc-500 text-sm ml-1">/{unitLabel}</span>
    )}
    {!plan.is_contact_sales && fallback && (
      <p className="mt-1 text-xs text-zinc-500">
        {isZh ? '暂无年付报价，显示月付价格。' : 'Annual price unavailable; showing monthly price.'}
      </p>
    )}
  </>;
}
