/**
 * Model ids that were stored as one slug because a pricing cell listed several
 * ids with no separator (`kimi-k2-thinking` + `kimi-k2-instruct` → one token).
 *
 * A repeat counts only when a family prefix is glued onto the previous id
 * (the character before it is a letter or digit). `qwen-qwen3-8-27b` and
 * `deepseek-deepseek-v4` keep the hyphen, so they stay one slug.
 */

const FAMILIES = [
  'kimi', 'moonshot', 'glm', 'qwen', 'gpt', 'claude', 'deepseek', 'gemini',
  'grok', 'doubao', 'ernie', 'minimax', 'mistral', 'step', 'llama', 'hunyuan', 'seed',
] as const;

const FAMILY = FAMILIES.join('|');
const GLUE = new RegExp(`(?<=[a-z0-9.])(?=(?:${FAMILY})(?:-|\\d))`, 'i');
const START = new RegExp(`^(?:${FAMILY})(?:-|\\d)`, 'i');

export function splitGluedModelSlug(slug: string): string[] | null {
  const parts = slug.split(GLUE).filter(Boolean);
  if (parts.length < 2 || !parts.every((part) => START.test(part))) return null;
  return parts;
}

export function isGluedModelSlug(slug: string): boolean {
  return splitGluedModelSlug(slug) != null;
}
