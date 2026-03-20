import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Check, ExternalLink, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatPrice, CurrencyCode } from "@/lib/currency";

// Provider info map
const providerInfo: Record<string, { name: string; logo: string; description: string }> = {
  openai: { name: "OpenAI", logo: "🤖", description: "Creators of GPT-4, DALL-E, and more" },
  anthropic: { name: "Anthropic", logo: "🧠", description: "AI safety company behind Claude" },
  deepseek: { name: "DeepSeek", logo: "🔮", description: "Chinese AI company with open-source models" },
  google: { name: "Google", logo: "🌐", description: "Google Cloud AI with Gemini models" },
  meta: { name: "Meta", logo: "🦙", description: "Llama open-source models" },
};

async function getPlansByProvider(providerSlug: string) {
  // First get provider
  const { data: provider } = await supabase
    .from('providers')
    .select('*')
    .eq('slug', providerSlug)
    .single();

  if (!provider) return null;

  // Get plans for this provider directly
  const { data: plans } = await supabase
    .from('plans')
    .select('*')
    .eq('provider_id', provider.id)
    .order('price', { ascending: true });

  // Get models for this provider (via provider_ids array - use snake_case for Supabase)
  const { data: models } = await supabase
    .from('models')
    .select('id, name, slug, provider_ids')
    .contains('provider_ids', [provider.id]);

  // Also get models via model_plan_mapping junction table
  const planIds = (plans || []).map(p => p.id);
  let modelIdsFromPlans: number[] = [];

  if (planIds.length > 0) {
    const { data: mappings } = await supabase
      .from('model_plan_mapping')
      .select('model_id')
      .in('plan_id', planIds);
    modelIdsFromPlans = (mappings || []).map(m => m.model_id);
  }

  // Fetch additional models from mapping
  let additionalModels: any[] = [];
  if (modelIdsFromPlans.length > 0) {
    const { data: mappedModels } = await supabase
      .from('models')
      .select('id, name, slug, provider_ids')
      .in('id', modelIdsFromPlans);
    additionalModels = mappedModels || [];
  }

  // Merge and deduplicate models
  const allModels = [...(models || []), ...additionalModels];
  const uniqueModels = allModels.filter((model, index, self) =>
    index === self.findIndex(m => m.id === model.id)
  );

  return { provider, models: uniqueModels, plans: plans || [] };
}

export default async function ProviderPlansPage({
  params,
  searchParams,
}: {
  params: Promise<{ provider: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { provider: providerSlug } = await params;
  const { period } = await searchParams;
  const showYearly = period === 'yearly';
  const data = await getPlansByProvider(providerSlug);

  if (!data) {
    notFound();
  }

  const { provider, models, plans } = data;
  const providerData = providerInfo[providerSlug] || { name: provider.name, description: "" };

  // Determine currency based on provider region (china providers use CNY)
  const currency: CurrencyCode = provider.region === 'china' ? 'CNY' : 'USD';

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

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
          <Link href="/" className="flex items-center gap-1 hover:text-blue-600">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>

        {/* Provider Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              {provider.logo ? (
                  <img src={provider.logo} alt={provider.name} className="w-16 h-16 object-contain" />
                ) : (
                  <span className="text-5xl">{providerInfo[providerSlug]?.logo || "🏢"}</span>
                )}
              <div>
                <h1 className="text-3xl font-bold">{providerData.name} Plans</h1>
                <p className="text-zinc-600">{providerData.description}</p>
              </div>
            </div>
            {/* Period Toggle */}
            <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
              <Link
                href={`/plans/${providerSlug}`}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  !showYearly ? 'bg-white dark:bg-zinc-700 shadow-sm' : 'text-zinc-500'
                }`}
              >
                Monthly
              </Link>
              <Link
                href={`/plans/${providerSlug}?period=yearly`}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  showYearly ? 'bg-white dark:bg-zinc-700 shadow-sm' : 'text-zinc-500'
                }`}
              >
                Yearly
              </Link>
            </div>
          </div>
        </div>

        {/* Plans */}
        {plans.length > 0 ? (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              All Plans
              <Badge variant="outline">{plans.length} plans</Badge>
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <Card key={plan.id} className={plan.tier === 'pro' ? 'border-blue-500' : ''}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle>{plan.name}</CardTitle>
                      {plan.tier === 'pro' && (
                        <Badge className="bg-blue-600">Popular</Badge>
                      )}
                    </div>
                    <CardDescription>
                      {plan.pricing_model === 'subscription' && 'Monthly subscription'}
                      {plan.pricing_model === 'token_pack' && 'One-time token pack'}
                      {plan.pricing_model === 'pay_as_you_go' && 'Pay as you go'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <span className="text-3xl font-bold">
                        {plan.price === 0
                          ? 'Free'
                          : showYearly && plan.price_yearly_monthly
                            ? formatPrice(plan.price_yearly_monthly * 12, currency)
                            : formatPrice(plan.price, currency)}
                      </span>
                      {plan.price_unit && plan.price !== 0 && (
                        <span className="text-zinc-500 text-sm ml-1">
                          /{showYearly ? 'year' : (plan.price_unit === 'per_month' ? 'mo' : plan.price_unit.replace('_', ' '))}
                        </span>
                      )}
                    </div>

                    {plan.features && Array.isArray(plan.features) && (
                      <ul className="space-y-2 mb-4">
                        {plan.features.slice(0, 4).map((feature: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <Separator className="my-4" />

                    <div className="space-y-2 text-sm">
                      {plan.monthly_message_limit !== null && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Messages</span>
                          <span>{plan.monthly_message_limit === 0 ? 'Unlimited' : `${plan.monthly_message_limit}/month`}</span>
                        </div>
                      )}
                      {plan.context_window && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Context</span>
                          <span>{plan.context_window.toLocaleString()} tokens</span>
                        </div>
                      )}
                      {plan.rate_limit && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Rate Limit</span>
                          <span>{plan.rate_limit}/min</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-zinc-500">China Access</span>
                        <span>{plan.access_from_china ? '✓ Available' : '✗ Not available'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-zinc-500">No plans available for this provider yet.</p>
            </CardContent>
          </Card>
        )}

        {/* Models Section */}
        {models.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              Models
              <Badge variant="outline">{models.length} models</Badge>
            </h2>
            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
              {models.map((model: any) => (
                <Link key={model.id} href={`/models/${model.slug}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="py-4">
                      <h3 className="font-medium">{model.name}</h3>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">💰</span>
            <span className="font-medium">aiplans.dev</span>
          </div>
          <p className="text-sm text-zinc-500">
            © 2026 aiplans.dev
          </p>
        </div>
      </footer>
    </div>
  );
}