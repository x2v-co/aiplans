import { getPlans } from '@/lib/plans';
import { getProducts } from '@/lib/products';
import { convertCurrency, type CurrencyCode } from '@/lib/currency';
import { getProviderLogoSrc } from '@/lib/provider-branding';
import { selectIndexablePlanComparisons } from '@/lib/search-indexing';

/**
 * Everything /compare/plans lists: the hot-model cards, the featured plans, and
 * every LLM grouped under its provider.
 *
 * The page built this in a `useEffect` out of three API calls, so the server
 * rendered its `loading` branch and crawlers got 85 characters — no model names,
 * no plan names, no prices, and none of the internal links into
 * /compare/plans/[model] that make those pages discoverable.
 */

// Plans arrive in their vendor's own currency, so any ordering across them has
// to normalise first. Missing prices sort last rather than as free.
function usdPrice(plan: { price?: number | null; currency?: string | null }): number {
  if (plan.price == null) return Infinity;
  return convertCurrency(plan.price, (plan.currency as CurrencyCode) || 'USD', 'USD');
}

export type ProviderModelGroup = {
  provider: { id: number; name: string; logo: string };
  models: any[];
};

export type ComparePlansIndexData = {
  hotModels: any[];
  featuredPlans: any[];
  modelsByProvider: ProviderModelGroup[];
};

export async function getComparePlansIndexData(): Promise<ComparePlansIndexData> {
  const [hotModelsData, plansData, allProducts] = await Promise.all([
    getProducts({ type: 'llm', featured: true, includePlanCount: true }),
    getPlans({ includeModels: true }),
    getProducts({ type: 'llm', includePlanCount: true }),
  ]);

  const indexableModels = selectIndexablePlanComparisons(
    allProducts.map((model: any) => ({
      ...model,
      plan_count: model.planCount || 0,
    })),
  );
  const indexableIds = new Set(indexableModels.map((model: any) => model.id));

  // Only link models that have a meaningful plan comparison. API-only models
  // remain discoverable from /api-pricing instead of leading to empty cards.
  const hotModels = hotModelsData
    .filter((model: any) => indexableIds.has(model.id))
    .sort((a: any, b: any) => {
    const aElo = a.benchmark_arena_elo || 0;
    const bElo = b.benchmark_arena_elo || 0;
    return bElo - aElo;
    });

  const featuredPlans = (plansData || [])
    // Contact-sales rows are excluded: they store price=0 to mean "no
    // public price", which sorted them to the front of a price-ascending
    // list and showed ChatGPT/Claude Enterprise as the cheapest plans
    // on the site.
    .filter((plan: any) => plan.pricing_model === 'subscription' && !plan.is_contact_sales)
    .sort((a: any, b: any) => {
      if ((a.is_official || false) !== (b.is_official || false)) {
        return a.is_official ? -1 : 1;
      }
      // Normalised to USD before comparing -- raw numbers put ¥118/mo
      // above $20/mo, so a CNY plan looked like the expensive one.
      return usdPrice(a) - usdPrice(b);
    })
    .slice(0, 8);

  // Group by provider
  const providerMap = new Map<number, ProviderModelGroup>();
  indexableModels.forEach((product: any) => {
    const providerId = product.providers?.id || product.provider_ids?.[0];
    // Skip products without a valid provider ID
    if (!providerId) return;

    const providerName = product.providers?.name || 'Unknown';
    const providerLogo = getProviderLogoSrc(product.providers) || '';

    if (!providerMap.has(providerId)) {
      providerMap.set(providerId, {
        provider: {
          id: providerId,
          name: providerName,
          logo: providerLogo,
        },
        models: [],
      });
    }
    providerMap.get(providerId)!.models.push(product);
  });

  // Sort providers by number of models (descending)
  const modelsByProvider = Array.from(providerMap.values())
    .sort((a, b) => b.models.length - a.models.length);

  return { hotModels, featuredPlans, modelsByProvider };
}
