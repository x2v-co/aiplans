"use client";

import React, { use, useState, useEffect } from "react";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Check, HelpCircle, ArrowRight, Star, ChevronDown, ChevronUp } from "lucide-react";

interface ComparePageProps {
  params: Promise<{ locale: string; model: string }>;
}

interface PlanGroup {
  providerId: string;
  providerName: string;
  providerLogo: string;
  isOfficial: boolean;
  plans: any[];
}

export default function ComparePlansModelPage({ params }: ComparePageProps) {
  const { locale, model: modelSlug } = use(params);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Billing toggle
  const [showYearly, setShowYearly] = useState(false);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());

  // FAQ state
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Fetch data
  useEffect(() => {
    if (!modelSlug) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams({
          model: modelSlug,
          showYearly: showYearly.toString(),
        });

        const response = await fetch(`/api/compare/plans?${queryParams.toString()}`);

        if (!response.ok) {
          throw new Error("Failed to fetch comparison data");
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [modelSlug, showYearly]);

  // Helper functions
  const formatPrice = (value: number | null, curr: string): string => {
    if (value === null) return "-";
    const symbol = curr === "CNY" ? "¥" : "$";
    return `${symbol}${value.toFixed(2)}`;
  };

  const getChannelName = (plan: any): string => {
    return plan.channel?.name || plan.channel?.nameZh || "Unknown";
  };

  const getPlanName = (plan: any): string => {
    return plan.plan?.name || plan.plan?.nameZh || "Unknown Plan";
  };

  // Group plans by provider
  const planGroups = React.useMemo(() => {
    if (!data) return [];

    const allPlans = [...(data.officialPlans || []), ...(data.thirdPartyPlans || [])];
    const groups: Map<string, PlanGroup> = new Map();

    allPlans.forEach((plan: any) => {
      const providerId = plan.channel?.slug || plan.channel?.id || Math.random().toString();
      const providerName = getChannelName(plan);

      if (!groups.has(providerId)) {
        groups.set(providerId, {
          providerId,
          providerName,
          providerLogo: plan.channel?.logo || "",
          isOfficial: plan.plan.isOfficial || false,
          plans: [],
        });
      }

      groups.get(providerId)!.plans.push(plan);
    });

    // Sort plans within each group by price
    groups.forEach((group) => {
      group.plans.sort((a, b) => {
        const priceA = showYearly
          ? (a.pricing.yearlyMonthly || a.pricing.monthly || 0)
          : (a.pricing.monthly || 0);
        const priceB = showYearly
          ? (b.pricing.yearlyMonthly || b.pricing.monthly || 0)
          : (b.pricing.monthly || 0);
        return priceA - priceB;
      });
    });

    // Sort groups: official first, then by number of plans
    return Array.from(groups.values()).sort((a, b) => {
      if (a.isOfficial && !b.isOfficial) return -1;
      if (!a.isOfficial && b.isOfficial) return 1;
      return b.plans.length - a.plans.length;
    });
  }, [data, showYearly]);

  // Toggle provider expansion
  const toggleProvider = (providerId: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(providerId)) {
        next.delete(providerId);
      } else {
        next.add(providerId);
      }
      return next;
    });
  };

  // Expand all by default
  React.useEffect(() => {
    if (planGroups.length > 0) {
      setExpandedProviders(new Set(planGroups.map((g) => g.providerId)));
    }
  }, [planGroups]);

  // FAQ data
  const faqs = [
    {
      question: locale === "zh" ? "如何选择最合适的订阅计划？" : "How to choose the best subscription plan?",
      answer: locale === "zh"
        ? "选择订阅计划时，请考虑您的使用场景、预算和所需功能。如果您是轻度用户，Free或Basic计划可能足够；如果您需要更高限速和高级功能，建议选择Pro或Enterprise计划。"
        : "When choosing a subscription plan, consider your usage scenarios, budget, and required features. If you're a light user, Free or Basic plans may be sufficient; if you need higher rate limits and advanced features, Pro or Enterprise plans are recommended.",
    },
    {
      question: locale === "zh" ? "年付和月付有什么区别？" : "What's the difference between yearly and monthly billing?",
      answer: locale === "zh"
        ? "年付计划通常比月付计划便宜15-20%，适合长期使用的用户。月付计划更灵活，可以随时取消或更换计划。"
        : "Yearly plans are typically 15-20% cheaper than monthly plans, suitable for long-term users. Monthly plans are more flexible and can be cancelled or changed at any time.",
    },
    {
      question: locale === "zh" ? "国内用户如何支付？" : "How can China-based users pay?",
      answer: locale === "zh"
        ? "部分提供商支持支付宝和微信支付。您可以在计划详情中查看支持的支付方式。第三方渠道如硅基流动、火山引擎等通常支持国内支付。"
        : "Some providers support Alipay and WeChat Pay. You can check the supported payment methods in the plan details. Third-party channels like SiliconFlow and Volcano Engine typically support domestic payments.",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
        <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 dark:bg-black/80">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href={`/${locale}`} className="flex items-center gap-2">
              <span className="text-2xl">💰</span>
              <span className="text-xl font-bold">aiplans.dev</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href={`/${locale}`} className="text-sm font-medium hover:text-blue-600">
                Home
              </Link>
              <Link href={`/${locale}/compare/plans`} className="text-sm font-medium text-blue-600">
                Compare Plans
              </Link>
              <Link href={`/${locale}/api-pricing`} className="text-sm font-medium hover:text-blue-600">
                API Pricing
              </Link>
              <LanguageSwitcher />
            </nav>
          </div>
        </header>
        <main className="container mx-auto px-4 py-12">
          <div className="text-center text-zinc-500">Loading comparison data...</div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
        <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 dark:bg-black/80">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href={`/${locale}`} className="flex items-center gap-2">
              <span className="text-2xl">💰</span>
              <span className="text-xl font-bold">aiplans.dev</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href={`/${locale}`} className="text-sm font-medium hover:text-blue-600">
                Home
              </Link>
              <Link href={`/${locale}/compare/plans`} className="text-sm font-medium text-blue-600">
                Compare Plans
              </Link>
              <Link href={`/${locale}/api-pricing`} className="text-sm font-medium hover:text-blue-600">
                API Pricing
              </Link>
              <LanguageSwitcher />
            </nav>
          </div>
        </header>
        <main className="container mx-auto px-4 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Model Not Found</h1>
            <p className="text-zinc-500 mb-6">{error || "The requested model could not be found."}</p>
            <Link href={`/${locale}/compare/plans`} className="text-blue-600 hover:underline">
              ← Back to model selection
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const { model, summary } = data;
  const planCount = planGroups.reduce((sum, g) => sum + g.plans.length, 0);
  const cheapestPrice = summary?.cheapestPlan?.effectiveMonthly || summary?.cheapestPlan?.monthly || 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 dark:bg-black/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <span className="text-2xl">💰</span>
            <span className="text-xl font-bold">aiplans.dev</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href={`/${locale}`} className="text-sm font-medium hover:text-blue-600">
              Home
            </Link>
            <Link href={`/${locale}/compare/plans`} className="text-sm font-medium text-blue-600">
              Compare Plans
            </Link>
            <Link href={`/${locale}/api-pricing`} className="text-sm font-medium hover:text-blue-600">
              API Pricing
            </Link>
            <LanguageSwitcher />
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
          <Link href={`/${locale}`} className="hover:text-blue-600">Home</Link>
          <span>/</span>
          <Link href={`/${locale}/compare/plans`} className="hover:text-blue-600">Compare Plans</Link>
          <span>/</span>
          <span className="text-zinc-900 dark:text-zinc-100">{model.name}</span>
        </div>

        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            {model.provider?.logo_url && (
              <img src={model.provider.logo_url} alt={model.provider.name} className="w-12 h-12 object-contain" />
            )}
            <h1 className="text-4xl font-bold">{model.name} Plans</h1>
          </div>
          <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-6 max-w-2xl mx-auto">
            {locale === "zh"
              ? `比较 ${model.name} 在不同渠道的订阅计划，找到最适合您的方案`
              : `Compare ${model.name} subscription plans across different channels to find the best option for you`}
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              <span className={`text-sm ${!showYearly ? "font-semibold" : "text-zinc-500"}`}>
                {locale === "zh" ? "月付" : "Monthly"}
              </span>
              <Switch
                checked={showYearly}
                onCheckedChange={setShowYearly}
              />
              <span className={`text-sm ${showYearly ? "font-semibold" : "text-zinc-500"}`}>
                {locale === "zh" ? "年付" : "Yearly"}
              </span>
              {showYearly && (
                <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                  Save 15-20%
                </Badge>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-8 text-sm text-zinc-500">
            <div>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{planCount}</span> {locale === "zh" ? "个计划" : "plans"}
            </div>
            <div>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">${cheapestPrice.toFixed(2)}</span> {locale === "zh" ? "起" : "from"}
            </div>
          </div>
        </div>

        {/* Provider Groups */}
        {planGroups.length > 0 && (
          <div className="space-y-6 mb-16">
            {planGroups.map((group, groupIndex) => {
              const isExpanded = expandedProviders.has(group.providerId);
              const lowestPrice = group.plans.reduce((min, plan) => {
                const price = showYearly
                  ? (plan.pricing.yearlyMonthly || plan.pricing.monthly || 0)
                  : (plan.pricing.monthly || 0);
                return price < min && price > 0 ? price : min;
              }, Infinity);

              return (
                <div
                  key={group.providerId}
                  className={`border-2 rounded-xl overflow-hidden ${
                    group.isOfficial
                      ? "border-blue-200 dark:border-blue-800"
                      : "border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  {/* Provider Header */}
                  <button
                    onClick={() => toggleProvider(group.providerId)}
                    className="w-full flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {group.providerLogo && (
                        <img src={group.providerLogo} alt={group.providerName} className="w-8 h-8 object-contain" />
                      )}
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">{group.providerName}</span>
                          {group.isOfficial && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              🏛️ Official
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-zinc-500">
                          {group.plans.length} {group.plans.length === 1 ? "plan" : "plans"} •
                          from {lowestPrice === Infinity ? "-" : `$${lowestPrice.toFixed(2)}`}
                        </div>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-zinc-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-zinc-400" />
                    )}
                  </button>

                  {/* Plans Grid */}
                  {isExpanded && (
                    <div className="p-4 bg-white dark:bg-black">
                      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {group.plans.map((plan: any, planIndex: number) => {
                          const isRecommended = groupIndex === 0 && planIndex === 0 && plan.pricing.monthly > 0;
                          const price = showYearly
                            ? (plan.pricing.yearlyMonthly || plan.pricing.monthly)
                            : plan.pricing.monthly;

                          return (
                            <Card
                              key={plan.plan.id}
                              className={`relative flex flex-col ${
                                isRecommended
                                  ? "border-blue-500 shadow-lg shadow-blue-100 dark:shadow-blue-900/20"
                                  : ""
                              }`}
                            >
                              {/* Recommended Badge */}
                              {isRecommended && (
                                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                  <Badge className="bg-blue-600 text-white px-3 py-1">
                                    <Star className="w-3 h-3 mr-1 fill-current" />
                                    {locale === "zh" ? "推荐" : "Recommended"}
                                  </Badge>
                                </div>
                              )}

                              <CardHeader className="pb-3">
                                <CardTitle className="text-base">{getPlanName(plan)}</CardTitle>
                              </CardHeader>

                              <CardContent className="flex-1 flex flex-col">
                                {/* Price */}
                                <div className="mb-3">
                                  {plan.pricing.billingModel === "pay_as_you_go" ? (
                                    <div className="space-y-1">
                                      <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-bold">
                                          {formatPrice(plan.pricing.inputPer1m, plan.pricing.currency)}
                                        </span>
                                        <span className="text-xs text-zinc-500">/1M in</span>
                                      </div>
                                      <div className="text-xs text-zinc-500">
                                        {formatPrice(plan.pricing.outputPer1m, plan.pricing.currency)}/1M out
                                      </div>
                                    </div>
                                  ) : price ? (
                                    <div className="flex items-baseline gap-1">
                                      <span className="text-2xl font-bold">{formatPrice(price, plan.pricing.currency)}</span>
                                      <span className="text-zinc-500 text-sm">/{showYearly ? "mo" : "mo"}</span>
                                    </div>
                                  ) : (
                                    <div className="text-xl font-bold">{locale === "zh" ? "免费" : "Free"}</div>
                                  )}
                                  {showYearly && plan.pricing.yearlyDiscountPercent && (
                                    <div className="text-xs text-green-600 mt-1">
                                      Save {plan.pricing.yearlyDiscountPercent}%
                                    </div>
                                  )}
                                </div>

                                {/* Key Limits - Always show */}
                                <div className="space-y-1 mb-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-zinc-500">RPM</span>
                                    <span className="font-medium">{plan.limits?.rpm_display || "-"}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-zinc-500">TPM</span>
                                    <span className="font-medium">{plan.limits?.tpm_display || "-"}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-zinc-500">QPS</span>
                                    <span className="font-medium">{plan.performance?.qps_display || "-"}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-zinc-500">{locale === "zh" ? "国内访问" : "China"}</span>
                                    <span className={plan.channel?.accessFromChina ? "text-green-600" : "text-red-400"}>
                                      {plan.channel?.accessFromChina ? "✓" : "✗"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-zinc-500">{locale === "zh" ? "最大输出" : "Max Output"}</span>
                                    <span className="font-medium">{plan.limits?.maxTokensPerRequest?.toLocaleString() || "-"}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-zinc-500">{locale === "zh" ? "上下文" : "Context"}</span>
                                    <span className="font-medium">{model?.context_window ? `${(model.context_window / 1000).toFixed(0)}K` : "-"}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-zinc-500">{locale === "zh" ? "计费模式" : "Billing"}</span>
                                    <span className="font-medium">
                                      {plan.pricing?.billingModel === "subscription" ? (locale === "zh" ? "订阅" : "Sub") :
                                       plan.pricing?.billingModel === "pay_as_you_go" ? (locale === "zh" ? "按量" : "PAYG") :
                                       plan.pricing?.billingModel === "token_pack" ? (locale === "zh" ? "Token包" : "Token") :
                                       "-"}
                                    </span>
                                  </div>
                                </div>

                                {/* Features - Show more */}
                                {plan.plan?.features && plan.plan.features.length > 0 && (
                                  <div className="mb-3 pt-2 border-t border-dashed">
                                    <p className="text-xs font-semibold text-zinc-500 mb-2">
                                      {locale === "zh" ? "功能" : "Features"}
                                    </p>
                                    <ul className="space-y-1">
                                      {plan.plan.features.slice(0, 5).map((feature: string, idx: number) => (
                                        <li key={idx} className="flex items-start gap-1 text-xs">
                                          <Check className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                                          <span className="text-zinc-600 dark:text-zinc-400 line-clamp-2">{feature}</span>
                                        </li>
                                      ))}
                                      {plan.plan.features.length > 5 && (
                                        <li className="text-xs text-zinc-400">
                                          +{plan.plan.features.length - 5} more
                                        </li>
                                      )}
                                    </ul>
                                  </div>
                                )}

                                {/* Payment Methods */}
                                {plan.channel?.paymentMethods && plan.channel.paymentMethods.length > 0 && (
                                  <div className="mb-3 pt-2 border-t border-dashed">
                                    <p className="text-xs font-semibold text-zinc-500 mb-2">
                                      {locale === "zh" ? "支付方式" : "Payment"}
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {plan.channel.paymentMethods.map((method: string, idx: number) => {
                                        const methodLabels: Record<string, string> = {
                                          credit_card: "💳 Card",
                                          alipay: "🇨🇳 Alipay",
                                          wechat: "🇨🇳 WeChat",
                                        };
                                        return (
                                          <span key={idx} className="text-xs px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded">
                                            {methodLabels[method] || method}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Action Button - at bottom */}
                                <div className="mt-auto pt-3">
                                  <a
                                    href={plan.channel?.inviteUrl || plan.channel?.website || "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`w-full flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                      isRecommended
                                        ? "bg-blue-600 text-white hover:bg-blue-700"
                                        : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"
                                    }`}
                                  >
                                    {locale === "zh" ? "订阅" : "Subscribe"}
                                    <ArrowRight className="w-3 h-3" />
                                  </a>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* FAQ Section */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-6">
            {locale === "zh" ? "常见问题" : "FAQ"}
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="border rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                >
                  <span className="font-medium pr-4">{faq.question}</span>
                  <HelpCircle className={`w-5 h-5 flex-shrink-0 transition-transform ${
                    openFaq === index ? "rotate-180" : ""
                  }`} />
                </button>
                {openFaq === index && (
                  <div className="px-4 pb-4 text-zinc-600 dark:text-zinc-400">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white text-center mb-12">
          <h2 className="text-2xl font-bold mb-4">
            {locale === "zh"
              ? "还没有找到合适的方案？"
              : "Haven't found the right plan yet?"}
          </h2>
          <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
            {locale === "zh"
              ? "查看更多模型对比，或订阅价格变动通知"
              : "Check out more model comparisons or subscribe to price change notifications"}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href={`/${locale}/compare/models`}
              className="px-6 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
            >
              {locale === "zh" ? "查看更多模型" : "View More Models"}
            </Link>
            <Link
              href={`/${locale}/api-pricing`}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-400 transition-colors"
            >
              {locale === "zh" ? "API 价格对比" : "API Pricing"}
            </Link>
          </div>
        </div>

        {/* Footer Info */}
        <div className="bg-zinc-100 dark:bg-zinc-900 rounded-lg p-6">
          <h3 className="font-semibold mb-4">📝 Notes</h3>
          <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <li>• Prices last updated: {new Date().toLocaleDateString()}</li>
            <li>• Exchange rate: 1 USD = 6.90 CNY (real-time)</li>
            <li>• Actual costs may vary based on usage patterns, cache hit rates, and other factors</li>
            <li>
              • Data sources: Official pricing pages from each provider{" "}
              {data?.model?.provider?.website ? (
                <a href={data.model.provider.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  [View sources]
                </a>
              ) : (
                <Link href={`/${locale}/api-pricing`} className="text-blue-600 hover:underline">
                  [View sources]
                </Link>
              )}
            </li>
            <li>
              • Found a pricing error?{" "}
              <a href="https://github.com/x2v-co/aiplans/issues" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                📮 Report an issue
              </a>
            </li>
          </ul>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">💰</span>
            <span className="font-medium">aiplans.dev</span>
          </div>
          <nav className="flex gap-6 text-sm text-zinc-500">
            <Link href={`/${locale}/about`} className="hover:text-blue-600">About</Link>
            <Link href={`/${locale}/api`} className="hover:text-blue-600">API</Link>
            <Link href={`/${locale}/blog`} className="hover:text-blue-600">Blog</Link>
            <Link href={`/${locale}/contact`} className="hover:text-blue-600">Contact</Link>
          </nav>
          <p className="text-sm text-zinc-500">
            © 2026 aiplans.dev - Compare AI pricing & save money
          </p>
        </div>
      </footer>
    </div>
  );
}
