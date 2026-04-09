import { supabase } from '@/lib/supabase';

type ModelWithProviderIds = {
  id: number;
  provider_ids?: number[] | null;
  slug?: string | null;
  name?: string | null;
};

type Provider = {
  id: number;
  name: string;
  slug: string;
  logo?: string | null;
  logo_url?: string | null;
  website?: string | null;
  invite_url?: string | null;
  region?: string | null;
  type?: string | null;
  access_from_china?: boolean | null;
};

export function normalizeProviderRecord<T>(provider: T | T[] | null | undefined): T | null {
  if (Array.isArray(provider)) {
    return provider[0] || null;
  }
  return provider || null;
}

export async function getProvidersByIds(providerIds: number[]): Promise<Map<number, Provider>> {
  if (providerIds.length === 0) {
    return new Map();
  }

  const { data } = await supabase
    .from('providers')
    .select('id, name, slug, logo, logo_url, website, invite_url, region, type, access_from_china')
    .in('id', providerIds);

  return new Map((data || []).map((provider: any) => [provider.id, provider]));
}

export async function getPrimaryProvidersForModels<T extends ModelWithProviderIds>(
  models: T[]
): Promise<Map<number, Provider | null>> {
  if (models.length === 0) {
    return new Map();
  }

  const modelIds = models.map((model) => model.id);
  const { data: modelOfficialRows } = await supabase
    .from('model_offical')
    .select('model_id, producer_id')
    .in('model_id', modelIds);

  const providerIds = new Set<number>();
  const modelOfficialMap = new Map<number, number>();

  (modelOfficialRows || []).forEach((row: any) => {
    if (!modelOfficialMap.has(row.model_id) && row.producer_id) {
      modelOfficialMap.set(row.model_id, row.producer_id);
      providerIds.add(row.producer_id);
    }
  });

  models.forEach((model) => {
    const fallbackProviderId = model.provider_ids?.[0];
    if (fallbackProviderId) {
      providerIds.add(fallbackProviderId);
    }
  });

  const providersById = await getProvidersByIds(Array.from(providerIds));
  const modelProviders = new Map<number, Provider | null>();

  models.forEach((model) => {
    const providerId = modelOfficialMap.get(model.id) || model.provider_ids?.[0];
    modelProviders.set(model.id, providerId ? providersById.get(providerId) || null : null);
  });

  return modelProviders;
}

export async function attachPrimaryProvidersToModels<T extends ModelWithProviderIds>(
  models: T[]
): Promise<Array<T & { providers: Provider | null }>> {
  const modelProviders = await getPrimaryProvidersForModels(models);
  return models.map((model) => ({
    ...model,
    providers: modelProviders.get(model.id) || null,
  }));
}

export async function getAllModelIdsForProvider(providerId: number, planIds: number[] = []): Promise<number[]> {
  const modelIds = new Set<number>();

  const [{ data: directModels }, { data: officialModels }] = await Promise.all([
    supabase
      .from('models')
      .select('id')
      .contains('provider_ids', [providerId]),
    supabase
      .from('model_offical')
      .select('model_id')
      .eq('producer_id', providerId),
  ]);

  (directModels || []).forEach((model: any) => modelIds.add(model.id));
  (officialModels || []).forEach((row: any) => modelIds.add(row.model_id));

  if (planIds.length > 0) {
    const { data: mappings } = await supabase
      .from('model_plan_mapping')
      .select('model_id')
      .in('plan_id', planIds);

    (mappings || []).forEach((row: any) => modelIds.add(row.model_id));
  }

  return Array.from(modelIds);
}

export function getPlanYearlyMonthly(plan: {
  annual_price?: number | null;
  price_yearly_monthly?: number | null;
}): number | null {
  if (plan.price_yearly_monthly != null) {
    return plan.price_yearly_monthly;
  }
  if (plan.annual_price != null) {
    return plan.annual_price / 12;
  }
  return null;
}
