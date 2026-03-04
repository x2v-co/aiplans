"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

interface PlanComparison {
  plan: {
    id: number;
    slug: string;
    name: string;
    nameZh: string;
    planTier: string;
    isOfficial: boolean;
  };
  channel: {
    slug: string;
    name: string;
    nameZh: string;
    logo: string;
    website: string | null;
    inviteUrl: string | null;
    region: string;
    accessFromChina: boolean;
    paymentMethods: string[];
  };
  pricing: {
    billingModel: string;
    billingUnit: string;
    monthly: number | null;
    yearly: number | null;
    yearlyMonthly: number | null;
    yearlyDiscountPercent: number | null;
    currency: string;
    displayCurrency: string;
    convertedMonthly: number | null;
    convertedYearly: number | null;
    convertedYearlyMonthly: number | null;
    exchangeRate: string;
    inputPer1m: number | null;
    outputPer1m: number | null;
    cachedInputPer1m: number | null;
    hasOverage: boolean;
    overageInputPer1m: number | null;
    overageOutputPer1m: number | null;
  };
  limits: {
    rpm: number | null;
    rpd: number | null;
    rpm_display: string;
    tpm: number | null;
    tpd: number | null;
    tpm_display: string;
    monthlyRequests: number | null;
    monthlyTokens: number | null;
    maxTokensPerRequest: number | null;
    maxInputTokens: number | null;
    maxOutputTokens: number | null;
  };
  performance: {
    qps: number | null;
    concurrentRequests: number | null;
    qps_display: string;
  };
  vsOfficial: {
    priceDiffPercent: number | null;
    priceDiffLabel: string;
    rpmDiffPercent: number | null;
    qpsDiffPercent: number | null;
  };
  estimatedCost?: {
    monthlyCost: number;
    currency: string;
    breakdown: {
      subscription: number;
      tokenUsage: number;
      overage: number;
      total: number;
    };
    isWithinLimits: boolean;
    limitWarnings: string[];
  };
  lastVerified: string;
  sourceUrl: string;
  note: string | null;
}

interface CompareTableProps {
  officialPlans: PlanComparison[];
  thirdPartyPlans: PlanComparison[];
  currency: string;
  showYearly: boolean;
}

function formatDisplayPrice(value: number | null, currency: string): string {
  if (value === null) return "-";
  // Format the number and add currency symbol
  const currencySymbol = currency === "CNY" ? "¥" : "$";
  return currencySymbol + value.toFixed(2);
}

function getCurrencySymbol(code: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    CNY: '¥',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    KRW: '₩',
  };
  return symbols[code] || '$';
}

function VsOfficialBadge({ diff }: { diff: number | null }) {
  if (diff === null) return null;

  if (diff < 0) {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
        🟢 {Math.abs(diff)}% cheaper
      </Badge>
    );
  } else if (diff > 0) {
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
        🔴 {diff}% more expensive
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs">
      = Same price
    </Badge>
  );
}

function PlanRow({ plan, isBaseline, currency, showYearly }: {
  plan: PlanComparison;
  isBaseline: boolean;
  currency: string;
  showYearly: boolean;
}) {
  return (
    <div className={cn(
      "border rounded-lg p-6 mb-4",
      isBaseline && "bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {plan.channel.logo && <img src={plan.channel.logo} alt={plan.channel.name} className="w-10 h-10 object-contain" />}
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-lg">{plan.channel.name}</h4>
              {(plan.channel.inviteUrl || plan.channel.website) && (
                <a
                  href={plan.channel.inviteUrl || plan.channel.website || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                  title="Visit website"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              {isBaseline && (
                <Badge variant="secondary" className="text-xs">
                  🏛️ Official Baseline
                </Badge>
              )}
            </div>
            <p className="text-sm text-zinc-500">{plan.plan.name}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 justify-end items-center">
          {plan.channel.accessFromChina && (
            <Badge variant="outline" className="text-xs">🇨🇳 China OK</Badge>
          )}
          {plan.channel.region === "global" && (
            <Badge variant="outline" className="text-xs">🌍 Global</Badge>
          )}
          {(plan.channel.inviteUrl || plan.channel.website) && (
            <a
              href={plan.channel.inviteUrl || plan.channel.website || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Subscribe
            </a>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid md:grid-cols-4 gap-6">
        {/* Column 1: Pricing */}
        <div>
          <h5 className="text-sm font-semibold text-zinc-500 mb-3">💰 Pricing</h5>

          {plan.pricing.billingModel === "pay_as_you_go" && (
            <div className="space-y-2">
              <div>
                <div className="text-xs text-zinc-500">Input</div>
                <div className="font-semibold">{formatDisplayPrice(plan.pricing.inputPer1m, currency)}/1M</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Output</div>
                <div className="font-semibold">{formatDisplayPrice(plan.pricing.outputPer1m, currency)}/1M</div>
              </div>
              {plan.pricing.cachedInputPer1m && (
                <div>
                  <div className="text-xs text-zinc-500">Cached Input</div>
                  <div className="font-semibold text-sm">{formatDisplayPrice(plan.pricing.cachedInputPer1m, currency)}/1M</div>
                </div>
              )}
            </div>
          )}

          {plan.pricing.billingModel === "subscription" && (
            <div className="space-y-2">
              <div>
                <div className="text-xs text-zinc-500">
                  Monthly <span className="text-zinc-400">({plan.pricing.currency})</span>
                </div>
                <div className="font-semibold">{formatDisplayPrice(plan.pricing.monthly, currency)}</div>
                {/* Show converted price if different */}
                {plan.pricing.currency !== plan.pricing.displayCurrency && plan.pricing.convertedMonthly && (
                  <div className="text-xs text-zinc-400">
                    ≈ {formatDisplayPrice(plan.pricing.convertedMonthly, plan.pricing.displayCurrency)}
                    <span className="ml-1 text-zinc-500">{plan.pricing.exchangeRate}</span>
                  </div>
                )}
              </div>
              {showYearly && plan.pricing.yearlyMonthly && (
                <div className="border-t border-dashed pt-2">
                  <div className="text-xs text-zinc-500">Yearly (per month)</div>
                  <div className="font-semibold">{formatDisplayPrice(plan.pricing.yearlyMonthly, currency)}</div>
                  {plan.pricing.currency !== plan.pricing.displayCurrency && plan.pricing.convertedYearlyMonthly && (
                    <div className="text-xs text-zinc-400">
                      ≈ {formatDisplayPrice(plan.pricing.convertedYearlyMonthly, plan.pricing.displayCurrency)}
                    </div>
                  )}
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs mt-1">
                    🏷️ Save {plan.pricing.yearlyDiscountPercent?.toFixed(0)}%
                  </Badge>
                </div>
              )}
              {plan.pricing.inputPer1m && (
                <div className="text-xs text-zinc-500 pt-2">
                  + Usage: {formatDisplayPrice(plan.pricing.inputPer1m, currency)}/1M in,{" "}
                  {formatDisplayPrice(plan.pricing.outputPer1m, currency)}/1M out
                </div>
              )}
            </div>
          )}

          {!isBaseline && plan.vsOfficial.priceDiffPercent !== null && (
            <div className="mt-3">
              <VsOfficialBadge diff={plan.vsOfficial.priceDiffPercent} />
            </div>
          )}

          {plan.estimatedCost && (
            <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-xs">
              <div className="font-semibold text-blue-700 dark:text-blue-400">
                📊 Est. ${plan.estimatedCost.monthlyCost.toFixed(2)}/mo
              </div>
            </div>
          )}
        </div>

        {/* Column 2: Request Limits */}
        <div>
          <h5 className="text-sm font-semibold text-zinc-500 mb-3">🔢 Request Limits</h5>
          <div className="space-y-2 text-sm">
            <div>
              <div className="text-xs text-zinc-500">RPM</div>
              <div className="font-medium">{plan.limits.rpm_display}</div>
              {!isBaseline && plan.vsOfficial.rpmDiffPercent !== null && plan.vsOfficial.rpmDiffPercent !== 0 && (
                <div className="text-xs text-zinc-500">
                  ({plan.vsOfficial.rpmDiffPercent > 0 ? "+" : ""}{plan.vsOfficial.rpmDiffPercent}% vs official)
                </div>
              )}
            </div>
            {plan.limits.rpd && (
              <div>
                <div className="text-xs text-zinc-500">Daily</div>
                <div className="font-medium">{plan.limits.rpd.toLocaleString()}</div>
              </div>
            )}
            {plan.limits.monthlyRequests && (
              <div>
                <div className="text-xs text-zinc-500">Monthly</div>
                <div className="font-medium">{plan.limits.monthlyRequests.toLocaleString()}</div>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Performance */}
        <div>
          <h5 className="text-sm font-semibold text-zinc-500 mb-3">⚡ Performance</h5>
          <div className="space-y-2 text-sm">
            <div>
              <div className="text-xs text-zinc-500">QPS</div>
              <div className="font-medium">{plan.performance.qps_display}</div>
              {!isBaseline && plan.vsOfficial.qpsDiffPercent !== null && plan.vsOfficial.qpsDiffPercent !== 0 && (
                <div className="text-xs text-zinc-500">
                  ({plan.vsOfficial.qpsDiffPercent > 0 ? "+" : ""}{plan.vsOfficial.qpsDiffPercent}% vs official)
                </div>
              )}
            </div>
            {plan.performance.concurrentRequests && (
              <div>
                <div className="text-xs text-zinc-500">Concurrent</div>
                <div className="font-medium">{plan.performance.concurrentRequests}</div>
              </div>
            )}
          </div>
        </div>

        {/* Column 4: Token Limits */}
        <div>
          <h5 className="text-sm font-semibold text-zinc-500 mb-3">📦 Token Limits</h5>
          <div className="space-y-2 text-sm">
            <div>
              <div className="text-xs text-zinc-500">TPM</div>
              <div className="font-medium">{plan.limits.tpm_display}</div>
            </div>
            {plan.limits.maxOutputTokens && (
              <div>
                <div className="text-xs text-zinc-500">Max Output</div>
                <div className="font-medium">{plan.limits.maxOutputTokens.toLocaleString()}</div>
              </div>
            )}
            {plan.limits.monthlyTokens && (
              <div>
                <div className="text-xs text-zinc-500">Monthly Quota</div>
                <div className="font-medium">{(plan.limits.monthlyTokens / 1_000_000).toFixed(0)}M</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer: Payment Methods */}
      <div className="mt-4 pt-4 border-t flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          Payment: {plan.channel.paymentMethods.map((m) => {
            const methodNames: Record<string, string> = {
              credit_card: "💳 Card",
              alipay: "🇨🇳 Alipay",
              wechat: "🇨🇳 WeChat",
            };
            return methodNames[m] || m;
          }).join(", ")}
        </div>
        {plan.sourceUrl && (
          <a
            href={plan.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            View Details →
          </a>
        )}
      </div>
    </div>
  );
}

export function CompareTable({ officialPlans, thirdPartyPlans, currency, showYearly }: CompareTableProps) {
  // Use formatDisplayPriceSimple from currency utility (already imported)
  const formatDisplayPrice = (value: number | null, curr: string): string => {
    if (value === null) return "-";
    const currencySymbol = curr === "CNY" ? "¥" : "$";
    return currencySymbol + value.toFixed(2);
  };

  return (
    <div className="mb-12">
      {/* Official Plans Section */}
      {officialPlans.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🏛️</span> Official Plans (Baseline)
          </h3>
          {officialPlans.map((plan) => (
            <PlanRow
              key={plan.plan.id}
              plan={plan}
              isBaseline={true}
              currency={currency}
              showYearly={showYearly}
            />
          ))}
        </div>
      )}

      {/* Third-Party Plans Section */}
      {thirdPartyPlans.length > 0 && (
        <div>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🌍</span> Third-Party Channels
          </h3>
          {thirdPartyPlans.map((plan) => (
            <PlanRow
              key={plan.plan.id}
              plan={plan}
              isBaseline={false}
              currency={currency}
              showYearly={showYearly}
            />
          ))}
        </div>
      )}

      {officialPlans.length === 0 && thirdPartyPlans.length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          No plans available with the current filters.
        </div>
      )}
    </div>
  );
}
