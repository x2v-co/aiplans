import type { Sql } from 'postgres';

/** In-memory stand-in for postgres.js used by DB-free seed tests and local dry-run simulations. */
export type FakeRow = Record<string, unknown> & { id: number };
export function fakeSeedTx(initial: Partial<Record<string, FakeRow[]>> = {}) {
  const data: Record<string, FakeRow[]> = { providers: [], models: [], api_channel_prices: [], api_channel_price_variants: [], ...structuredClone(initial) } as Record<string, FakeRow[]>;
  let id = 1000; let writes = 0;
  const frag = (v: unknown) => (v as { fragment: unknown }).fragment;
  const tx = ((parts: TemplateStringsArray | unknown, ...values: unknown[]) => {
    if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
    const q = parts.join('?').replace(/\s+/g, ' ').trim();
    if (q.startsWith('SELECT id, slug, shutdown_date::text AS shutdown_date')) {
      const slugs = frag(values[0]) as string[];
      return Promise.resolve(structuredClone(data.models.filter(r => slugs.includes(String(r.slug)))));
    }
    if (q === 'SELECT * FROM providers WHERE slug = ?') return Promise.resolve(structuredClone(data.providers.filter(r => r.slug === values[0])));
    if (q === 'SELECT * FROM providers WHERE slug IN ?') {
      const slugs = frag(values[0]) as string[];
      return Promise.resolve(structuredClone(data.providers.filter(r => slugs.includes(String(r.slug)))));
    }
    if (q === 'SELECT * FROM models WHERE slug = ?') return Promise.resolve(structuredClone(data.models.filter(r => r.slug === values[0])));
    if (q === 'SELECT * FROM models WHERE slug IN ?') {
      const slugs = frag(values[0]) as string[];
      return Promise.resolve(structuredClone(data.models.filter(r => slugs.includes(String(r.slug)))));
    }
    const sel = q.match(/^SELECT \* FROM (api_channel_prices|api_channel_price_variants) WHERE model_id = \? AND provider_id = \?$/);
    if (sel) return Promise.resolve(structuredClone(data[sel[1]].filter(r => r.model_id === values[0] && r.provider_id === values[1])));
    const selMany = q.match(/^SELECT \* FROM (api_channel_prices|api_channel_price_variants) WHERE provider_id = \? AND model_id IN \?$/);
    if (selMany) {
      const modelIds = frag(values[1]) as number[];
      return Promise.resolve(structuredClone(data[selMany[1]].filter(r => r.provider_id === values[0] && modelIds.includes(Number(r.model_id)))));
    }
    writes++;
    if (q.startsWith('UPDATE models SET shutdown_date')) {
      Object.assign(data.models.find(r => r.id === values[4])!, { shutdown_date: values[0], replacement_model: values[1], deprecation_source_url: values[2] });
      return Promise.resolve([]);
    }
    const table = String(frag(values[0])); const payload = frag(values[1]) as Record<string, unknown>;
    if (q === 'INSERT INTO ? ? RETURNING id') { const row = { ...payload, id: id++ }; data[table].push(row); return Promise.resolve([{ id: row.id }]); }
    if (q === 'UPDATE ? SET ? WHERE id = ?') { Object.assign(data[table].find(r => r.id === values[2])!, payload); return Promise.resolve([]); }
    throw new Error(`Unexpected SQL: ${q}`);
  }) as unknown as Sql;
  return { tx, data, writes: () => writes };
}
