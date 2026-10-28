import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditExitCode, missingPlanFields } from './audit-plan-policy';

test('creative official_reference / research rows are not unclassified (116 of the 124 warnings)', () => {
  assert.deepEqual(missingPlanFields({ plan_kind: 'creative', pricing_model: 'official_reference', plan_line: null, tier_rank: null, model_selector: null }), []);
  assert.deepEqual(missingPlanFields({ plan_kind: 'creative', pricing_model: 'research', plan_line: 'world-google', tier_rank: null }), []);
  assert.deepEqual(missingPlanFields({ plan_kind: 'creative', pricing_model: 'subscription', plan_line: 'creative-pika', tier_rank: 1 }), []);
});

test('LLM plans still need a selector; subscriptions still need line and rank', () => {
  assert.deepEqual(missingPlanFields({ plan_kind: 'coding', pricing_model: 'subscription', plan_line: 'muse-code', tier_rank: 0 }), ['model_selector']);
  assert.deepEqual(missingPlanFields({ plan_kind: 'creative', pricing_model: 'subscription' }), ['plan_line', 'tier_rank']);
  assert.deepEqual(missingPlanFields({}), ['plan_kind', 'plan_line', 'tier_rank', 'model_selector']);
});

test('exit code: warnings pass by default, --strict keeps exit 2', () => {
  assert.equal(auditExitCode(false, 461, false), 0);
  assert.equal(auditExitCode(false, 461, true), 2);
  assert.equal(auditExitCode(true, 1, false), 1);
  assert.equal(auditExitCode(false, 0, true), 0);
});

// Freshness and its alert routing form one contract: no curated row may fall
// between a visible stale badge and the nightly operator digest.
import { planVerificationFinding, shouldAlertFinding } from './audit-plan-policy';
import { scrapeOpenAIPlans } from '../scrapers/plan-openai-dynamic';

const now = Date.parse('2026-10-28T00:00:00Z');
test('70-day-old manual and scraped plans both produce actionable findings', () => {
  for (const source of ['manual', 'scraper']) {
    const finding = planVerificationFinding({ id: 1, slug: 'chatgpt-free', source, last_verified: '2026-08-19' }, now, 30);
    assert.equal(finding?.check, 'plans.stale');
    assert.equal(finding?.ref.days, 70);
    assert.equal(shouldAlertFinding(finding!), true);
  }
});

test('missing/invalid verification alerts; fresh and exact 30-day boundary do not', () => {
  for (const last_verified of [null, '', 'invalid']) {
    const finding = planVerificationFinding({ id: 1, slug: 'free', source: 'manual', last_verified }, now, 30);
    assert.equal(finding?.check, 'plans.missing_verified');
    assert.equal(shouldAlertFinding(finding!), true);
  }
  for (const last_verified of ['2026-10-28', '2026-09-28']) {
    assert.equal(planVerificationFinding({ id: 1, slug: 'free', last_verified }, now, 30), null);
  }
  assert.equal(shouldAlertFinding({ check: 'plans.missing_kind', severity: 'warning' }), false);
  assert.equal(shouldAlertFinding({ check: 'plans.mapping_drift', severity: 'critical' }), true);
  assert.equal(shouldAlertFinding({ check: 'prices.modelsdev_divergence', severity: 'warning' }), true);
});

test('OpenAI blocked fetches fail with zero plans instead of reporting verification success', async () => {
  for (const result of [
    { success: false, status: 403, error: 'HTTP 403: Forbidden' },
    { success: false, error: 'Cloudflare challenge' },
    { success: false, error: 'browser executable missing' },
    { success: true, data: '<title>Just a moment</title>Free Plus $20<script>window._cf_chl_opt={}</script>' },
    { success: true, data: '<html>No subscription pricing available</html>' },
  ]) {
    const scraped = await scrapeOpenAIPlans(async () => result);
    assert.equal(scraped.success, false);
    assert.deepEqual(scraped.plans, []);
    assert.ok(scraped.errors?.length);
    if (result.error) assert.ok(scraped.errors?.some(error => error.includes(result.error!)));
  }
});

test('OpenAI genuine priced page still parses successfully', async () => {
  const result = await scrapeOpenAIPlans(async () => ({ success: true, data: '<h2>ChatGPT Plus</h2><p>$20 / month</p>' }));
  assert.equal(result.success, true);
  assert.equal(result.plans[0].planSlug, 'chatgpt-plus');
  assert.equal(result.plans[0].priceMonthly, 20);
});


test('OpenAI HTTP 200 without paid amounts cannot verify Free/Enterprise alone', async () => {
  const result = await scrapeOpenAIPlans(async () => ({ success: true, status: 200,
    data: '<nav>Enterprise</nav><h2>Free</h2><h2>Plus</h2><p>/ month</p><h2>Pro</h2><p>From / month</p>' }));
  assert.equal(result.success, false);
  assert.deepEqual(result.plans, []);
  assert.match(result.errors![0], /Plus, Pro.*no supported USD price/);
});
