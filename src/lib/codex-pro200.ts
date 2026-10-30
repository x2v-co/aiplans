import data from '../../public/reports/codex-models-2026-10-30.json';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';

export const CODEX_QUOTA_DATE = data.date;
export const CODEX_QUOTA_REPORT = '/reports/codex-models-2026-10-30.md';
export const CODEX_QUOTA_LEDGER = '/reports/codex-models-2026-10-30.json';
export const CODEX_QUOTA_HISTORY = '/reports/codex-models-2026-10-28.md';
export const CODEX_PRO200_SLUGS = ['chatgpt-pro', 'chatgpt-pro-200'] as const;
export const isCodexPro200 = (slug: string) => CODEX_PRO200_SLUGS.some(value => value === slug);
/** Catalog base models only; API batch variants were not measured. */
export function codexQuotaModel(slug: string): string | undefined {
  if (['gpt-6-astra', 'openai-gpt-6-astra'].includes(slug)) return 'gpt-6-astra';
  if (['gpt-6.1-sol', 'openai-gpt-6-1-sol'].includes(slug)) return 'gpt-6.1-sol';
  return undefined;
}
export const isCodexQuotaModel = (slug: string) => codexQuotaModel(slug) !== undefined;
export const codexQuotaCopy = (locale: string) => (locale === 'zh' ? zh : en).codexQuota;

export function codexQuotaCaveats(locale: string): string[] {
  const copy = codexQuotaCopy(locale);
  return [copy.upgrade, copy.scope, copy.windows, copy.pool, copy.overlap, copy.assumptions];
}

/** Shared by visible FAQ answers and FAQPage JSON-LD. */
export function codexQuotaFaq(locale: string, modelSlug?: string) {
  const copy = codexQuotaCopy(locale);
  const sol = modelSlug !== undefined && codexQuotaModel(modelSlug) === 'gpt-6.1-sol';
  const capacity = modelSlug
    ? `${sol ? 'GPT-6.1 Sol' : 'GPT-6 Astra'}: ${sol ? copy.solCapacity : copy.astraCapacity}.`
    : `GPT-6 Astra: ${copy.astraCapacity}. GPT-6.1 Sol: ${copy.solCapacity}.`;
  return {
    question: modelSlug ? copy.modelQuestion.replace('{model}', sol ? 'GPT-6.1 Sol' : 'GPT-6 Astra') : copy.question,
    answer: `${copy.verifiedAt}: ${CODEX_QUOTA_DATE}. ${capacity} ${codexQuotaCaveats(locale).join(' ')}`,
  };
}
