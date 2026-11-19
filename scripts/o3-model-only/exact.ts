import { createHash } from 'node:crypto';
export const PAIR = Object.freeze({ sourceId: 3014, sourceSlug: 'o3-(batch)', targetId: 3192, targetSlug: 'openai-o3-batch' });
export const MODES = ['preview', 'freeze', 'rehearse', 'apply', 'repeat0', 'restore-rehearse', 'restore'] as const;
export type Mode = typeof MODES[number];
export const MODEL_FK_TABLES = Object.freeze([
  'api_channel_price_variants', 'api_channel_prices', 'coding_agent_scores', 'evaluation_run',
  'external_price_references', 'model_benchmark_scores', 'model_offical', 'model_plan_mapping',
  'model_slug_redirects', 'usage_prices',
]);
export function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return '{' + Object.keys(value!).sort().map(key => JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key])).join(',') + '}';
  }
  throw new Error('Only exact JSON evidence is permitted; timestamps must be text and numbers safe integers');
}
export function digest(value: unknown): string { return createHash('sha256').update(canonical(value)).digest('hex'); }
export function assertPair(pair: unknown): asserts pair is typeof PAIR {
  if (canonical(pair) !== canonical(PAIR)) throw new Error('Only exact o3 batch IDs/slugs 3014 -> 3192 are supported');
}
export function requireDigest(value: string): string {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error('Expected SHA256 planDigest');
  return value;
}
export function invariant(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
