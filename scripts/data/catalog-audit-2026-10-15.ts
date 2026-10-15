/** Audit A2 #7/#9/#10/#11 and or_diff.txt. No inferred prices/specifications. */
import { generateOpenRouterSlug } from '../scrapers/openrouter';
export const AUDIT_DATE = '2026-10-15';
export const AUDIT_TIMESTAMP = new Date('2026-10-15T00:00:00Z');
export const OPENROUTER_ADDITIONS: readonly (readonly [string, string, string])[] = [
  ["~unbiased/pareto-latest", "0.0000025", "0.0000075"],
  ["unbiased/pareto-26.9", "0.0000025", "0.0000075"],
  ["liquid/lfm-2.5-24b-a2b", "0.00000005", "0.0000007"],
  ["scaledown/summarize", "0.00000004", "0"],
  ["scaledown/extract", "0.00000004", "0"],
  ["mistralai/mistral-large-4-0", "0.00000068", "0.00000209"],
  ["inclusionai/ling-3.1-flash", "0.000000075", "0.000000225"],
  ["unbiased/pareto-26.10-preview", "0.0000008", "0.0000032"],
  ["typesafe/jev-router", "-1", "-1"],
  ["perceptron/perceptron-mk1.5", "0.00000015", "0.0000015"],
  ["fireworks/ember-1", "0.000003", "0.000015"],
  ["aion-labs/aion-3.5-mini", "0.0000007", "0.0000014"],
  ["aion-labs/aion-3.5", "0.000003", "0.000006"],
  ["upstage/solar-mini4", "0.00000005", "0.0000002"],
  ["cohere/command-a-plus", "0.0000003", "0.0000015"],
  ["nvidia/switchyard", "-1", "-1"],
  ["xiaomi/mimo-v2.6-pro-ultraspeed", "0.00000435", "0.0000087"],
  ["xiaomi/mimo-v2.6-flash", "0.00000014", "0.00000028"],
  ["xiaomi/mimo-v2.6-pro", "0.000000435", "0.00000087"],
  ["prism-ml/ternary-bonsai-2-27b", "0.000000075", "0.0000005"],
  ["inference-net/schematron-v2-turbo", "0.00000003", "0.00000015"],
  ["inference-net/schematron-v2-small", "0.00000005", "0.00000023"],
  ["sakana/fugu-ultra-v2", "0.000005", "0.00003"],
  ["sakana/fugu-max", "0.000002", "0.000006"],
  ["inclusionai/ling-3.0-flash-vl", "0.00000006", "0.00000018"],
  ["inception/mercury-2.5", "0.00000004", "0.00000015"],
  ["nex-agi/nex-n2.5-mini", "0.000000025", "0.0000001"],
  ["nex-agi/nex-n2.5-pro", "0.000000075", "0.00000025"],
  ["meta/muse-spark-1.3-contributor", "0.0000001", "0.0000002"],
  ["meta/muse-spark-1.3", "0.00000125", "0.00000425"],
  ["google/gemini-3.8-flash:batch", "0.000000375", "0.000001875"],
  ["ibm-granite/granite-4.2-8b", "0.00000006", "0.00000025"],
  ["tencent/hy4-preview", "0.000000834", "0.000002501"],
  ["meta/muse-spark-1.2-contributor", "0.0000001", "0.0000002"],
  ["tencent/hy-mt2-1.8b", "0.000000044", "0.000000177"],
  ["tencent/hy-mt2-30b-a3b", "0.000000074", "0.000000295"],
  ["tencent/hy-mt2-7b", "0.000000074", "0.000000295"],
];

export function auditedModelSlug(id: string): string {
  // Seed the canonical old model without changing the scraper's historical batch alias.
  if (id === 'mistralai/mistral-large') return 'mistral-large';
  // Already present in the audit's UNMATCHED list; attach OR batch price here.
  if (id === 'google/gemini-3.8-flash:batch') return 'google-gemini-gemini-3-8-flash-batch';
  return generateOpenRouterSlug(id);
}
export function auditedPrices(input: string, output: string) {
  if (Number(input) < 0 || Number(output) < 0) return {
    input_price_per_1m: null, output_price_per_1m: null,
    notes: '[needs-verification] Variable/router pricing; OpenRouter -1 sentinel is not a price.',
  };
  return { input_price_per_1m: Number((Number(input) * 1_000_000).toFixed(6)),
    output_price_per_1m: Number((Number(output) * 1_000_000).toFixed(6)), notes: 'OpenRouter per-token USD converted to per-1M; audit 2026-10-15.' };
}
export const LEGACY_PRO_NOTE = '[aiplans:legacy ends=2026-10-29] Legacy ChatGPT Pro $200 tier; grace period ends 2026-10-29. Superseded by Pro 100/200/500. Audit 2026-10-15.';
export const MAX_API_CREDIT_NOTE = '[needs-verification] Monthly included API credit added for Max $100/$200; official amount not supplied in audit. Source: https://claude.com/pricing (2026-10-15).';
export function cleanLegacyFeatures(features: unknown): string[] {
  return Array.isArray(features) ? features.filter((f): f is string => typeof f === 'string' && !/5\s*[x×]|20\s*[x×]|china|中国/i.test(f)) : [];
}
