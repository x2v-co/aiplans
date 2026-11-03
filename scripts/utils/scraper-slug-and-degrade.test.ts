import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalizeModelSlug, sanitizeModelSlug } from './model-normalizer';
import { canonicalModel } from '../scrapers/vertex-ai-dynamic';
import { runWithTransientDegrade } from './scraper-degrade';
import type { ScraperResult } from './validator';

const SLUG = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

test('Vertex names with date notes and commas become legal slugs (planprice 2026-11-03)', () => {
  const raw = 'Gemini 4 Argon (starting December 1, 2026), Gemini 4 Argon Batch';
  assert.equal(canonicalModel(raw), 'gemini-4-argon');
  assert.equal(canonicalizeModelSlug('gemini-4-argon(starting-december-1,-2026),-gemini-4-argon-batch'), 'gemini-4-argon');
  assert.equal(canonicalModel('Gemini 3.5 Flash starting January 5, 2027'), 'gemini-3.5-flash');
  assert.equal(canonicalModel('Gemini 3.5 Pro*'), 'gemini-3.5-pro');
  assert.equal(canonicalModel('Gemini 3 Flash (Batch)'), 'gemini-3-flash-batch');
  for (const raw of ['Gemini 4 Argon (effective Dec 1, 2026)', 'Gemini 2.5 Flash-Lite (preview), legacy', 'Gemini 4 Argon (through December 31, 2026)']) {
    const slug = sanitizeModelSlug(raw);
    assert.match(slug, SLUG, raw);
  }
  // Clean slugs are untouched.
  assert.equal(canonicalizeModelSlug('gemini-2.5-flash'), 'gemini-2.5-flash');
  assert.equal(canonicalModel('Gemini Embedding'), null);
});

const ok = (n = 3): ScraperResult => ({ success: true, source: 'Google-Gemini-API', prices: Array(n).fill({}) } as unknown as ScraperResult);
const silent = { warn: () => {} };

test('a transient single-source failure degrades to a warning without writing', async () => {
  let calls = 0, processed = 0;
  const result = await runWithTransientDegrade('Google-Gemini-API', async () => {
    calls++; throw new Error('page.waitForFunction: Timeout 15000ms exceeded.');
  }, async () => { processed++; return { updated: 1, errors: 0, warnings: 0 }; }, silent);
  assert.deepEqual(result, { updated: 0, errors: 0, warnings: 1 });
  assert.equal(calls, 2);
  assert.equal(processed, 0, 'last successful data must be kept (nothing processed)');

  const failed = await runWithTransientDegrade('X', async () => ({ success: false, source: 'X', prices: [], errors: ['Timeout 15000ms exceeded'] } as unknown as ScraperResult),
    async () => { processed++; return { updated: 0, errors: 1, warnings: 0 }; }, silent);
  assert.deepEqual(failed, { updated: 0, errors: 0, warnings: 1 });
  assert.equal(processed, 0);
});

test('retry success is processed; non-transient errors still fail', async () => {
  let calls = 0;
  const result = await runWithTransientDegrade('G', async () => {
    if (calls++ === 0) throw new Error('Timeout 15000ms exceeded');
    return ok();
  }, async r => ({ updated: r.prices.length, errors: 0, warnings: 0 }), silent);
  assert.deepEqual(result, { updated: 3, errors: 0, warnings: 0 });
  await assert.rejects(runWithTransientDegrade('G', async () => { throw new Error('Cannot read properties of undefined'); },
    async () => ({ updated: 0, errors: 0, warnings: 0 }), silent), /Cannot read/);
  const parser = await runWithTransientDegrade('G', async () => ({ success: false, source: 'G', prices: [], errors: ['no Standard table'] } as unknown as ScraperResult),
    async () => ({ updated: 0, errors: 1, warnings: 0 }), silent);
  assert.equal(parser.errors, 1);
});
