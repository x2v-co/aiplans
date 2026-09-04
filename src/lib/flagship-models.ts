import type { GroupedProduct } from './grouped-products';
import { isPrimaryModelVariant, modelFreshnessTime } from './model-freshness';

type VendorDefinition = {
  key: string;
  matches: (providerName: string) => boolean;
};

const VENDORS: VendorDefinition[] = [
  { key: 'openai', matches: (name) => /openai/i.test(name) },
  { key: 'anthropic', matches: (name) => /anthropic/i.test(name) },
  { key: 'google', matches: (name) => /gemini|google/i.test(name) },
  { key: 'xai', matches: (name) => /grok|x\.ai/i.test(name) },
  { key: 'deepseek', matches: (name) => /deepseek/i.test(name) },
  { key: 'zhipu', matches: (name) => /chatglm|智谱/i.test(name) },
  { key: 'moonshot', matches: (name) => /moonshot|月之暗面/i.test(name) },
  { key: 'qwen', matches: (name) => /qwen|阿里/i.test(name) },
  { key: 'minimax', matches: (name) => /minimax/i.test(name) },
];

export type VendorLeader = {
  vendorKey: string;
  product: GroupedProduct;
  selectionBasis: 'agent-arena' | 'latest-available';
};

function isGeneralPurposeCandidate(product: GroupedProduct): boolean {
  const slug = product.slug.toLowerCase();
  return isPrimaryModelVariant(slug)
    && !/(?:^|-)(?:audio|code|coder|cyber|image|realtime|transcribe|vision|vl)(?:-|$)/.test(slug);
}

function compareCandidates(left: GroupedProduct, right: GroupedProduct): number {
  const leftScore = left.benchmark_arena_elo;
  const rightScore = right.benchmark_arena_elo;

  if (leftScore != null && rightScore != null && leftScore !== rightScore) {
    return rightScore - leftScore;
  }
  if (leftScore != null && rightScore == null) return -1;
  if (leftScore == null && rightScore != null) return 1;
  return modelFreshnessTime(right) - modelFreshnessTime(left);
}

/**
 * Pick one current, purchasable general-purpose leader per major model vendor.
 * Agent Arena is the primary comparable signal; release recency is the
 * fallback when that vendor has no scored model. This intentionally does not
 * equate "newest" with "strongest".
 */
export function selectVendorLeaders(products: GroupedProduct[]): VendorLeader[] {
  return VENDORS.flatMap((vendor) => {
    const candidates = products
      .filter((product) => vendor.matches(product.providers?.name || ''))
      .filter(isGeneralPurposeCandidate)
      .sort(compareCandidates);
    const product = candidates[0];
    if (!product) return [];
    return [{
      vendorKey: vendor.key,
      product,
      selectionBasis: product.benchmark_arena_elo != null ? 'agent-arena' : 'latest-available',
    } satisfies VendorLeader];
  });
}
