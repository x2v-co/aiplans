import data from '../../public/reports/claude-pro-opus55-2026-11-04.json';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';

/** x2v first-party measurement of Claude Pro's Opus 5.5 allowance; not an official Anthropic quota. */
export const CLAUDE_PRO_QUOTA_DATE = data.date;
export const CLAUDE_PRO_QUOTA_SOURCE = data.source.url;
export const CLAUDE_PRO_QUOTA_REPORT = '/reports/claude-pro-opus55-2026-11-04.md';
export const CLAUDE_PRO_QUOTA_LEDGER = '/reports/claude-pro-opus55-2026-11-04.json';
export const isClaudeProQuotaModel = (slug: string) => data.modelSlugs.includes(slug);
export const claudeProQuotaCopy = (locale: string) => (locale === 'zh' ? zh : en).claudeProQuota;

export function claudeProQuotaRows(locale: string) {
  const c = claudeProQuotaCopy(locale);
  return [[c.w5h, c.r5hOut, c.r5hAg], [c.wWeek, c.rWeekOut, c.rWeekAg], [c.wMonth, c.rMonthOut, c.rMonthAg]] as const;
}

export function claudeProQuotaNotes(locale: string): string[] {
  const c = claudeProQuotaCopy(locale);
  return [c.label, c.method, c.value, c.meter, c.limits];
}

/** Shared by visible FAQ answers and FAQPage JSON-LD. */
export function claudeProQuotaFaq(locale: string) {
  const c = claudeProQuotaCopy(locale);
  const rows = claudeProQuotaRows(locale).map(([w, o, a]) => `${w}: ${c.outputHeavy} ${o}; ${c.agentic} ${a}.`).join(' ');
  return { question: c.question, answer: `${c.verifiedAt}: ${CLAUDE_PRO_QUOTA_DATE}. ${rows} ${claudeProQuotaNotes(locale).join(' ')} ${CLAUDE_PRO_QUOTA_SOURCE}` };
}
