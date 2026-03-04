"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Zap, DollarSign, TrendingDown } from "lucide-react";

interface Product {
  id: number;
  name: string;
  slug: string;
  context_window: number;
  benchmark_mmlu: number;
  benchmark_arena_elo: number;
}

interface ChannelPrice {
  id: number;
  product_id: number;
  channel_id: number;
  input_price_per_1m: number;
  output_price_per_1m: number;
  channels: {
    id: number;
    name: string;
    type: string;
    access_from_china: boolean;
  };
}

export default function CompareApiPricingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [channelPrices, setChannelPrices] = useState<ChannelPrice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [productsRes, pricesRes] = await Promise.all([
          fetch("/api/products?type=llm"),
          fetch("/api/channels/1"), // This won't work, let me fix this
        ]);

        // Fetch products
        const productsData = await productsRes.json();
        setProducts(productsData.slice(0, 8)); // Top 8 models

        // Fetch channel prices for each product
        const pricesPromises = productsData.slice(0, 8).map((p: Product) =>
          fetch(`/api/channels/${p.id}`).then(res => res.json())
        );
        const allPrices = await Promise.all(pricesPromises);
        setChannelPrices(allPrices.flat());
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Get cheapest price for a product
  const getCheapestPrice = (productId: number) => {
    const prices = channelPrices.filter(cp => cp.product_id === productId);
    return prices.sort((a, b) => a.input_price_per_1m - b.input_price_per_1m)[0];
  };

  // Get official price for a product
  const getOfficialPrice = (productId: number) => {
    const prices = channelPrices.filter(cp => cp.product_id === productId);
    return prices.find(cp => cp.channels.type === 'official');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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
            <Link href="/compare/models" className="text-sm font-medium hover:text-blue-600">
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

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Compare API Pricing</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Compare API prices across different AI models to find the best value for your use case.
          </p>
        </div>

        {/* Price Comparison Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Model API Price Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Model</th>
                    <th className="text-left py-3 px-4 font-medium">Context</th>
                    <th className="text-right py-3 px-4 font-medium">Cheapest Input</th>
                    <th className="text-right py-3 px-4 font-medium">Official Input</th>
                    <th className="text-right py-3 px-4 font-medium">Output</th>
                    <th className="text-center py-3 px-4 font-medium">China</th>
                    <th className="text-right py-3 px-4 font-medium">Benchmark</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const cheapest = getCheapestPrice(product.id);
                    const official = getOfficialPrice(product.id);
                    const savings = official && cheapest
                      ? ((official.input_price_per_1m - cheapest.input_price_per_1m) / official.input_price_per_1m * 100).toFixed(0)
                      : null;

                    return (
                      <tr key={product.id} className="border-b hover:bg-zinc-50 dark:hover:bg-zinc-800">
                        <td className="py-3 px-4">
                          <Link href={`/models/${product.slug}`} className="font-medium hover:text-blue-600">
                            {product.name}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-sm text-zinc-500">
                          {product.context_window ? `${(product.context_window / 1000).toFixed(0)}K` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {cheapest ? (
                            <div>
                              <span className="font-mono font-medium text-green-600">
                                ${cheapest.input_price_per_1m.toFixed(2)}
                              </span>
                              <span className="text-xs text-zinc-500 block">{cheapest.channels.name}</span>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          ${official?.input_price_per_1m?.toFixed(2) || '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          ${official?.output_price_per_1m?.toFixed(2) || '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {cheapest?.channels.access_from_china ? (
                            <Badge className="bg-green-100 text-green-800">✓</Badge>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-sm">
                          {product.benchmark_arena_elo ? (
                            <Badge variant="outline">ELO: {product.benchmark_arena_elo}</Badge>
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Value Analysis */}
        <div className="grid md:grid-cols-2 gap-6 mt-8">
          {/* Best Value Models */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Best Value Models
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex justify-between items-center">
                  <span>DeepSeek V3</span>
                  <div className="text-right">
                    <span className="font-mono text-green-600 font-medium">$0.27/1M</span>
                    <p className="text-xs text-zinc-500">Best for price-sensitive users</p>
                  </div>
                </li>
                <li className="flex justify-between items-center">
                  <span>GPT-4o Mini</span>
                  <div className="text-right">
                    <span className="font-mono text-green-600 font-medium">$0.15/1M</span>
                    <p className="text-xs text-zinc-500">Fast & affordable GPT-4</p>
                  </div>
                </li>
                <li className="flex justify-between items-center">
                  <span>Claude 3.5 Haiku</span>
                  <div className="text-right">
                    <span className="font-mono text-green-600 font-medium">$0.25/1M</span>
                    <p className="text-xs text-zinc-500">Best balance of speed & quality</p>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Best Performance Models */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-blue-500" />
                Best Performance Models
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex justify-between items-center">
                  <span>Gemini 1.5 Pro</span>
                  <div className="text-right">
                    <span className="font-medium">ELO: 1350</span>
                    <p className="text-xs text-zinc-500">2M context window</p>
                  </div>
                </li>
                <li className="flex justify-between items-center">
                  <span>Claude 3.5 Sonnet</span>
                  <div className="text-right">
                    <span className="font-medium">ELO: 1340</span>
                    <p className="text-xs text-zinc-500">200K context, best writing</p>
                  </div>
                </li>
                <li className="flex justify-between items-center">
                  <span>GPT-4o</span>
                  <div className="text-right">
                    <span className="font-medium">ELO: 1337</span>
                    <p className="text-xs text-zinc-500">Most versatile</p>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* CTA */}
        <Card className="mt-8 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950/30 dark:to-green-950/30">
          <CardContent className="py-6 text-center">
            <h3 className="font-bold text-lg mb-2">Need a specific model comparison?</h3>
            <p className="text-zinc-600 mb-4">
              Check out our detailed channel-by-channel price comparison for any model.
            </p>
            <Link href="/api-pricing">
              <Button className="gap-2">
                View All Prices <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
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
