"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ArrowRight, Check, X, Zap, Shield, TrendingUp, DollarSign, Brain, Clock, Image, Code } from "lucide-react";

interface Model {
  id: number;
  name: string;
  slug: string;
  provider_ids: number[];
  context_window: number;
  benchmark_arena_elo: number | null;
}

interface ChannelPrice {
  id: number;
  model_id: number;
  input_price_per_1m: number;
  output_price_per_1m: number;
  providers: {
    type: string;
  };
}

// Provider info
const providerMeta: Record<number, { name: string; logo: string; color: string }> = {
  1: { name: "OpenAI", logo: "🤖", color: "text-green-600" },
  2: { name: "Anthropic", logo: "🧠", color: "text-orange-600" },
  3: { name: "DeepSeek", logo: "🔮", color: "text-purple-600" },
  4: { name: "Google", logo: "🌐", color: "text-blue-600" },
  5: { name: "Meta", logo: "🦙", color: "text-indigo-600" },
};

export default function CompareModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [channelPrices, setChannelPrices] = useState<ChannelPrice[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [modelsRes, pricesRes] = await Promise.all([
          fetch("/api/products?type=llm"),
          fetch("/api/channels/1"),
        ]);

        // Fetch all products
        const modelsData = await modelsRes.json();
        setModels(modelsData.slice(0, 10)); // Top 10 models

        // Fetch channel prices for each product
        const pricesPromises = modelsData.slice(0, 10).map((m: Model) =>
          fetch(`/api/channels/${m.id}`).then(res => res.json())
        );
        const allPrices = await Promise.all(pricesPromises);
        setChannelPrices(allPrices.flat());

        // Default: select GPT-4o and Claude 3.5 Sonnet
        const defaultModels = modelsData.slice(0, 10).filter((m: Model) =>
          m.slug === "gpt-4o" || m.slug === "claude-3-5-sonnet"
        );
        setSelectedModels(defaultModels.map((m: Model) => m.slug));
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const getModelPrice = (modelId: number) => {
    const prices = channelPrices.filter(cp => cp.model_id === modelId);
    return prices.sort((a, b) => a.input_price_per_1m - b.input_price_per_1m)[0];
  };

  const getOfficialPrice = (modelId: number) => {
    const prices = channelPrices.filter(cp => cp.model_id === modelId);
    return prices.find(cp => cp.providers.type === 'official');
  };

  const handleModelSelect = (slug: string) => {
    setSelectedModels(prev => {
      if (prev.includes(slug)) {
        return prev.filter(m => m !== slug);
      }
      if (prev.length >= 4) {
        return [...prev.slice(1), slug];
      }
      return [...prev, slug];
    });
  };

  const getModelBySlug = (slug: string) => models.find(m => m.slug === slug);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const selectedModelsData = selectedModels.map(slug => getModelBySlug(slug)).filter(Boolean) as Model[];

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
            <Link href="/compare/plans" className="text-sm font-medium hover:text-blue-600">
              Compare Plans
            </Link>
            <Link href="/compare/models" className="text-sm font-medium text-blue-600">
              Model Compare
            </Link>
            <Link href="/coupons" className="text-sm font-medium hover:text-blue-600">
              Coupons
            </Link>
            <Link href="/api-pricing" className="text-sm font-medium hover:text-blue-600">
              API Pricing
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
          <Link href="/" className="flex items-center gap-1 hover:text-blue-600">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Compare AI Models</h1>
          <p className="text-zinc-600">
            Select models to compare benchmarks, pricing, context, and features.
          </p>
        </div>

        {/* Model Selector */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Select Models to Compare (2-4)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {models.map((model) => {
                const isSelected = selectedModels.includes(model.slug);
                const provider = providerMeta[model.provider_ids?.[0]] || { name: "Unknown", logo: "🏢", color: "text-gray-600" };

                return (
                  <Button
                    key={model.id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleModelSelect(model.slug)}
                    className="gap-2"
                  >
                    <span>{provider.logo}</span>
                    <span>{model.name}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </Button>
                );
              })}
            </div>
            <p className="text-sm text-zinc-500">
              Click to select/deselect models. Maximum 4 models. Clicking a 5th model will replace the first selection.
            </p>
          </CardContent>
        </Card>

        {selectedModelsData.length < 2 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-zinc-500">Please select at least 2 models to compare.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Comparison Cards */}
            <div className={`grid gap-6 mb-8 ${selectedModelsData.length === 2 ? 'md:grid-cols-2' : selectedModelsData.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
              {selectedModelsData.map((model) => {
                const provider = providerMeta[model.provider_ids?.[0]] || { name: "Unknown", logo: "🏢", color: "text-gray-600" };
                const price = getModelPrice(model.id);
                const officialPrice = getOfficialPrice(model.id);

                return (
                  <Card key={model.id} className="overflow-hidden">
                    <div className={`${provider.color.replace('text-', 'bg-')} bg-opacity-10 px-4 py-3`}>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{provider.logo}</span>
                        <div>
                          <div className="font-semibold">{model.name}</div>
                          <div className="text-xs text-zinc-500">{provider.name}</div>
                        </div>
                      </div>
                    </div>
                    <CardContent className="p-4 space-y-3">
                      {/* Benchmarks */}
                      <div className="bg-zinc-50 rounded p-2 col-span-3">
                          <div className="text-lg font-bold">{model.benchmark_arena_elo || '-'}</div>
                          <div className="text-xs text-zinc-500">Arena ELO</div>
                        </div>

                      {/* Specs */}
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Context</span>
                          <span className="font-medium">{(model.context_window / 1000).toFixed(0)}K</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Input</span>
                          <span className="font-mono">${price?.input_price_per_1m?.toFixed(2) || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Output</span>
                          <span className="font-mono">${price?.output_price_per_1m?.toFixed(2) || '-'}</span>
                        </div>
                      </div>

                      {/* Link */}
                      <Link href={`/models/${model.slug}`}>
                        <Button variant="outline" size="sm" className="w-full gap-1">
                          Details <ArrowRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Detailed Comparison Table */}
            <Card>
              <CardHeader>
                <CardTitle>Detailed Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/4">Feature</TableHead>
                      {selectedModelsData.map((model) => {
                        const provider = providerMeta[model.provider_ids?.[0]] || { name: "Unknown", logo: "🏢" };
                        return (
                          <TableHead key={model.id} className="text-center">
                            <span className={provider.color}>{provider.logo} {model.name}</span>
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Benchmarks */}
                    <TableRow className="bg-zinc-50">
                      <TableCell colSpan={selectedModelsData.length + 1} className="font-semibold">
                        📊 Benchmarks
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Chatbot Arena ELO</TableCell>
                      {selectedModelsData.map((model, idx) => {
                        const maxElo = Math.max(...selectedModelsData.map(m => m.benchmark_arena_elo || 0));
                        const isMax = model.benchmark_arena_elo === maxElo && maxElo > 0;
                        return (
                          <TableCell key={model.id} className="text-center font-medium">
                            {model.benchmark_arena_elo || '-'}
                            {isMax && <Badge className="ml-1 bg-green-100 text-green-800 text-xs">Best</Badge>}
                          </TableCell>
                        );
                      })}
                    </TableRow>

                    {/* Context */}
                    <TableRow className="bg-zinc-50">
                      <TableCell colSpan={selectedModelsData.length + 1} className="font-semibold">
                        ⚡ Context & Speed
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Context Window</TableCell>
                      {selectedModelsData.map((model) => {
                        const maxCtx = Math.max(...selectedModelsData.map(m => m.context_window || 0));
                        const isMax = model.context_window === maxCtx && maxCtx > 0;
                        return (
                          <TableCell key={model.id} className="text-center font-medium">
                            {model.context_window ? `${(model.context_window / 1000).toFixed(0)}K` : '-'}
                            {isMax && <Badge className="ml-1 bg-orange-100 text-orange-800 text-xs">Largest</Badge>}
                          </TableCell>
                        );
                      })}
                    </TableRow>

                    {/* Pricing */}
                    <TableRow className="bg-zinc-50">
                      <TableCell colSpan={selectedModelsData.length + 1} className="font-semibold">
                        💰 API Pricing (per 1M tokens)
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Input Price</TableCell>
                      {selectedModelsData.map((model) => {
                        const price = getModelPrice(model.id);
                        const minPrice = Math.min(...selectedModelsData.map(m => getModelPrice(m.id)?.input_price_per_1m || Infinity));
                        const isMin = price?.input_price_per_1m === minPrice && minPrice < Infinity;
                        return (
                          <TableCell key={model.id} className="text-center font-mono font-medium">
                            ${price?.input_price_per_1m?.toFixed(2) || '-'}
                            {isMin && <Badge className="ml-1 bg-green-100 text-green-800 text-xs">Cheapest</Badge>}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                    <TableRow>
                      <TableCell>Output Price</TableCell>
                      {selectedModelsData.map((model) => {
                        const price = getModelPrice(model.id);
                        const minPrice = Math.min(...selectedModelsData.map(m => getModelPrice(m.id)?.output_price_per_1m || Infinity));
                        const isMin = price?.output_price_per_1m === minPrice && minPrice < Infinity;
                        return (
                          <TableCell key={model.id} className="text-center font-mono">
                            ${price?.output_price_per_1m?.toFixed(2) || '-'}
                            {isMin && <Badge className="ml-1 bg-green-100 text-green-800 text-xs">Cheapest</Badge>}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                    <TableRow>
                      <TableCell>vs Official</TableCell>
                      {selectedModelsData.map((model) => {
                        const official = getOfficialPrice(model.id);
                        const current = getModelPrice(model.id);
                        if (!official || !current) {
                          return <TableCell key={model.id} className="text-center">-</TableCell>;
                        }
                        const savings = ((official.input_price_per_1m - current.input_price_per_1m) / official.input_price_per_1m * 100);
                        return (
                          <TableCell key={model.id} className="text-center">
                            {savings > 0 ? (
                              <span className="text-green-600 font-medium">-{savings.toFixed(0)}%</span>
                            ) : (
                              <span className="text-zinc-400">-</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>

                    {/* Links */}
                    <TableRow className="bg-zinc-50">
                      <TableCell colSpan={selectedModelsData.length + 1} className="font-semibold">
                        🔗 Quick Links
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Channel Prices</TableCell>
                      {selectedModelsData.map((model) => (
                        <TableCell key={model.id} className="text-center">
                          <Link href={`/models/${model.slug}`}>
                            <Button variant="outline" size="sm">
                              View All Prices →
                            </Button>
                          </Link>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Recommendation based on selection */}
            {selectedModelsData.length >= 2 && (
              <Card className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30">
                <CardContent className="py-6">
                  <h3 className="font-bold text-lg mb-4">💡 Quick Recommendation</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {selectedModelsData.slice(0, 2).map((model) => {
                      const provider = providerMeta[model.provider_ids?.[0]] || { name: "Unknown", logo: "🏢" };
                      const price = getModelPrice(model.id);
                      const hasHighElo = (model.benchmark_arena_elo || 0) > 1300;
                      const hasLargeContext = (model.context_window || 0) > 100000;
                      const isCheap = (price?.input_price_per_1m || 0) < 1;

                      return (
                        <div key={model.id} className="bg-white dark:bg-zinc-800 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">{provider.logo}</span>
                            <span className="font-semibold">{model.name}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {hasHighElo && <Badge className="bg-green-100 text-green-800">High Performance</Badge>}
                            {hasLargeContext && <Badge className="bg-blue-100 text-blue-800">Large Context</Badge>}
                            {isCheap && <Badge className="bg-purple-100 text-purple-800">Budget Friendly</Badge>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">💰</span>
            <span className="font-medium">aiplans.dev</span>
          </div>
          <p className="text-sm text-zinc-500">© 2026 aiplans.dev - Compare AI pricing & save money</p>
        </div>
      </footer>
    </div>
  );
}
