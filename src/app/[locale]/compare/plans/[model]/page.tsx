"use client";

import React, { use, useState, useEffect } from "react";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ModelInfoCard } from "@/components/compare/ModelInfoCard";
import { CompareFilters } from "@/components/compare/CompareFilters";
import { CompareTable } from "@/components/compare/CompareTable";
import { SmartRecommendation } from "@/components/compare/SmartRecommendation";

interface ComparePageProps {
  params: Promise<{ locale: string; model: string }>;
}

export default function ComparePlansModelPage({ params }: ComparePageProps) {
  const { locale, model: modelSlug } = use(params);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  // Filter states
  const [region, setRegion] = useState("all");
  const [billingType, setBillingType] = useState("all");
  const [sortBy, setSortBy] = useState("price_asc");
  const [currency, setCurrency] = useState("USD");
  const [showYearly, setShowYearly] = useState(true);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  // Fetch data
  useEffect(() => {
    if (!modelSlug) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams({
          model: modelSlug,
          region,
          billingType,
          sortBy,
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
  }, [modelSlug, region, billingType, sortBy, showYearly]);

  // Extract all unique features from plans
  const allFeatures = React.useMemo(() => {
    if (!data) return [];
    const features = new Set<string>();
    const allPlans = [...(data.officialPlans || []), ...(data.thirdPartyPlans || [])];
    allPlans.forEach((plan: any) => {
      if (plan.plan.features) {
        plan.plan.features.forEach((f: string) => features.add(f));
      }
    });
    return Array.from(features).sort();
  }, [data]);

  // Filter plans by selected features
  const filteredPlans = React.useMemo(() => {
    if (!data || selectedFeatures.length === 0) return data;
    const filtered = { ...data };
    const filterByFeatures = (plans: any[]) => {
      return plans.filter((plan: any) => {
        if (!plan.plan.features) return false;
        return selectedFeatures.every(f => plan.plan.features.includes(f));
      });
    };
    filtered.officialPlans = filterByFeatures(data.officialPlans || []);
    filtered.thirdPartyPlans = filterByFeatures(data.thirdPartyPlans || []);
    filtered.summary = {
      ...filtered.summary,
      totalPlans: (filtered.officialPlans?.length || 0) + (filtered.thirdPartyPlans?.length || 0),
    };
    return filtered;
  }, [data, selectedFeatures]);

  // Share button - copy URL to clipboard
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!filteredPlans) return;
    const { officialPlans, thirdPartyPlans, model } = filteredPlans;
    const allPlans = [...(officialPlans || []), ...(thirdPartyPlans || [])];

    const headers = ["Provider", "Plan", "Monthly Price", "Currency", "Region", "Features"];
    const rows = allPlans.map((plan: any) => [
      plan.channel.name,
      plan.plan.name,
      plan.pricing.monthly || "",
      plan.pricing.currency || "",
      plan.channel.region,
      (plan.plan.features || []).join("; "),
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${model?.name || "plans"}-comparison.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleFeature = (feature: string) => {
    setSelectedFeatures(prev =>
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
  };

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
              <Link href={`/${locale}/coupons`} className="text-sm font-medium hover:text-blue-600">
                Coupons
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
              <Link href={`/${locale}/coupons`} className="text-sm font-medium hover:text-blue-600">
                Coupons
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

  const { model, officialPlans, thirdPartyPlans, summary } = filteredPlans || data;
  const allPlans = [...(officialPlans || []), ...(thirdPartyPlans || [])];

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
            <Link href={`/${locale}/coupons`} className="text-sm font-medium hover:text-blue-600">
              Coupons
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

        {/* Model Info */}
        <ModelInfoCard
          model={model}
          planCount={filteredPlans?.summary?.totalPlans || summary?.totalPlans || 0}
          lowestPrice={filteredPlans?.summary?.cheapestPlan?.effectiveMonthly || summary?.cheapestPlan?.effectiveMonthly || 0}
        />

        {/* Filters */}
        <CompareFilters
          region={region}
          billingType={billingType}
          sortBy={sortBy}
          currency={currency}
          showYearly={showYearly}
          onRegionChange={setRegion}
          onBillingTypeChange={setBillingType}
          onSortByChange={setSortBy}
          onCurrencyChange={setCurrency}
          onShowYearlyChange={setShowYearly}
        />

        {/* Feature Filter */}
        {allFeatures.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold mb-2">Filter by Features</h4>
            <div className="flex flex-wrap gap-2">
              {allFeatures.slice(0, 12).map((feature: string) => (
                <button
                  key={feature}
                  onClick={() => toggleFeature(feature)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    selectedFeatures.includes(feature)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                  }`}
                >
                  {feature}
                </button>
              ))}
              {selectedFeatures.length > 0 && (
                <button
                  onClick={() => setSelectedFeatures([])}
                  className="px-3 py-1 text-xs rounded-full border border-zinc-300 dark:border-zinc-600 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Comparison Table */}
        <CompareTable
          officialPlans={officialPlans || []}
          thirdPartyPlans={thirdPartyPlans || []}
          currency={currency}
          showYearly={showYearly}
        />

        {/* Smart Recommendations */}
        <SmartRecommendation
          plans={filteredPlans ? [...(filteredPlans.officialPlans || []), ...(filteredPlans.thirdPartyPlans || [])] : allPlans}
          region={region}
        />

        {/* Footer Info */}
        <div className="bg-zinc-100 dark:bg-zinc-900 rounded-lg p-6 mb-8">
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

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 justify-center">
          <button
            onClick={handleShare}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            {shareCopied ? "✓ Copied!" : "📤 Share"}
          </button>
          <button
            onClick={handleExportCSV}
            className="px-6 py-3 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
          >
            📥 Export CSV
          </button>
          <button
            className="px-6 py-3 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-400 dark:text-zinc-500 cursor-not-allowed flex items-center gap-2"
            disabled
          >
            🔔 Price alerts (coming soon)
          </button>
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
