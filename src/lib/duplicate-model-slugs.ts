/**
 * Model rows that duplicate another row for the same model, keyed to the page
 * that should rank. Found 2026-11-16 by normalizing every /api/products slug
 * (vendor prefix, `.`, `:` and `(batch)` spelling) and checking the live
 * sitemap: older scraper rows (`gpt-5.2-(batch)`, `claude-opus-5:batch`,
 * `glm-5.2`) sit next to vendor-prefixed rows (`openai-gpt-5-2-batch`,
 * `anthropic-claude-opus-5-batch`, `zai-glm-5-2`). Search Console listed many
 * of them under "Crawled - currently not indexed".
 *
 * The two rows usually carry different channels (e.g. `gpt-4.1-mini` has
 * Azure + XycAi, `openai-gpt-4-1-mini` has OpenRouter), so neither page is
 * removed or redirected here: that would hide prices. Instead the duplicate
 * page declares the canonical page as rel=canonical and leaves the sitemap.
 * The real fix is the DB merge (pattern:
 * scripts/sql/2026-10-22-merge-openrouter-prefix-dups.sql), after which the
 * copy's slug moves to model_slug_redirects and its entry here can go.
 *
 * Canonical choice: the row already in the sitemap; when both were, the older
 * row, as in the 2026-10-22 merge; when neither was, the vendor-prefixed row.
 * Targets must not themselves be keys (no chains); a test checks this.
 */
export const DUPLICATE_MODEL_SLUGS: Readonly<Record<string, string>> = {
  'claude-fable-5-(batch)': 'anthropic-claude-fable-5-batch',
  'claude-opus-5:batch': 'anthropic-claude-opus-5-batch',
  'claude-sonnet-5-(batch)': 'anthropic-claude-sonnet-5-batch',
  'claude-3-7-sonnet': 'claude-3.7-sonnet',
  'anthropic-claude-opus-4': 'claude-opus-4',
  'anthropic-claude-opus-4-1': 'claude-opus-4.1',
  'gemma-4-31b-(batch)': 'gemma-4-31b-batch',
  'zai-glm-5-2': 'glm-5.2',
  'gemini-2.5-flash-(batch)': 'google-gemini-gemini-2-5-flash-batch',
  'gemini-2.5-flash-lite-(batch)': 'google-gemini-gemini-2-5-flash-lite-batch',
  'gemini-2.5-pro-(batch)': 'google-gemini-gemini-2-5-pro-batch',
  'gemini-3.1-flash-lite-(batch)': 'google-gemini-gemini-3-1-flash-lite-batch',
  'gemini-3.5-flash-(batch)': 'google-gemini-gemini-3-5-flash-batch',
  'gemini-3.5-flash-lite-(batch)': 'google-gemini-gemini-3-5-flash-lite-batch',
  'gemini-3.6-flash-(batch)': 'google-gemini-gemini-3-6-flash-batch',
  'gemini-3.7-flash-(batch)': 'google-gemini-gemini-3-7-flash-batch',
  'gemini-3.8-flash-(batch)': 'google-gemini-gemini-3-8-flash-batch',
  'openai-gpt-4-1-mini': 'gpt-4.1-mini',
  'openai-gpt-5-4': 'gpt-5.4',
  'openai-gpt-6-astra-law': 'gpt-6-astra-law',
  'kimi-k3us-geo-pinned': 'kimi-k3-us-geo-pinned',
  'kimi-k3-(batch)': 'moonshotai-kimi-k3-batch',
  'nvidia-nemotron-3-5-lightning': 'nemotron-3.5-lightning',
  'gpt-4.1-mini-(batch)': 'openai-gpt-4-1-mini-batch',
  'gpt-5.1-(batch)': 'openai-gpt-5-1-batch',
  'gpt-5.2-(batch)': 'openai-gpt-5-2-batch',
  'gpt-5.2-pro-(batch)': 'openai-gpt-5-2-pro-batch',
  'gpt-5.4-(batch)': 'openai-gpt-5-4-batch',
  'gpt-5.4-mini-(batch)': 'openai-gpt-5-4-mini-batch',
  'gpt-5.4-nano-(batch)': 'openai-gpt-5-4-nano-batch',
  'gpt-5.4-pro-(batch)': 'openai-gpt-5-4-pro-batch',
  'gpt-5.5-(batch)': 'openai-gpt-5-5-batch',
  'gpt-5.5-pro-(batch)': 'openai-gpt-5-5-pro-batch',
  'gpt-5.6-luna-(batch)': 'openai-gpt-5-6-luna-batch',
  'gpt-5.6-luna-pro-(batch)': 'openai-gpt-5-6-luna-pro-batch',
  'gpt-5.6-sol-(batch)': 'openai-gpt-5-6-sol-batch',
  'gpt-5.6-sol-pro-(batch)': 'openai-gpt-5-6-sol-pro-batch',
  'gpt-5.6-terra-(batch)': 'openai-gpt-5-6-terra-batch',
  'gpt-5.6-terra-pro-(batch)': 'openai-gpt-5-6-terra-pro-batch',
  'gpt-5-(batch)': 'openai-gpt-5-batch',
  'gpt-5-mini-(batch)': 'openai-gpt-5-mini-batch',
  'gpt-5-nano-(batch)': 'openai-gpt-5-nano-batch',
  'gpt-5-pro-(batch)': 'openai-gpt-5-pro-batch',
  'gpt-6-astra-(batch)': 'openai-gpt-6-astra-batch',
  'gpt-6-astra-pro-(batch)': 'openai-gpt-6-astra-pro-batch',
  'gpt-oss-120b-(batch)': 'openai-gpt-oss-120b-batch',
  'gpt-oss-20b-(batch)': 'openai-gpt-oss-20b-batch',
  'o3-(batch)': 'openai-o3-batch',
  'qwen3.5-9b-(batch)': 'qwen-qwen3-5-9b-batch',
  'qwen3.8-2.4t-a95b-(batch)': 'qwen-qwen3-8-2-4t-a95b-batch',
  'grok-4.3-(batch)': 'x-ai-grok-4-3-batch',
  'glm-5.2-(batch)': 'z-ai-glm-5-2-batch',
  'glm-5.3-(batch)': 'z-ai-glm-5-3-batch',
  'glm-5.3-flash-(batch)': 'z-ai-glm-5-3-flash-batch',
};

/** Scraped rows with no identifiable model behind them. They stay reachable
 * but are noindex and out of the sitemap. */
export const JUNK_MODEL_SLUGS: ReadonlySet<string> = new Set([
  // OpenAI channel row named just "chat"; not a model id (deepseek-chat is
  // DeepSeek's and separate).
  'chat',
]);

export function canonicalModelSlug(slug: string): string {
  return Object.hasOwn(DUPLICATE_MODEL_SLUGS, slug) ? DUPLICATE_MODEL_SLUGS[slug] : slug;
}

export function isDuplicateModelSlug(slug: string): boolean {
  return Object.hasOwn(DUPLICATE_MODEL_SLUGS, slug);
}
