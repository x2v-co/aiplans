import { jsx } from 'react/jsx-runtime';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';
import { benchmarkForPlan, type BenchRecord } from './quota-bench-summary';
import { QuotaBenchBadge, QuotaBenchUsd, QuotaBenchUsdHeadline } from './quota-bench-usd';
import { QuotaBenchResults } from './quota-bench-results';
import { PlanQuotaEstimates } from './quota-estimates';
import data from '../../public/reports/quota-bench-2026-10.json';
import v1 from '../../public/reports/quota-bench-2026-10.v1.json';
import ledger from '../../public/reports/quota-bench-2026-10-ledger.json';

const cursor = data.records.find(record => record.id === 'cursor-ultra')!;
const codex = data.records.find(record => record.id === 'codex-pro')!;
const round = (value: number, digits: number) => Number(value.toFixed(digits));

test('Cursor ledger reconciles all calls and the separate metered estimate sample', () => {
  const basis = cursor.estimateBasis!;
  const runs = ledger.runs.filter(run => run.provider === 'cursor');
  const included = runs.filter(run => basis.batches.includes(run.run.split('/')[0]));
  const excluded = runs.filter(run => basis.excluded.batches.includes(run.run.split('/')[0]));
  const sumTokens = (sample: typeof runs) => sample.reduce((sum, run) => ({
    input: sum.input + run.tokens.input,
    cacheRead: sum.cacheRead + run.tokens.cacheRead,
    cacheWrite: sum.cacheWrite + run.tokens.cacheWrite,
    output: sum.output + run.tokens.output,
  }), { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 });
  const sumTotal = (sample: typeof runs) => sample.reduce((sum, run) => sum + run.totalTokens, 0);
  assert.equal(runs.length, 16);
  assert.equal(runs.length, cursor.calls);
  assert.equal(sumTotal(runs), 1162257);
  assert.deepEqual(sumTokens(runs), cursor.tokens);
  assert.equal(sumTotal(runs), Object.values(cursor.tokens).reduce((sum, value) => sum + value, 0));
  assert.deepEqual(basis.batches, ['cursor-01', 'cursor-02', 'cursor-03']);
  assert.equal(included.length, 12);
  assert.equal(included.length, basis.calls);
  assert.equal(sumTotal(included), 801760);
  assert.equal(sumTotal(included), basis.totalTokens);
  assert.deepEqual(sumTokens(included), basis.tokens);
  assert.deepEqual(basis.excluded.batches, ['cursor-04']);
  assert.equal(excluded.length, 4);
  assert.equal(excluded.length, basis.excluded.calls);
  assert.equal(sumTotal(excluded), 360497);
  assert.equal(sumTotal(excluded), basis.excluded.totalTokens);
  assert.equal(included.length + excluded.length, runs.length);
});

test('Cursor USD and token estimates use the 12-call interval and meter rounding only', () => {
  const basis = cursor.estimateBasis!;
  const pricing = cursor.pricing!;
  const equivalent = cursor.apiEquivalentUsd!;
  const sample = (basis.tokens.input * pricing.input + basis.tokens.cacheRead * pricing.cacheRead + basis.tokens.cacheWrite * (pricing.cacheWrite ?? 0) + basis.tokens.output * pricing.output) / 1e6;
  assert.equal(round(sample, 6), 0.444198);
  assert.equal(round(sample, 6), equivalent.sample);
  assert.equal(basis.usedDeltaPp, 0.0147);
  assert.equal(basis.meterPrecisionPp, 0.0001);
  assert.equal(round(cursor.usedAfter - cursor.usedBefore, 4), basis.usedDeltaPp);
  for (const [bound, delta] of [['low', 0.0148], ['mid', 0.0147], ['high', 0.0146]] as const) {
    assert.ok(Math.abs(sample / (delta / 100) - equivalent[bound]) < 0.01);
    assert.equal(round(sample / (delta / 100), 2), equivalent[bound]);
    assert.equal(cursor.estimate![bound], Math.round(basis.totalTokens * 100 / delta));
  }
});

test('Codex USD equivalent values the current Astra retest at standard API prices', () => {
  const pricing = codex.pricing!;
  const equivalent = codex.apiEquivalentUsd!;
  const tokens = codex.tokens;
  const sample = (tokens.input * 10 + tokens.cacheRead * 1 + tokens.cacheWrite * 12.5 + tokens.output * 50) / 1e6;
  assert.equal(round(sample, 6), 23.676094);
  assert.equal(round(sample, 6), equivalent.sample);
  assert.deepEqual([pricing.input, pricing.cacheRead, pricing.cacheWrite, pricing.output], [10, 1, 12.5, 50]);
  assert.equal(codex.usedAfter - codex.usedBefore, 3);
  assert.equal(round(sample / 0.03, 2), equivalent.mid);
  assert.equal(round(sample / 0.04, 2), equivalent.low);
  assert.equal(round(sample / 0.02, 2), equivalent.high);
});

test('every USD equivalent has a dated HTTPS pricing source', () => {
  for (const record of data.records) {
    assert.equal(record.pricing === null, record.apiEquivalentUsd === null);
    assert.ok(Object.hasOwn(record, 'estimateBasis'));
    if (record.pricing) {
      assert.match(record.pricing.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(record.pricing.source, /^https:\/\//);
    }
  }
});

test('v2 supersedes the reviewed v1 snapshot without changing prior Codex or Volcengine values', () => {
  assert.equal(v1.schemaVersion, 1);
  assert.equal(v1.records.find(record => record.id === 'cursor-ultra')!.estimate, null);
  assert.equal(data.schemaVersion, 2);
  assert.equal(data.publishedAt, '2026-10-29');
  assert.equal(data.supersedes, '/reports/quota-bench-2026-10.v1.json');
  for (const id of ['codex-pro', 'volcengine-pro']) {
    const previous = v1.records.find(record => record.id === id)!;
    const current = data.records.find(record => record.id === id)!;
    for (const [key, value] of Object.entries(previous)) {
      if (id === 'codex-pro' && key === 'apiEquivalentUsd') continue;
      assert.deepEqual(current[key as keyof typeof current], value, `${id}.${key}`);
    }
  }
  for (const source of v1.sources) assert.ok(data.sources.includes(source));
  assert.equal(benchmarkForPlan('cursor-ultra'), undefined);
});

test('USD method renders localized samples and prices without repeating the headline', () => {
  for (const locale of ['zh', 'en']) {
    const html = renderToStaticMarkup(createElement(QuotaBenchUsd, { record: cursor, locale }));
    const phrases = locale === 'zh'
      ? ['推算样本：前 12 轮 801,760 tokens ≈ $0.444198', '第 4 批 4 轮 360,497 tokens 未计入', '输入 $0.5 / 缓存读取 $0.2 / 输出 $2.5', '核验于 2026-10-29', '价格来源']
      : ['Estimate sample: first 12 calls, 801,760 tokens ≈ $0.444198', 'batch 4 (4 calls, 360,497 tokens) excluded', 'input $0.5 / cache read $0.2 / output $2.5', 'verified 2026-10-29', 'Price source'];
    for (const phrase of phrases) assert.ok(html.includes(phrase), phrase);
    assert.ok(!html.includes('$3,022'));
    const codexHtml = renderToStaticMarkup(createElement(QuotaBenchUsd, { record: codex, locale }));
    for (const phrase of locale === 'zh' ? ['样本 token 折合 $23.676094', '缓存写入 $12.5'] : ['Sample tokens ≈ $23.676094', 'cache write $12.5']) assert.ok(codexHtml.includes(phrase), phrase);
    assert.equal(renderToStaticMarkup(createElement(QuotaBenchUsd, { record: { ...cursor, apiEquivalentUsd: null }, locale })), '');
  }
});

test('USD headlines render localized windows, rounding ranges and data-driven qualifiers', () => {
  for (const locale of ['zh', 'en']) {
    const cursorHtml = renderToStaticMarkup(createElement(QuotaBenchUsdHeadline, { record: cursor, locale }));
    const codexHtml = renderToStaticMarkup(createElement(QuotaBenchUsdHeadline, { record: codex, locale, compact: true }));
    for (const phrase of locale === 'zh'
      ? ['≈ $3,022', '/ 月池', '区间 $3,001–$3,042（读数舍入误差）', 'token 折合（按公开 API 标准价）', '有条件实测，不是官方额度或余额', '套餐档位未核验', '可能按 Fast 版计费']
      : ['≈ $3,022', '/ monthly pool', 'Range $3,001–$3,042 (meter rounding)', 'Token value at public API list price', 'Conditional measurement, not an official allowance or credit', 'plan tier unverified', 'may be billed as the Fast variant']) assert.ok(cursorHtml.includes(phrase), phrase);
    for (const phrase of ['≈ $789', '$592–$1,184', 'text-2xl', locale === 'zh' ? '/ 周' : '/ week']) assert.ok(codexHtml.includes(phrase), phrase);
    assert.ok(cursorHtml.includes('text-3xl'));
    assert.doesNotMatch(codexHtml, /Fast|tier unverified|套餐档位未核验/);
    const shortWindow: BenchRecord = { ...codex, window: '5h' };
    assert.ok(renderToStaticMarkup(createElement(QuotaBenchUsdHeadline, { record: shortWindow, locale })).includes(locale === 'zh' ? '/ 5 小时' : '/ 5 hours'));
    assert.equal(renderToStaticMarkup(createElement(QuotaBenchUsdHeadline, { record: { ...cursor, apiEquivalentUsd: null }, locale })), '');
    for (const pricing of [{ ...cursor.pricing!, fastVariantRisk: false }, { ...cursor.pricing!, variant: 'fast' }]) {
      const html = renderToStaticMarkup(createElement(QuotaBenchUsdHeadline, { record: { ...cursor, pricing }, locale }));
      assert.doesNotMatch(html, /Fast/);
    }
  }
});

test('benchmark results lead with both USD summaries before folded methods', () => {
  for (const locale of ['zh', 'en']) {
    const html = renderToStaticMarkup(createElement(QuotaBenchResults, { locale }));
    for (const phrase of locale === 'zh'
      ? ['≈ $3,022', '≈ $789', '/ 月池', '/ 周', '套餐档位未核验', '可能按 Fast 版计费', '查看详情 ↓', '方法说明与完整口径']
      : ['≈ $3,022', '≈ $789', '/ monthly pool', '/ week', 'plan tier unverified', 'may be billed as the Fast variant', 'Details ↓', 'Method, full scope and reconciliation']) assert.ok(html.includes(phrase), phrase);
    assert.ok(html.includes('<details'));
    assert.ok(html.includes('<summary'));
    assert.ok(html.indexOf('$3,022') < html.indexOf('<details'));
    assert.ok(html.indexOf('$789') < html.indexOf('<details'));
    const codexTile = html.slice(html.indexOf(codex.plan), html.indexOf('href="#codex-pro"'));
    assert.ok(codexTile.includes('≈ $789'));
    assert.doesNotMatch(codexTile, /Fast|tier unverified|套餐档位未核验/);
    const cursorTile = html.slice(html.indexOf(cursor.plan), html.indexOf('href="#cursor-ultra"'));
    assert.ok(cursorTile.includes(locale === 'zh' ? '套餐档位未核验；可能按 Fast 版计费' : 'plan tier unverified; may be billed as the Fast variant'));
  }
});

test('benchmark badges show only verified tiers with a measured USD equivalent', () => {
  for (const locale of ['zh', 'en']) {
    const description = locale === 'zh'
      ? '有条件实测：样本 token 按公开 API 标准价折合的金额，不是官方额度或余额。点击查看方法。'
      : 'Conditional measurement: sample tokens valued at public API list price; not an official allowance or credit. Click for method.';
    for (const planSlug of ['chatgpt-pro', 'chatgpt-pro-200']) {
      const html = renderToStaticMarkup(createElement(QuotaBenchBadge, { planSlug, locale }));
      assert.ok(html.includes(locale === 'zh' ? '实测 ≈ $789 / 周 ⓘ' : 'Measured ≈ $789 / week ⓘ'));
      assert.ok(html.includes(`href="/${locale}/quota-bench#codex-pro"`));
      assert.ok(html.includes(`title="${description}"`));
      assert.ok(html.includes(`aria-label="${description}"`));
      assert.ok(html.includes('data-quota-bench-badge="codex-pro"'));
      assert.ok(html.includes('border-dashed'));
    }
    for (const planSlug of ['cursor-ultra', 'cursor-pro', 'seed-pro', 'unknown', 'chatgpt-pro-100', 'chatgpt-pro-500']) {
      assert.equal(renderToStaticMarkup(createElement(QuotaBenchBadge, { planSlug, locale })), '');
    }
  }
});

test('Pro 200 plan quota widget puts the USD headline before folded evidence', () => {
  for (const locale of ['zh', 'en']) {
    const children = createElement(PlanQuotaEstimates, { locale, planSlug: 'chatgpt-pro-200', estimates: [] });
    const html = renderToStaticMarkup(jsx(NextIntlClientProvider, {
      locale, timeZone: 'UTC', messages: locale === 'zh' ? zh : en, children,
    }));
    assert.ok(html.includes('≈ $789'));
    assert.ok(html.includes('<details'));
    assert.ok(html.indexOf('≈ $789') < html.indexOf('<details'));
    assert.ok(html.includes('64,883,075–129,766,150'));
    assert.ok(html.includes('data-quota-bench="codex-pro"'));
    assert.ok(html.indexOf(`href="/${locale}/quota-bench#codex-pro"`) > html.indexOf('</details>'));
  }
});

test('benchmark results render pricing notes in the selected locale', () => {
  const zhHtml = renderToStaticMarkup(createElement(QuotaBenchResults, { locale: 'zh' }));
  const enHtml = renderToStaticMarkup(createElement(QuotaBenchResults, { locale: 'en' }));
  assert.ok(zhHtml.includes('实际计费版本未核验'));
  assert.ok(enHtml.includes('variant actually billed is not verified'));
});
