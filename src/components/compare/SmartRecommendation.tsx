"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

interface PlanComparison {
  plan: {
    name: string;
    isOfficial: boolean;
  };
  channel: {
    name: string;
    website: string | null;
    inviteUrl: string | null;
    accessFromChina: boolean;
    region: string;
  };
  pricing: {
    monthly: number | null;
    inputPer1m: number | null;
    outputPer1m: number | null;
  };
  limits: {
    rpm: number | null;
  };
  estimatedCost?: {
    monthlyCost: number;
  };
}

interface SmartRecommendationProps {
  plans: PlanComparison[];
  region: string;
}

export function SmartRecommendation({ plans, region }: SmartRecommendationProps) {
  if (plans.length === 0) return null;

  // Find best plans
  const cheapestPlan = plans.reduce((min, p) => {
    const price = p.estimatedCost?.monthlyCost || p.pricing.monthly || p.pricing.inputPer1m || Infinity;
    const minPrice = min.estimatedCost?.monthlyCost || min.pricing.monthly || min.pricing.inputPer1m || Infinity;
    return price < minPrice ? p : min;
  });

  const officialPlan = plans.find(p => p.plan.isOfficial);

  const chinaPlans = plans.filter(p => p.channel.accessFromChina);
  const bestChinaPlan = chinaPlans.length > 0
    ? chinaPlans.reduce((min, p) => {
        const price = p.estimatedCost?.monthlyCost || p.pricing.monthly || p.pricing.inputPer1m || Infinity;
        const minPrice = min.estimatedCost?.monthlyCost || min.pricing.monthly || min.pricing.inputPer1m || Infinity;
        return price < minPrice ? p : min;
      })
    : null;

  const bestValuePlan = plans
    .filter(p => p.limits.rpm && (p.pricing.monthly || p.pricing.inputPer1m))
    .reduce((best, p) => {
      const price = p.pricing.monthly || p.pricing.inputPer1m || Infinity;
      const rpm = p.limits.rpm || 1;
      const value = rpm / price; // RPM per dollar

      const bestPrice = best.pricing.monthly || best.pricing.inputPer1m || Infinity;
      const bestRpm = best.limits.rpm || 1;
      const bestValue = bestRpm / bestPrice;

      return value > bestValue ? p : best;
    }, plans[0]);

  return (
    <Card className="mb-12 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30">
      <CardContent className="pt-6">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <span>💡</span> Smart Recommendations
        </h3>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Cheapest Plan */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg p-5 border-2 border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">💰</span>
              <div>
                <h4 className="font-bold">Lowest Price</h4>
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                  Best Deal
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <p className="font-semibold text-lg">{cheapestPlan.channel.name}</p>
                {(cheapestPlan.channel.inviteUrl || cheapestPlan.channel.website) && (
                  <a
                    href={cheapestPlan.channel.inviteUrl || cheapestPlan.channel.website || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{cheapestPlan.plan.name}</p>
              {cheapestPlan.estimatedCost && (
                <p className="text-sm">
                  Est. <span className="font-bold text-green-600">${cheapestPlan.estimatedCost.monthlyCost.toFixed(2)}/mo</span>
                </p>
              )}
              {cheapestPlan.channel.accessFromChina && (
                <Badge variant="outline" className="text-xs">🇨🇳 China OK</Badge>
              )}
            </div>
          </div>

          {/* Official Plan */}
          {officialPlan && (
            <div className="bg-white dark:bg-zinc-900 rounded-lg p-5 border-2 border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🏛️</span>
                <div>
                  <h4 className="font-bold">Official Plan</h4>
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    Most Reliable
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <p className="font-semibold text-lg">{officialPlan.channel.name}</p>
                  {(officialPlan.channel.inviteUrl || officialPlan.channel.website) && (
                    <a
                      href={officialPlan.channel.inviteUrl || officialPlan.channel.website || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{officialPlan.plan.name}</p>
                {officialPlan.estimatedCost && (
                  <p className="text-sm">
                    Est. <span className="font-bold">${officialPlan.estimatedCost.monthlyCost.toFixed(2)}/mo</span>
                  </p>
                )}
                <p className="text-xs text-zinc-500">Latest features, best support</p>
              </div>
            </div>
          )}

          {/* Best for China */}
          {bestChinaPlan && (
            <div className="bg-white dark:bg-zinc-900 rounded-lg p-5 border-2 border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🇨🇳</span>
                <div>
                  <h4 className="font-bold">Best for China</h4>
                  <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                    No VPN Needed
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <p className="font-semibold text-lg">{bestChinaPlan.channel.name}</p>
                  {(bestChinaPlan.channel.inviteUrl || bestChinaPlan.channel.website) && (
                    <a
                      href={bestChinaPlan.channel.inviteUrl || bestChinaPlan.channel.website || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{bestChinaPlan.plan.name}</p>
                {bestChinaPlan.estimatedCost && (
                  <p className="text-sm">
                    Est. <span className="font-bold">${bestChinaPlan.estimatedCost.monthlyCost.toFixed(2)}/mo</span>
                  </p>
                )}
                <p className="text-xs text-zinc-500">✅ Alipay/WeChat accepted</p>
              </div>
            </div>
          )}

          {/* Best Value */}
          {bestValuePlan && (
            <div className="bg-white dark:bg-zinc-900 rounded-lg p-5 border-2 border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">📊</span>
                <div>
                  <h4 className="font-bold">Best Value</h4>
                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                    Best RPM/Price Ratio
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <p className="font-semibold text-lg">{bestValuePlan.channel.name}</p>
                  {(bestValuePlan.channel.inviteUrl || bestValuePlan.channel.website) && (
                    <a
                      href={bestValuePlan.channel.inviteUrl || bestValuePlan.channel.website || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{bestValuePlan.plan.name}</p>
                <p className="text-xs text-zinc-500">
                  {bestValuePlan.limits.rpm} RPM for best price/performance
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
