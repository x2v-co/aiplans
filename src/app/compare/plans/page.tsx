import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp, Building2, Zap, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

// Hot models for quick access
const hotModels = [
  "gpt-4o",
  "claude-3-5-sonnet",
  "deepseek-v3",
  "gemini-1-5-pro",
  "claude-3-opus",
  "gpt-4o-mini",
  "llama-3-1-405b",
  "qwen-max",
];

async function getModelsWithPlanCounts() {
  const { data: products } = await supabase
    .from('products')
    .select(`
      *,
      providers:provider_id (
        id,
        name,
        slug,
        logo
      )
    `)
    .eq('type', 'llm')
    .order('benchmark_arena_elo', { ascending: false });

  if (!products) return [];

  // Get plan counts for each product
  const { data: mappings } = await supabase
    .from('model_plan_mapping')
    .select('product_id, plan_id')
    .eq('is_available', true);

  const planCounts = new Map<number, number>();
  (mappings || []).forEach((m: any) => {
    planCounts.set(m.product_id, (planCounts.get(m.product_id) || 0) + 1);
  });

  return products.map((p) => ({
    ...p,
    provider: p.providers,
    planCount: planCounts.get(p.id) || 0,
  }));
}

async function getProviders() {
  const { data } = await supabase
    .from('providers')
    .select('*')
    .order('name');
  return data || [];
}

export default async function ComparePlansIndexPage() {
  const models = await getModelsWithPlanCounts();
  const providers = await getProviders();

  // Filter hot models
  const hotModelsList = models.filter((m) => hotModels.includes(m.slug));

  // Group models by provider
  const modelsByProvider = providers.map((provider) => ({
    provider,
    models: models.filter((m) => m.provider?.id === provider.id),
  }));

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
            <Link href="/api-pricing" className="text-sm font-medium hover:text-blue-600">
              API Pricing
            </Link>
            <Link href="/compare/plans" className="text-sm font-medium text-blue-600">
              Compare Plans
            </Link>
            <Link href="/coupons" className="text-sm font-medium hover:text-blue-600">
              Coupons
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">🆚 Compare AI Plans</h1>
          <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-8">
            Select a model to compare all available plans across providers
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-zinc-400 w-5 h-5" />
            <Input
              type="search"
              placeholder='Search model name... (e.g., "Claude Sonnet", "GPT-4o")'
              className="pl-12 h-14 text-lg"
            />
          </div>
        </div>

        {/* Hot Models Section */}
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-6 h-6 text-red-500" />
            <h2 className="text-2xl font-bold">🔥 Hot Models</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {hotModelsList.map((model) => (
              <Link key={model.id} href={`/compare/plans/${model.slug}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {model.provider?.logo && (
                          <img src={model.provider.logo} alt={model.provider.name} className="w-10 h-10 object-contain" />
                        )}
                        <div>
                          <h3 className="font-bold text-lg leading-tight">{model.name}</h3>
                          <p className="text-sm text-zinc-500">{model.provider?.name}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      {model.benchmark_arena_elo && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-500">Arena ELO</span>
                          <Badge variant="secondary">{Math.round(model.benchmark_arena_elo)}</Badge>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Plans Available</span>
                        <Badge variant="outline">{model.planCount} plans</Badge>
                      </div>
                    </div>

                    <div className="flex items-center text-blue-600 text-sm font-medium">
                      Compare Plans <ArrowRight className="w-4 h-4 ml-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Browse by Provider */}
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <Building2 className="w-6 h-6 text-blue-500" />
            <h2 className="text-2xl font-bold">Browse by Provider</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modelsByProvider
              .filter((p) => p.models.length > 0)
              .map((item) => (
                <Card key={item.provider.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      {item.provider.logo && (
                        <img src={item.provider.logo} alt={item.provider.name} className="w-12 h-12 object-contain" />
                      )}
                      <div>
                        <h3 className="font-bold text-xl">{item.provider.name}</h3>
                        <p className="text-sm text-zinc-500">
                          {item.models.length} {item.models.length === 1 ? 'model' : 'models'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {item.models.slice(0, 3).map((model) => (
                        <Link
                          key={model.id}
                          href={`/compare/plans/${model.slug}`}
                          className="block p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{model.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {model.planCount} plans
                            </Badge>
                          </div>
                        </Link>
                      ))}
                      {item.models.length > 3 && (
                        <div className="text-sm text-zinc-500 text-center pt-2">
                          +{item.models.length - 3} more models
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </section>

        {/* Browse by Capability */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Zap className="w-6 h-6 text-yellow-500" />
            <h2 className="text-2xl font-bold">Browse by Capability</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/rankings/arena">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl mb-2">🏆</div>
                  <h3 className="font-bold mb-1">Arena Ranking</h3>
                  <p className="text-sm text-zinc-500">Top rated by users</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/rankings/context">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl mb-2">📏</div>
                  <h3 className="font-bold mb-1">Longest Context</h3>
                  <p className="text-sm text-zinc-500">Best for large docs</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/rankings/cheapest">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl mb-2">💰</div>
                  <h3 className="font-bold mb-1">Cheapest Plans</h3>
                  <p className="text-sm text-zinc-500">Best value for money</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/rankings/china">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl mb-2">🇨🇳</div>
                  <h3 className="font-bold mb-1">China Accessible</h3>
                  <p className="text-sm text-zinc-500">No VPN required</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">💰</span>
            <span className="font-medium">aiplans.dev</span>
          </div>
          <p className="text-sm text-zinc-500">
            © 2026 aiplans.dev - Compare AI pricing & save money
          </p>
        </div>
      </footer>
    </div>
  );
}
