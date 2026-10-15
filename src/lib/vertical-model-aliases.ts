import type { AiCatalogKind } from '@/lib/ai-vertical-catalog';

/** Benchmark-only rows (Arena text-to-video). Feed benchmark summaries, never listed as models. */
export function isBenchmarkOnlySlug(slug: string): boolean {
  return slug.startsWith('arena-t2v-');
}

/**
 * Version-level DB slugs (mostly Arena leaderboard entries) that belong to an
 * audited catalog family. They are merged into the parent: no own listing,
 * benchmarks roll up to the parent, detail URLs redirect to it.
 */
export const VERTICAL_MODEL_PARENT: Partial<Record<AiCatalogKind, Record<string, string>>> = {
  'video-model': {
    'gemini-omni-1-1-flash': 'gemini-omni-flash',
    'veo-3-1-audio': 'veo-3-1',
    'veo-3-1-audio-1080p': 'veo-3-1',
    'veo-3-1-fast-audio': 'veo-3-1-fast',
    'veo-3-1-fast-audio-1080p': 'veo-3-1-fast',
    'veo-3': 'veo',
    'veo-3-audio': 'veo',
    'veo-3-fast': 'veo',
    'veo-3-fast-audio': 'veo',
    'veo-2': 'veo',
    'sora-2': 'sora',
    'sora-2-pro': 'sora',
    'wan3-0': 'wan-video',
    'wan2-7-t2v': 'wan-video',
    'wan2-6-t2v': 'wan-video',
    'wan2-5-t2v-preview': 'wan-video',
    'wan-v2-2-a14b': 'wan-video',
    'dreamina-seedance-2-5-720p': 'seedance',
    'dreamina-seedance-2-0-720p': 'seedance',
    'seedance-v1-5-pro': 'seedance',
    'seedance-v1-pro': 'seedance',
    'seedance-v1-lite': 'seedance',
    'minimax-h3': 'hailuo-video',
    'hailuo-2-3': 'hailuo-video',
    'hailuo-02-pro': 'hailuo-video',
    'hailuo-02-standard': 'hailuo-video',
    'runway-gen-4-5': 'runway-gen-4',
    'kling-2-5-turbo-1080p': 'kling',
    'kling-2-6-pro': 'kling',
    'kling-o1-pro': 'kling',
    'kling-v2-1-master': 'kling',
    'ray-3': 'luma-ray',
    'ray2': 'luma-ray',
    'pika-v2-2': 'pika',
  },
};

export function parentSlugFor(kind: AiCatalogKind, slug: string): string | undefined {
  return VERTICAL_MODEL_PARENT[kind]?.[slug];
}
