// Machine annotations are display metadata, not customer-facing copy. Keep
// ordinary bracketed text such as [100K context] intact.
const INTERNAL_MARKER = /\[(?:(?:aiplans|internal|todo|fixme)(?::[^\]\r\n]*)?|[a-z][a-z0-9]*(?:[-_:][a-z0-9]+)+|unverified|needs verification)\]/gi;
const UNVERIFIED_MARKER = /\[(?:needs[-_ ]verification|unverified)\]/i;
const URL_TEXT = /https?:\/\/[^\s<>"）)]+/gi;

export function cleanPlanDisplayText(value: unknown): { text: string; unverified: boolean } {
  if (typeof value !== 'string') return { text: '', unverified: false };
  return {
    text: value.replace(INTERNAL_MARKER, '').replace(/\s+/g, ' ').trim(),
    unverified: UNVERIFIED_MARKER.test(value),
  };
}

function sentenceKey(text: string): string {
  return text.toLowerCase().replace(/[.!?。！？]+$/, '').trim();
}

/** Deduplicate sentences across features, quotas, notes and conditions in order. */
export function uniquePlanSentences(values: readonly unknown[], seenText: readonly unknown[] = []): string[] {
  const sentences = (items: readonly unknown[]) => items.flatMap(value => {
    if (typeof value !== 'string') return [];
    // URLs have a single labeled link on the card, rather than prose copies.
    const text = value.replace(URL_TEXT, '').split(/[\r\n]+/u)
      .map(item => cleanPlanDisplayText(item).text.replace(/^(?:source|来源|原文)\s*[:：]\s*/i, ''))
      .filter(Boolean)
      .join(' ');
    return text.split(/(?<=[。！？])\s*|(?<=[.!?])\s+/u).filter(Boolean);
  });
  const seen = new Set(sentences(seenText).map(sentenceKey));
  return sentences(values).filter(text => {
    const key = sentenceKey(text);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function planCardCopy(input: {
  name: string;
  features: unknown;
  conditions?: readonly unknown[];
  notes?: string | null;
  sourceLabel?: string;
}) {
  const features = Array.isArray(input.features) ? input.features : [];
  const conditions = input.conditions ?? [];
  const name = cleanPlanDisplayText(input.name).text;
  const points = uniquePlanSentences(features, [name, input.sourceLabel]);
  return {
    name,
    points: points.slice(0, 4),
    details: [
      ...points.slice(4),
      ...uniquePlanSentences([...conditions, input.notes], [name, ...points, input.sourceLabel]),
    ],
    unverified: [input.name, ...features, ...conditions, input.notes, input.sourceLabel]
      .some(value => cleanPlanDisplayText(value).unverified),
  };
}
