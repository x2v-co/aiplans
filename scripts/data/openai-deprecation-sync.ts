/** Pure best-effort parsers. Missing/invalid fields never clear existing notices. */
import type { Shutdown } from './openai-shutdowns';

export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function parseModelShutdowns(payload: unknown): Shutdown[] {
  if (!payload || typeof payload !== 'object' || !('data' in payload) || !Array.isArray(payload.data)) {
    throw new Error('Expected OpenAI models data array');
  }
  return payload.data.flatMap((item: unknown) => {
    if (item == null || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || !validDate(row.shutdown_date)) return [];
    return [{ ids: [row.id], shutdownDate: row.shutdown_date,
      ...(validDate(row.deprecated_at) ? { announcedOn: row.deprecated_at } : {}),
      ...(typeof row.replacement_model === 'string' ? { replacementModel: row.replacement_model } : {}),
    }];
  });
}

const plain = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();

export function parseDeprecationsHtml(html: string): Shutdown[] {
  const notices: Shutdown[] = [];
  for (const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const rows = [...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
    const header = rows.find(row => /<th\b/i.test(row[1]));
    if (!header) continue;
    const headers = [...header[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(cell => plain(cell[1]));
    const dateIndex = headers.findIndex(text => /shutdown/i.test(text));
    const modelIndex = headers.findIndex(text => /model|system/i.test(text));
    if (dateIndex < 0 || modelIndex < 0) continue;
    for (const row of rows) {
      const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(cell => cell[1]);
      const dateText = plain(cells[dateIndex] ?? '');
      const parsed = Date.parse(dateText);
      const date = validDate(dateText) ? dateText : !/^\d{4}-\d{2}-\d{2}$/.test(dateText) && Number.isFinite(parsed) && /\b20\d{2}\b/.test(dateText)
        ? new Date(parsed).toISOString().slice(0, 10) : null;
      if (!date || !validDate(date)) continue;
      // Model column only; never include a replacement or prose family mention.
      const ids = plain(cells[modelIndex] ?? '').split(/[\s,]+/)
        .filter(id => /^(?:gpt-|o[134](?:-|$)|tts-)[a-z0-9.\-]*$/.test(id));
      if (ids.length) notices.push({ ids, shutdownDate: date });
    }
  }
  return notices;
}
