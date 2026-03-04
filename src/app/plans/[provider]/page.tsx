import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Check, ExternalLink, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

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

  // Get products for this provider
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('provider_id', provider.id)
    .order('name');

  // Get plans
  const { data: plans } = await supabase
    .from('plans')
    .select(`
      *,
      products:product_id (
        id,
        name,
        slug
      )
    `)
    .in('product_id', products?.map(p => p.id) || [])
    .order('price', { ascending: true });

  return { provider, products: products || [], plans: plans || [] };
}

export default async function ProviderPlansPage({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  const { provider: providerSlug } = await params;
  const data = await getPlansByProvider(providerSlug);

  if (!data) {
    notFound();
  }

  const { provider, products, plans } = data;
  const providerData = providerInfo[providerSlug] || { name: provider.name, logo: "🏢", description: "" };

  // Group plans by product
  const plansByProduct: Record<number, typeof plans> = {};
  for (const plan of plans) {
    if (!plansByProduct[plan.product_id]) {
      plansByProduct[plan.product_id] = [];
    }
    plansByProduct[plan.product_id].push(plan);
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
          <div className="flex items-center gap-4 mb-4">
            <span className="text-5xl">{providerData.logo}</span>
            <div>
              <h1 className="text-3xl font-bold">{providerData.name} Plans</h1>
              <p className="text-zinc-600">{providerData.description}</p>
            </div>
          </div>
        </div>

        {/* Plans by Product */}
        {products.map((product) => {
          const productPlans = plansByProduct[product.id] || [];
          if (productPlans.length === 0) return null;

          return (
            <div key={product.id} className="mb-12">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                {product.name}
                <Badge variant="outline">{productPlans.length} plans</Badge>
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {productPlans.map((plan) => (
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
                          {plan.price === 0 ? 'Free' : `$${plan.price}`}
                        </span>
                        {plan.price_unit && (
                          <span className="text-zinc-500 text-sm ml-1">
                            /{plan.price_unit.replace('_', ' ')}
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
          );
        })}

        {plans.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-zinc-500">No plans available for this provider yet.</p>
            </CardContent>
          </Card>
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
