/** Google does not specify a timezone; use Pacific midnight for date boundaries. */
export function pacificMidnight(year: number, month: number, day: number): Date {
  const noon = new Date(Date.UTC(year, month, day, 12));
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hour: 'numeric', hourCycle: 'h23',
  }).format(noon));
  return new Date(Date.UTC(year, month, day, 12 - hour));
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'];

function parseDate(text: string): { year: number; month: number; day: number } | null {
  const match = text.match(/([a-z]+)\s+(\d{1,2}),\s*(\d{4})/i);
  if (!match) return null;
  const month = MONTHS.indexOf(match[1].toLowerCase());
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  return month >= 0 && date.getUTCMonth() === month && date.getUTCDate() === day
    ? { year, month, day } : null;
}

export interface GoogleCellPrice {
  current: number | undefined;
  regular: number | null;
  /** First instant after the introductory price, ISO UTC. */
  promoEndsAt: string | null;
}

/** First token price in each dated segment; cache storage charges are excluded. */
export function parseGooglePriceCell(text: string | undefined, now = new Date()): GoogleCellPrice {
  const segments = [...(text ?? '').matchAll(/\$\s*(\d+(?:\.\d+)?)([^$]*)/g)]
    .filter(match => !/storage|per\s+hour|\/\s*hour/i.test(match[2]));
  const first = segments[0];
  const plain = { current: first ? Number(first[1]) : undefined, regular: null, promoEndsAt: null };
  if (!first || !/\bthrough\b/i.test(first[2])) return plain;
  const end = parseDate(first[2]);
  const next = segments.find(match => /\bstarting\b/i.test(match[2]));
  const start = next ? parseDate(next[2]) : null;
  if (!end || !next || !start) return plain;
  // Only a contiguous, explicit schedule is safe to persist for automatic switching.
  if (Date.UTC(start.year, start.month, start.day) !== Date.UTC(end.year, end.month, end.day + 1)) return plain;
  const expires = pacificMidnight(start.year, start.month, start.day);
  const regular = Number(next[1]);
  return {
    current: now.getTime() >= expires.getTime() ? regular : Number(first[1]),
    regular,
    promoEndsAt: expires.toISOString(),
  };
}
