import { ProviderLogo } from '@/components/provider-logo';
import { getCatalogProviderLogoSrc } from '@/lib/provider-branding';
import type { AiCatalogItem } from '@/lib/ai-vertical-catalog';

/** Logo for an image/video/voice catalog row: bundled asset first, explicit URL second, initials last. */
export function CatalogProviderLogo({ item, size = 36, className = 'rounded-lg' }: { item: Pick<AiCatalogItem, 'provider' | 'providerSlug' | 'providerLogoUrl'>; size?: number; className?: string }) {
  const name = item.provider === 'Unknown' ? '' : item.provider.replace(/\s*\(.*\)$/, '');
  const logo = getCatalogProviderLogoSrc(item.provider, item.providerSlug) ?? item.providerLogoUrl ?? null;
  return <ProviderLogo provider={{ slug: item.providerSlug, name: name || item.provider, logo }} size={size} className={className} />;
}
