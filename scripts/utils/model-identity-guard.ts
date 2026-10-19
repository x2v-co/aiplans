/**
 * Guard for auto-created model rows. Scrapers create a `models` row for any
 * unknown slug from an official provider, so marketing copy that leaks into a
 * model-name cell (e.g. Kimi's "Promo · Promotion valid until October 11,")
 * becomes a public model page. Anything that looks like promo text, a calendar
 * date, or punctuation that never appears in a model id is rejected and must be
 * reviewed by a human instead of being inserted.
 */
import { isGluedModelSlug } from '../../src/lib/glued-model-slug';

const MONTHS = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';

const RULES: Array<{ reason: string; re: RegExp }> = [
  { reason: 'promo wording', re: /promo|promotion|discount|limited[\s-]*time|free[\s-]*trial|\bsale\b|\boffer\b|限时|优惠|促销|折扣|活动/i },
  { reason: 'validity wording', re: /valid[\s-]*(?:until|till|through|thru|to)|expires?|until[\s-]|截止|有效期/i },
  { reason: 'calendar date (d/m/y)', re: /\d{1,2}\s*[/.]\s*\d{1,2}\s*[/.]\s*\d{2,4}/ },
  { reason: 'calendar date (month name)', re: new RegExp(`(?:^|[^a-z])(?:${MONTHS})[\\s-]+\\d{1,2}(?:[^0-9]|$)`, 'i') },
  { reason: 'comma', re: /[,，]/ },
  { reason: 'slash', re: /[/\\]/ },
  { reason: 'markup', re: /[<>{}[\]"`]/ },
];

export interface ModelIdentityVerdict { ok: boolean; reasons: string[] }

export function checkModelIdentity(name: string, slug: string): ModelIdentityVerdict {
  const reasons = new Set<string>();
  for (const value of [name ?? '', slug ?? '']) {
    for (const { reason, re } of RULES) if (re.test(value)) reasons.add(reason);
  }
  // Unknown vendor/family/family IDs need review, even if the canonical row
  // does not exist yet. Do not guess which prefixes are safe to strip.
  if (/^(?:[a-z0-9]+-)+?([a-z][a-z0-9]*)-\1(?:-|$)/i.test(slug ?? '')) {
    reasons.add('doubled vendor/family prefix');
  }
  if (isGluedModelSlug(slug ?? '')) reasons.add('glued model ids');
  if (!slug || !/^[a-z0-9~][a-z0-9.\-_:~]*$/.test(slug)) reasons.add('slug charset');
  if ((slug ?? '').length > 80 || (name ?? '').length > 100) reasons.add('too long');
  return { ok: reasons.size === 0, reasons: [...reasons] };
}

export class ModelIdentityRejectedError extends Error {
  constructor(public readonly modelName: string, public readonly modelSlug: string, public readonly reasons: string[]) {
    super(`model identity rejected (needs manual review): name=${JSON.stringify(modelName)} slug=${JSON.stringify(modelSlug)} reasons=${reasons.join(', ')}`);
    this.name = 'ModelIdentityRejectedError';
  }
}

/** Cached-input price must never exceed the regular input price. */
export function isCachedPriceSane(input: number | null | undefined, cached: number | null | undefined): boolean {
  if (cached == null || input == null) return true;
  return cached <= input + 1e-12;
}
