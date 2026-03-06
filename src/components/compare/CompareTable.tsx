"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

// Helper function to parse numbers with optional commas
function parseNumberWithCommas(str: string): number | null {
  const match = str.match(/[\d,]+/);
  if (match) {
    return parseInt(match[0].replace(/,/g, ''), 10);
  }
  return null;
}

// Parse features into structured data for comparison
function parseFeatures(features: string[]): {
  // Request/Message limits
  requestsPer5Hours?: number;
  requestsPerWeek?: number;
  requestsPerMonth?: number;
  hasHigherMessageLimits?: boolean;
  hasLimitedMessageCapacity?: boolean;
  hasUnlimitedMessages?: boolean;

  // Pricing
  firstMonthPrice?: number;
  secondMonthPrice?: number;
  thirdMonthPrice?: number;
  yearlyDiscountPercent?: number;
  quarterlyDiscountPercent?: number;

  // Capabilities
  hasExtendedContext?: boolean;
  hasPriorityAccess?: boolean;
  hasFileUpload?: boolean;
  hasImageAnalysis?: boolean;
  hasCodeGeneration?: boolean;
  hasWebBrowsing?: boolean;
  hasAPIAccess?: boolean;
  hasSSO?: boolean;
  hasEnterpriseSecurity?: boolean;
  hasCustomModels?: boolean;
  hasDataExclusion?: boolean;
  hasSLA?: boolean;

  // Model access
  supportedModels?: string[];
  supportedTools?: string[];

  // Usage multiplier (for coding plans)
  usageMultiplier?: string;
} {
  const result: any = {};

  // === Parse Chinese request limits ===
  const requestsPer5HoursMatch = features.find(f => f.match(/每5小时.*?[\d,]+/));
  if (requestsPer5HoursMatch) {
    result.requestsPer5Hours = parseNumberWithCommas(requestsPer5HoursMatch);
  }

  const requestsPerWeekMatch = features.find(f => f.match(/每周.*?[\d,]+/));
  if (requestsPerWeekMatch) {
    result.requestsPerWeek = parseNumberWithCommas(requestsPerWeekMatch);
  }

  const requestsPerMonthMatch = features.find(f => f.match(/每订阅月.*?[\d,]+/));
  if (requestsPerMonthMatch) {
    result.requestsPerMonth = parseNumberWithCommas(requestsPerMonthMatch);
  }

  // === Parse pricing ===
  const firstMonthMatch = features.find(f => f.match(/首月特惠.*?(\d+\.?\d*)/));
  if (firstMonthMatch) {
    const match = firstMonthMatch.match(/(\d+\.?\d*)/);
    if (match) result.firstMonthPrice = parseFloat(match[1]);
  }

  const secondMonthMatch = features.find(f => f.match(/次月.*?(\d+\.?\d*)/));
  if (secondMonthMatch) {
    const match = secondMonthMatch.match(/(\d+\.?\d*)/);
    if (match) result.secondMonthPrice = parseFloat(match[1]);
  }

  const thirdMonthMatch = features.find(f => f.match(/第三月起.*?(\d+\.?\d*)/));
  if (thirdMonthMatch) {
    const match = thirdMonthMatch.match(/(\d+\.?\d*)/);
    if (match) result.thirdMonthPrice = parseFloat(match[1]);
  }

  // Parse discount percentages
  const yearlyMatch = features.find(f => f.match(/yearly.*?(\d+)%.*?off/i) || f.match(/年度.*?(\d+)%.*?折/i));
  if (yearlyMatch) {
    const match = yearlyMatch.match(/(\d+)%/);
    if (match) result.yearlyDiscountPercent = parseInt(match[1]);
  }

  const quarterlyMatch = features.find(f => f.match(/quarterly.*?(\d+)%.*?off/i) || f.match(/季度.*?(\d+)%.*?折/i));
  if (quarterlyMatch) {
    const match = quarterlyMatch.match(/(\d+)%/);
    if (match) result.quarterlyDiscountPercent = parseInt(match[1]);
  }

  // === Parse capabilities (English) ===
  if (features.some(f => f.toLowerCase().includes("higher message limits") || f.includes("更高消息限制"))) {
    result.hasHigherMessageLimits = true;
  }
  if (features.some(f => f.toLowerCase().includes("limited message capacity") || f.includes("有限消息容量"))) {
    result.hasLimitedMessageCapacity = true;
  }
  if (features.some(f => f.toLowerCase().includes("unlimited") && f.toLowerCase().includes("message"))) {
    result.hasUnlimitedMessages = true;
  }
  if (features.some(f => f.toLowerCase().includes("extended context window") || f.includes("扩展上下文"))) {
    result.hasExtendedContext = true;
  }
  if (features.some(f => f.toLowerCase().includes("priority access") || f.includes("优先访问"))) {
    result.hasPriorityAccess = true;
  }
  if (features.some(f => f.toLowerCase().includes("file upload") || f.includes("文件上传"))) {
    result.hasFileUpload = true;
  }
  if (features.some(f => f.toLowerCase().includes("image analysis") || f.includes("图像分析"))) {
    result.hasImageAnalysis = true;
  }
  if (features.some(f => f.toLowerCase().includes("code generation") || f.toLowerCase().includes("coding assistance") || f.includes("代码生成"))) {
    result.hasCodeGeneration = true;
  }
  if (features.some(f => f.toLowerCase().includes("web browsing") || f.includes("网页浏览"))) {
    result.hasWebBrowsing = true;
  }
  if (features.some(f => f.toLowerCase().includes("api access") || f.includes("API访问"))) {
    result.hasAPIAccess = true;
  }
  if (features.some(f => f.toLowerCase().includes("sso"))) {
    result.hasSSO = true;
  }
  if (features.some(f => f.toLowerCase().includes("enterprise-grade security") || f.includes("企业级安全"))) {
    result.hasEnterpriseSecurity = true;
  }
  if (features.some(f => f.toLowerCase().includes("custom ai model") || f.includes("自定义模型"))) {
    result.hasCustomModels = true;
  }
  if (features.some(f => f.toLowerCase().includes("data exclusion from training") || f.includes("不参与训练"))) {
    result.hasDataExclusion = true;
  }
  if (features.some(f => f.toLowerCase().includes("sla"))) {
    result.hasSLA = true;
  }

  // === Parse usage multiplier ===
  const multiplierMatch = features.find(f => f.match(/(\d+)x.*?usage/i) || f.match(/(\d+)倍.*?用量/i));
  if (multiplierMatch) {
    const match = multiplierMatch.match(/(\d+)x/i);
    if (match) result.usageMultiplier = match[1];
  }

  // === Parse supported models (Chinese) ===
  const modelsMatch = features.find(f => f.match(/支持模型:/));
  if (modelsMatch) {
    const match = modelsMatch.match(/支持模型:\s*([^\n]+)/);
    if (match) result.supportedModels = match[1].split(/[,\s]+/).filter(Boolean);
  }

  // === Parse supported tools ===
  const toolsMatch = features.find(f => f.match(/支持工具:/));
  if (toolsMatch) {
    const match = toolsMatch.match(/支持工具:\s*([^\n]+)/);
    if (match) result.supportedTools = match[1].split(/[,\s]+/).filter(Boolean);
  }

  return result;
}

interface PlanComparison {
  plan: {
    id: number;
    slug: string;
    name: string;
    nameZh: string;
    planTier: string;
    isOfficial: boolean;
    features?: string[];
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
  // Use correct currency symbol based on currency code
  const currencySymbol = getCurrencySymbol(currency);
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

function PlanRow({ plan, isBaseline, currency: _currency, showYearly }: {
  plan: PlanComparison;
  isBaseline: boolean;
  currency: string;
  showYearly: boolean;
}) {
  const structuredFeatures = plan.plan.features ? parseFeatures(plan.plan.features) : {};
  // Get the plan's original currency (not the display currency)
  const planCurrency = plan.pricing.currency || 'USD';
  const currencySymbol = getCurrencySymbol(planCurrency);
  // Use plan's original currency for pricing display
  const pricingCurrency = planCurrency;

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
      <div className="grid md:grid-cols-5 gap-6">
        {/* Column 1: Pricing */}
        <div>
          <h5 className="text-sm font-semibold text-zinc-500 mb-3">💰 Pricing</h5>

          {plan.pricing.billingModel === "pay_as_you_go" && (
            <div className="space-y-2">
              <div>
                <div className="text-xs text-zinc-500">Input</div>
                <div className="font-semibold">{formatDisplayPrice(plan.pricing.inputPer1m, pricingCurrency)}/1M</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Output</div>
                <div className="font-semibold">{formatDisplayPrice(plan.pricing.outputPer1m, pricingCurrency)}/1M</div>
              </div>
              {plan.pricing.cachedInputPer1m && (
                <div>
                  <div className="text-xs text-zinc-500">Cached Input</div>
                  <div className="font-semibold text-sm">{formatDisplayPrice(plan.pricing.cachedInputPer1m, pricingCurrency)}/1M</div>
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
                <div className="font-semibold">{formatDisplayPrice(plan.pricing.monthly, pricingCurrency)}</div>
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
                  <div className="font-semibold">{formatDisplayPrice(plan.pricing.yearlyMonthly, pricingCurrency)}</div>
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
                  + Usage: {formatDisplayPrice(plan.pricing.inputPer1m, pricingCurrency)}/1M in,{" "}
                  {formatDisplayPrice(plan.pricing.outputPer1m, pricingCurrency)}/1M out
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

        {/* Column 2: Message/Request Limits */}
        <div>
          <h5 className="text-sm font-semibold text-zinc-500 mb-3">💬 Messages</h5>
          <div className="space-y-2 text-sm">
            {/* Show structured request limits for coding plans */}
            {structuredFeatures.requestsPer5Hours && (
              <>
                <div>
                  <div className="text-xs text-zinc-500">Per 5 Hours</div>
                  <div className="font-medium">{structuredFeatures.requestsPer5Hours.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Per Week</div>
                  <div className="font-medium">{structuredFeatures.requestsPerWeek?.toLocaleString() || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Per Month</div>
                  <div className="font-medium">{structuredFeatures.requestsPerMonth?.toLocaleString() || "-"}</div>
                </div>
              </>
            )}
            {/* Show generic message limit status */}
            {!structuredFeatures.requestsPer5Hours && (
              <>
                {structuredFeatures.hasUnlimitedMessages ? (
                  <div className="font-medium text-green-600">✓ Unlimited</div>
                ) : structuredFeatures.hasHigherMessageLimits ? (
                  <div className="font-medium">✓ Higher limits</div>
                ) : structuredFeatures.hasLimitedMessageCapacity ? (
                  <div className="font-medium">○ Limited</div>
                ) : (
                  <div className="text-xs text-zinc-400">-</div>
                )}
              </>
            )}
            {/* Also show RPM if available */}
            {plan.limits.rpm_display && plan.limits.rpm_display !== "-" && (
              <div>
                <div className="text-xs text-zinc-500">RPM</div>
                <div className="font-medium">{plan.limits.rpm_display}</div>
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

        {/* Column 4: Capabilities */}
        <div>
          <h5 className="text-sm font-semibold text-zinc-500 mb-3">✨ Capabilities</h5>
          <div className="space-y-1 text-sm">
            {structuredFeatures.hasExtendedContext && (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-green-600">✓</span> Extended Context
              </div>
            )}
            {structuredFeatures.hasPriorityAccess && (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-green-600">✓</span> Priority Access
              </div>
            )}
            {structuredFeatures.hasFileUpload && (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-green-600">✓</span> File Upload
              </div>
            )}
            {structuredFeatures.hasImageAnalysis && (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-green-600">✓</span> Image Analysis
              </div>
            )}
            {structuredFeatures.hasCodeGeneration && (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-green-600">✓</span> Code Generation
              </div>
            )}
            {structuredFeatures.hasWebBrowsing && (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-green-600">✓</span> Web Browsing
              </div>
            )}
            {structuredFeatures.hasAPIAccess && (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-green-600">✓</span> API Access
              </div>
            )}
            {structuredFeatures.hasDataExclusion && (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-green-600">✓</span> No Training
              </div>
            )}
            {structuredFeatures.usageMultiplier && (
              <div className="flex items-center gap-1 text-xs font-medium text-blue-600">
                {structuredFeatures.usageMultiplier}x Usage
              </div>
            )}
            {/* Show TPM if available */}
            {plan.limits.tpm_display && plan.limits.tpm_display !== "-" && (
              <div>
                <div className="text-xs text-zinc-500">TPM</div>
                <div className="font-medium">{plan.limits.tpm_display}</div>
              </div>
            )}
          </div>
        </div>

        {/* Column 5: Structured Features (for coding plans, etc.) */}
        {(structuredFeatures.requestsPer5Hours || structuredFeatures.firstMonthPrice) && (
          <div>
            <h5 className="text-sm font-semibold text-zinc-500 mb-3">🎯 Plan Details</h5>
            <div className="space-y-2 text-sm">
              {structuredFeatures.requestsPer5Hours && (
                <div>
                  <div className="text-xs text-zinc-500">Per 5 Hours</div>
                  <div className="font-medium">{structuredFeatures.requestsPer5Hours.toLocaleString()} requests</div>
                </div>
              )}
              {structuredFeatures.requestsPerWeek && (
                <div>
                  <div className="text-xs text-zinc-500">Per Week</div>
                  <div className="font-medium">{structuredFeatures.requestsPerWeek.toLocaleString()} requests</div>
                </div>
              )}
              {structuredFeatures.requestsPerMonth && (
                <div>
                  <div className="text-xs text-zinc-500">Per Month</div>
                  <div className="font-medium">{structuredFeatures.requestsPerMonth.toLocaleString()} requests</div>
                </div>
              )}
              {structuredFeatures.firstMonthPrice && (
                <div className="pt-2 border-t">
                  <div className="text-xs text-green-600 font-semibold">First Month</div>
                  <div className="font-bold text-green-700">{currencySymbol}{structuredFeatures.firstMonthPrice}</div>
                </div>
              )}
              {structuredFeatures.secondMonthPrice && (
                <div>
                  <div className="text-xs text-zinc-500">Second Month</div>
                  <div className="font-medium">{currencySymbol}{structuredFeatures.secondMonthPrice} <span className="text-green-600 text-xs">(50% off)</span></div>
                </div>
              )}
              {structuredFeatures.thirdMonthPrice && (
                <div>
                  <div className="text-xs text-zinc-500">Regular Price</div>
                  <div className="font-medium">{currencySymbol}{structuredFeatures.thirdMonthPrice}/mo</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Features */}
      {plan.plan.features && plan.plan.features.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <h5 className="text-sm font-semibold text-zinc-500 mb-2">✨ Features</h5>
          <div className="flex flex-wrap gap-1">
            {plan.plan.features.slice(0, 6).map((feature, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 rounded"
              >
                {feature}
              </span>
            ))}
            {plan.plan.features.length > 6 && (
              <span className="inline-flex items-center px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-500 rounded">
                +{plan.plan.features.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}

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
