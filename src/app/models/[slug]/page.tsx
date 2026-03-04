import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Check, ExternalLink, TrendingDown, Zap, Globe } from "lucide-react";
import { supabase } from "@/lib/supabase";

// Channel type labels
const channelTypeLabels: Record<string, { label: string; color: string }> = {
  official: { label: "官方", color: "bg-blue-100 text-blue-800" },
  cloud: { label: "云厂商", color: "bg-purple-100 text-purple-800" },
  aggregator: { label: "聚合平台", color: "bg-green-100 text-green-800" },
  reseller: { label: "转售商", color: "bg-orange-100 text-orange-800" },
};

async function getProductWithChannels(slug: string) {
  // Get product with provider info
  const { data: product } = await supabase
    .from('products')
    .select(`
      *,
      providers (
        id,
        name,
        slug,
        logo_url
      )
    `)
    .eq('slug', slug)
    .single();

  if (!product) return null;

  // Get channel prices
  const { data: channelPrices } = await supabase
    .from('channel_prices')
    .select(`
      *,
      channels:channel_id (
        id,
        name,
        slug,
        type,
        logo,
        website_url,
        region,
        access_from_china,
        description
      )
    `)
    .eq('product_id', product.id)
    .eq('is_available', true)
    .order('input_price_per_1m', { ascending: true });

  return { product, channelPrices: channelPrices || [] };
}

export default async function ModelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getProductWithChannels(slug);

  if (!data) {
    notFound();
  }

  const { product, channelPrices } = data;

  // Find official and cheapest
  const officialChannel = channelPrices.find((cp: any) => cp.channels.type === 'official');
  const cheapestChannel = channelPrices[0];

  // Calculate savings
  const calculateSavings = (price: number, officialPrice: number) => {
    if (!officialPrice || !price) return null;
    const savings = ((officialPrice - price) / officialPrice) * 100;
    return savings > 0 ? savings.toFixed(1) : null;
  };

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
            <Link href="/api-pricing" className="text-sm font-medium text-blue-600">
              API Pricing
            </Link>
            <Link href="/coupons" className="text-sm font-medium hover:text-blue-600">
              Coupons
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
          <Link href="/api-pricing" className="flex items-center gap-1 hover:text-blue-600">
            <ArrowLeft className="w-4 h-4" /> Back to API Pricing
          </Link>
        </div>

        {/* Product Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            {product.providers?.logo_url && (
              <img
                src={product.providers.logo_url}
                alt={product.providers.name}
                className="w-16 h-16 object-contain"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold">{product.name}</h1>
              <p className="text-zinc-600">{product.providers?.name} • API Price Comparison</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {product.context_window && (
              <Badge variant="outline" className="text-sm">
                📏 Context: {product.context_window.toLocaleString()} tokens
              </Badge>
            )}
            {product.benchmark_arena_elo && (
              <Badge variant="outline" className="text-sm">
                🏆 Arena ELO: {Math.round(product.benchmark_arena_elo)}
              </Badge>
            )}
            {product.benchmark_mmlu && (
              <Badge variant="outline" className="text-sm">
                📊 MMLU: {product.benchmark_mmlu}%
              </Badge>
            )}
            {product.benchmark_human_eval && (
              <Badge variant="outline" className="text-sm">
                💻 HumanEval: {product.benchmark_human_eval}%
              </Badge>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Cheapest Option */}
          <Card className={cheapestChannel?.id === officialChannel?.id ? "border-blue-500" : "border-green-500"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="w-4 h-4 text-green-600" /> 💰 Cheapest Option
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{cheapestChannel?.channels?.name || 'N/A'}</div>
              <div className="text-3xl font-bold text-green-600 mt-1">
                ${cheapestChannel?.input_price_per_1m?.toFixed(2)}
                <span className="text-sm font-normal text-zinc-500">/1M input</span>
              </div>
              <div className="text-xl text-zinc-600 mt-1">
                ${cheapestChannel?.output_price_per_1m?.toFixed(2)}
                <span className="text-sm font-normal text-zinc-500">/1M output</span>
              </div>
              {cheapestChannel?.id !== officialChannel?.id && officialChannel && (
                <div className="text-sm text-green-600 mt-2 font-medium">
                  💸 Save {calculateSavings(cheapestChannel?.input_price_per_1m, officialChannel?.input_price_per_1m)}% vs official
                </div>
              )}
              {cheapestChannel?.channels?.access_from_china && (
                <Badge className="mt-2 bg-green-100 text-green-800">🇨🇳 China Available</Badge>
              )}
            </CardContent>
          </Card>

          {/* Official Price */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600" /> 🏢 Official Price
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{officialChannel?.channels?.name || 'N/A'}</div>
              {officialChannel ? (
                <>
                  <div className="text-3xl font-bold mt-1">
                    ${officialChannel.input_price_per_1m?.toFixed(2)}
                    <span className="text-sm font-normal text-zinc-500">/1M input</span>
                  </div>
                  <div className="text-xl text-zinc-600 mt-1">
                    ${officialChannel.output_price_per_1m?.toFixed(2)}
                    <span className="text-sm font-normal text-zinc-500">/1M output</span>
                  </div>
                  {officialChannel.channels?.access_from_china ? (
                    <Badge variant="outline" className="mt-2">🇨🇳 China Available</Badge>
                  ) : (
                    <Badge variant="outline" className="mt-2 bg-red-50 text-red-800">🚫 Not available in China</Badge>
                  )}
                </>
              ) : (
                <div className="text-zinc-500 mt-2">No official channel available</div>
              )}
            </CardContent>
          </Card>

          {/* China-Friendly Option */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                🇨🇳 Best in China
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const chinaOptions = channelPrices.filter((cp: any) => cp.channels.access_from_china);
                const cheapestChina = chinaOptions[0];
                return cheapestChina ? (
                  <>
                    <div className="text-2xl font-bold">{cheapestChina.channels.name}</div>
                    <div className="text-3xl font-bold mt-1">
                      ${cheapestChina.input_price_per_1m?.toFixed(2)}
                      <span className="text-sm font-normal text-zinc-500">/1M input</span>
                    </div>
                    <div className="text-xl text-zinc-600 mt-1">
                      ${cheapestChina.output_price_per_1m?.toFixed(2)}
                      <span className="text-sm font-normal text-zinc-500">/1M output</span>
                    </div>
                    <Badge className="mt-2 bg-green-100 text-green-800">
                      支付宝/微信可用
                    </Badge>
                  </>
                ) : (
                  <div className="text-zinc-500">No China-friendly options</div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        <Separator className="my-8" />

        {/* Detailed Comparison Table */}
        <Card>
          <CardHeader>
            <CardTitle>📊 Channel Price Comparison</CardTitle>
            <CardDescription>
              Compare {product.name} API prices across all available channels • {channelPrices.length} channels available
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Input / 1M</TableHead>
                    <TableHead className="text-right">Output / 1M</TableHead>
                    <TableHead className="text-center">Rate Limit</TableHead>
                    <TableHead className="text-center">China</TableHead>
                    <TableHead className="text-right">vs Official</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channelPrices.map((cp: any, idx: number) => {
                    const isOfficial = cp.channels.type === 'official';
                    const isCheapest = idx === 0;
                    const savings = calculateSavings(cp.input_price_per_1m, officialChannel?.input_price_per_1m);

                    return (
                      <TableRow key={cp.id} className={isCheapest ? "bg-green-50 dark:bg-green-950/30" : ""}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {cp.channels.name}
                            {isCheapest && (
                              <Badge className="bg-green-600 text-xs">💰 Best Price</Badge>
                            )}
                            {isOfficial && (
                              <Badge variant="outline" className="text-xs">🏢 Official</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${channelTypeLabels[cp.channels.type]?.color || 'bg-gray-100'}`}>
                            {channelTypeLabels[cp.channels.type]?.label || cp.channels.type}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${cp.input_price_per_1m?.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${cp.output_price_per_1m?.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {cp.rate_limit || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {cp.channels.access_from_china ? (
                            <Check className="w-4 h-4 text-green-600 mx-auto" />
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {savings ? (
                            <span className={Number(savings) > 0 ? "text-green-600 font-medium" : "text-zinc-400"}>
                              {Number(savings) > 0 ? `-${savings}%` : '-'}
                            </span>
                          ) : isOfficial ? (
                            <span className="text-blue-600 font-medium">Baseline</span>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {cp.channels.website_url && (
                            <a
                              href={cp.channels.website_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="outline" size="sm" className="gap-1">
                                Visit <ExternalLink className="w-3 h-3" />
                              </Button>
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Estimated Costs */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>💵 Estimated Monthly Costs</CardTitle>
            <CardDescription>
              Based on typical usage patterns (input:output = 2:1 ratio)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usage Level</TableHead>
                    <TableHead>Tokens/Month</TableHead>
                    {channelPrices.slice(0, 4).map((cp: any) => (
                      <TableHead key={cp.id} className="text-right">
                        {cp.channels.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { level: '🐣 Light', inputTokens: 100000, outputTokens: 50000 },
                    { level: '📊 Medium', inputTokens: 1000000, outputTokens: 500000 },
                    { level: '🚀 Heavy', inputTokens: 10000000, outputTokens: 5000000 },
                    { level: '🏢 Enterprise', inputTokens: 100000000, outputTokens: 50000000 },
                  ].map((usage) => (
                    <TableRow key={usage.level}>
                      <TableCell className="font-medium">{usage.level}</TableCell>
                      <TableCell>
                        {(usage.inputTokens / 1000000).toFixed(1)}M in + {(usage.outputTokens / 1000000).toFixed(1)}M out
                      </TableCell>
                      {channelPrices.slice(0, 4).map((cp: any) => {
                        const cost =
                          (cp.input_price_per_1m * usage.inputTokens) / 1000000 +
                          (cp.output_price_per_1m * usage.outputTokens) / 1000000;
                        return (
                          <TableCell key={cp.id} className="text-right font-mono font-semibold">
                            ${cost.toFixed(2)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
          <p className="text-sm text-zinc-500">
            Prices updated daily • Last verified: {new Date().toLocaleDateString()} • {channelPrices.length} channels tracked
          </p>
        </div>
      </footer>
    </div>
  );
}
