import { createHash } from 'node:crypto';

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '-', mdash: '-', times: '×', hellip: '…', percnt: '%',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (original, entity: string) => {
    if (!entity.startsWith('#')) return ENTITIES[entity.toLowerCase()] ?? original;
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  });
}

/** Preserve table rows and inline phrases, while ignoring executable/hidden payloads. */
export function extractText(html: string): string {
  const visible = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/<\/(?:td|th)\s*>/gi, ' ')
    .replace(/<(?:br|hr)\b[^>]*>|<\/?(?:p|div|li|h[1-6]|tr|section|article|header|footer)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  return decodeEntities(visible);
}

// Avoid matching the letter x inside words such as "experience".
const QUOTA_LINE = /\b(?:usage|limits?|messages?|tokens?|hours?|weekly|prompts?|requests?|5[- ]hour|x)\b|\b\d+(?:\.\d+)?\s*(?:x\b|×)|倍|额度|次/i;

/** Ignore rendering whitespace and volatile metadata; preserve dates in quota/promotion prose. */
export function normalizeQuotaText(text: string): string {
  return text.normalize('NFKC').replace(/\r\n?/g, '\n').split('\n')
    .map((line) => line
      .replace(/[\u200b-\u200d\ufeff]/g, '')
      .replace(/\b(?:nonce|request[-_ ]?id|trace[-_ ]?id)\s*[:=]\s*[\w.-]+/gi, '')
      .replace(/\b(?:last updated|updated at|generated at|fetched at)\s*:?\s*\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?/gi, '')
      .replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0 && QUOTA_LINE.test(line))
    .join('\n');
}

export function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** Multiset diff preserves repeated table values without quadratic LCS storage. */
export function lineDiff(before: string, after: string, maxLines = 8): string {
  const lines = (value: string) => value ? value.split('\n') : [];
  const subtract = (left: string[], right: string[]) => {
    const counts = new Map<string, number>();
    for (const line of right) counts.set(line, (counts.get(line) ?? 0) + 1);
    return left.filter((line) => {
      const count = counts.get(line) ?? 0;
      if (count === 0) return true;
      counts.set(line, count - 1);
      return false;
    });
  };
  const diff = [
    ...subtract(lines(before), lines(after)).map((line) => `- ${line}`),
    ...subtract(lines(after), lines(before)).map((line) => `+ ${line}`),
  ];
  if (diff.length === 0 && before !== after) return '(quota lines reordered)';
  return [...diff.slice(0, maxLines).map((line) => line.slice(0, 300)), ...(diff.length > maxLines ? ['…'] : [])].join('\n');
}

export type SnapshotState = { contentHash: string; extractedText: string; changed: boolean; alertedAt: Date | string | null };

/** A known baseline/reversion never alerts. Failed deliveries of changed versions may retry. */
export function snapshotDecision(latest: SnapshotState | undefined, known: SnapshotState | undefined, hash: string) {
  const baseline = latest === undefined;
  return {
    insert: known === undefined,
    changed: known?.changed ?? (!baseline && latest.contentHash !== hash),
    alert: !baseline && (known ? known.changed && known.alertedAt === null : latest.contentHash !== hash),
  };
}

export function monitorOptions(args: string[]): { dryRun: boolean; sourceId?: string } {
  for (const arg of args) {
    if (arg !== '--apply' && arg !== '--dry-run' && !/^--source=.+$/.test(arg)) throw new Error(`Unknown argument: ${arg}`);
  }
  if (args.includes('--apply') && args.includes('--dry-run')) throw new Error('Choose --apply or --dry-run');
  const sources = args.filter((arg) => arg.startsWith('--source='));
  if (sources.length > 1) throw new Error('Specify --source only once');
  return { dryRun: !args.includes('--apply'), sourceId: sources[0]?.slice('--source='.length) };
}
