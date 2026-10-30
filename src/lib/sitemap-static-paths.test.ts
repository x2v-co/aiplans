import assert from 'node:assert/strict';
import test from 'node:test';
import { AI_VERTICAL_CATALOG } from './ai-vertical-catalog';
import { STATIC_PATHS, resolveStaticLastmod } from './sitemap-static-paths';

const now = new Date('2026-10-29T03:00:00Z');

test('every fixed sitemap path has a real lastmod source and no future editorial date', () => {
  const seen = new Set<string>();
  for (const entry of STATIC_PATHS) {
    assert.equal(seen.has(entry.path), false, `duplicate ${entry.path}`);
    seen.add(entry.path);
    if (entry.lastmod.source !== 'data') {
      assert.match(entry.lastmod.date, /^\d{4}-\d{2}-\d{2}$/, entry.path);
      assert.ok(new Date(entry.lastmod.date).getTime() <= Date.now(), entry.path);
    }
  }
  assert.ok(seen.has(''), 'locale root is listed');
});

test('data pages use the newest catalog write, and omit lastmod rather than invent one', () => {
  const rule = { source: 'data' } as const;
  assert.deepEqual(
    resolveStaticLastmod(rule, { dataUpdatedAt: '2026-10-28T06:54:44Z', catalog: [], now }),
    new Date('2026-10-28T06:54:44Z'),
  );
  assert.equal(resolveStaticLastmod(rule, { dataUpdatedAt: null, catalog: [], now }), undefined);
  assert.equal(resolveStaticLastmod(rule, { dataUpdatedAt: 'not a date', catalog: [], now }), undefined);
});

test('editorial pages use their fixed date, never the request time', () => {
  const lastmod = resolveStaticLastmod({ source: 'date', date: '2026-10-18' }, { dataUpdatedAt: now, catalog: [], now });
  assert.deepEqual(lastmod, new Date('2026-10-18'));
  for (const entry of STATIC_PATHS) {
    if (entry.lastmod.source !== 'date') continue;
    const resolved = resolveStaticLastmod(entry.lastmod, { dataUpdatedAt: null, catalog: AI_VERTICAL_CATALOG, now });
    assert.deepEqual(resolved, new Date(entry.lastmod.date), entry.path);
    assert.ok(resolved, entry.path);
    assert.notEqual(resolved.getTime(), now.getTime(), entry.path);
  }
});

test('catalog lists use the newest verifiedAt of their kind, else the fallback date', () => {
  const catalog = [
    { kind: 'video-model' as const, verifiedAt: '2026-10-19' },
    { kind: 'video-model' as const, verifiedAt: '2026-10-21' },
    { kind: 'music-model' as const, verifiedAt: '2026-10-25' },
  ];
  assert.deepEqual(
    resolveStaticLastmod({ source: 'catalog', kinds: ['video-model'], date: '2026-10-01' }, { dataUpdatedAt: null, catalog, now }),
    new Date('2026-10-21'),
  );
  assert.deepEqual(
    resolveStaticLastmod({ source: 'catalog', kinds: ['world-model'], date: '2026-10-01' }, { dataUpdatedAt: null, catalog, now }),
    new Date('2026-10-01'),
  );
});

test('future timestamps are clamped to now', () => {
  assert.deepEqual(
    resolveStaticLastmod({ source: 'data' }, { dataUpdatedAt: '2027-01-01T00:00:00Z', catalog: [], now }),
    now,
  );
  assert.deepEqual(
    resolveStaticLastmod({ source: 'catalog', kinds: ['video-model'], date: '2026-10-01' }, {
      dataUpdatedAt: null, catalog: [{ kind: 'video-model', verifiedAt: '2026-10-30' }], now,
    }),
    now,
  );
});
