import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DataTrustLabel, EntitlementLine } from './data-trust-label';
import { planCreditTrust, usageEstimateTrust, type TrustAssessment } from '../lib/data-trust';

const verified: TrustAssessment = {
  sourceLabel: 'OpenAI API 定价',
  sourceUrl: 'https://developers.openai.com/api/docs/pricing',
  conditions: ['币种 USD，计价单位 每百万 tokens'],
  verifiedOn: '2026-10-18',
  flags: { estimated: false, expired: false, stale: false, unverified: false },
};

function html(node: ReturnType<typeof createElement>): string {
  return renderToStaticMarkup(node);
}

test('verified price renders all four facts', () => {
  const markup = html(createElement(DataTrustLabel, { fact: verified, locale: 'zh' }));
  assert.match(markup, /来源/);
  assert.match(markup, /适用条件/);
  assert.match(markup, /最近核验/);
  assert.match(markup, /2026-10-18/);
  assert.match(markup, /已核验/);
  assert.match(markup, /developers\.openai\.com/);
  assert.equal(markup.includes('估算'), false);
  assert.equal(markup.includes('已过期'), false);
});

test('estimates and expired rows are marked and are not called verified', () => {
  const estimate = html(createElement(DataTrustLabel, { fact: usageEstimateTrust('zh', new Date('2026-10-18T00:00:00Z')), locale: 'zh' }));
  assert.match(estimate, /估算/);
  assert.match(estimate, /data-trust-estimated="true"/);
  assert.equal(estimate.includes('已核验'), false);
  assert.match(estimate, /不能当成账单/);

  const expired = planCreditTrust({ label: 'Claude 官方定价页', url: 'https://claude.com/pricing' }, 'zh');
  const credit = html(createElement(DataTrustLabel, {
    fact: { ...expired, flags: { ...expired.flags, expired: true } },
    locale: 'zh',
  }));
  assert.match(credit, /已过期/);
  assert.match(credit, /待核验/);
  assert.match(credit, /bg-red-600/);
  assert.equal(credit.includes('已核验'), false);
});

test('estimated entitlement text is badged instead of reading as a confirmed benefit', () => {
  const guessed = html(createElement(EntitlementLine, { text: '大约 100 万 token', locale: 'zh' }));
  assert.match(guessed, /估算/);
  assert.match(guessed, /大约 100 万 token/);
  const firm = html(createElement(EntitlementLine, { text: 'Priority support', locale: 'en' }));
  assert.equal(firm.includes('Estimate'), false);
  assert.match(firm, /Priority support/);
});
