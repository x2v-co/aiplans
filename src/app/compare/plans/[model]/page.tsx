"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ModelInfoCard } from "@/components/compare/ModelInfoCard";
import { CompareFilters } from "@/components/compare/CompareFilters";
import { UsageEstimator } from "@/components/compare/UsageEstimator";
import { CompareTable } from "@/components/compare/CompareTable";
import { SmartRecommendation } from "@/components/compare/SmartRecommendation";

interface ComparePageProps {
  params: Promise<{ model: string }>;
}

export default function ComparePlansModelPage({ params }: ComparePageProps) {
  const [modelSlug, setModelSlug] = useState<string>("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [region, setRegion] = useState("all");
  const [billingType, setBillingType] = useState("all");
  const [sortBy, setSortBy] = useState("price_asc");
  const [currency, setCurrency] = useState("USD");
  const [showYearly, setShowYearly] = useState(true);
  const [usageEstimate, setUsageEstimate] = useState<any>(null);

  // Unwrap params
  useEffect(() => {
    params.then((p) => setModelSlug(p.model));
  }, [params]);

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

        if (usageEstimate) {
          queryParams.append("usageEstimate", JSON.stringify(usageEstimate));
        }

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
  }, [modelSlug, region, billingType, sortBy, showYearly, usageEstimate]);

  const handleEstimateChange = (estimate: any) => {
    setUsageEstimate(estimate);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
        <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 dark:bg-black/80">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">💰</span>
              <span className="text-xl font-bold">aiplans.dev</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/" className="text-sm font-medium hover:text-blue-600">
                Home
              </Link>
              <Link href="/api-pricing" className="text-sm font-medium hover:text-blue-600">
                API Pricing
              </Link>
              <Link href="/compare/plans" className="text-sm font-medium text-blue-600">
                Compare Plans
              </Link>
              <Link href="/coupons" className="text-sm font-medium hover:text-blue-600">
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
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">💰</span>
              <span className="text-xl font-bold">aiplans.dev</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/" className="text-sm font-medium hover:text-blue-600">
                Home
              </Link>
              <Link href="/api-pricing" className="text-sm font-medium hover:text-blue-600">
                API Pricing
              </Link>
              <Link href="/compare/plans" className="text-sm font-medium text-blue-600">
                Compare Plans
              </Link>
              <Link href="/coupons" className="text-sm font-medium hover:text-blue-600">
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
            <Link href="/compare/plans" className="text-blue-600 hover:underline">
              ← Back to model selection
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const { model, officialPlans, thirdPartyPlans, summary } = data;
  const allPlans = [...officialPlans, ...thirdPartyPlans];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 dark:bg-black/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">💰</span>
            <span className="text-xl font-bold">aiplans.dev</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-sm font-medium hover:text-blue-600">
              Home
            </Link>
            <Link href="/compare/plans" className="text-sm font-medium text-blue-600">
              Compare Plans
            </Link>
            <Link href="/api-pricing" className="text-sm font-medium hover:text-blue-600">
              API Pricing
            </Link>
            <Link href="/coupons" className="text-sm font-medium hover:text-blue-600">
              Coupons
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
          <Link href="/" className="hover:text-blue-600">Home</Link>
          <span>/</span>
          <Link href="/compare/plans" className="hover:text-blue-600">Compare Plans</Link>
          <span>/</span>
          <span className="text-zinc-900 dark:text-zinc-100">{model.name}</span>
        </div>

        {/* Model Info */}
        <ModelInfoCard
          model={model}
          planCount={summary.totalPlans}
          lowestPrice={summary.cheapestPlan?.effectiveMonthly || 0}
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

        {/* Usage Estimator */}
        <UsageEstimator onEstimateChange={handleEstimateChange} />

        {/* Comparison Table */}
        <CompareTable
          officialPlans={officialPlans}
          thirdPartyPlans={thirdPartyPlans}
          currency={currency}
          showYearly={showYearly}
        />

        {/* Smart Recommendations */}
        <SmartRecommendation
          plans={allPlans}
          region={region}
        />

        {/* Footer Info */}
        <div className="bg-zinc-100 dark:bg-zinc-900 rounded-lg p-6 mb-8">
          <h3 className="font-semibold mb-4">📝 Notes</h3>
          <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <li>• Prices last updated: {new Date().toLocaleDateString()}</li>
            <li>• Exchange rate: 1 USD = 6.90 CNY (real-time)</li>
            <li>• Estimated costs are calculated based on your usage input</li>
            <li>• Actual costs may vary based on usage patterns, cache hit rates, and other factors</li>
            <li>
              • Data sources: Official pricing pages from each provider{" "}
              <a href="#" className="text-blue-600 hover:underline">
                [View sources]
              </a>
            </li>
            <li>
              • Found a pricing error?{" "}
              <a href="#" className="text-blue-600 hover:underline">
                📮 Report an issue
              </a>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 justify-center">
          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            📤 Share this comparison
          </button>
          <button className="px-6 py-3 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            📥 Export to CSV
          </button>
          <button className="px-6 py-3 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            🔔 Price change alerts
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
            <Link href="/about" className="hover:text-blue-600">About</Link>
            <Link href="/api" className="hover:text-blue-600">API</Link>
            <Link href="/blog" className="hover:text-blue-600">Blog</Link>
            <Link href="/contact" className="hover:text-blue-600">Contact</Link>
          </nav>
          <p className="text-sm text-zinc-500">
            © 2026 aiplans.dev - Compare AI pricing & save money
          </p>
        </div>
      </footer>
    </div>
  );
}
