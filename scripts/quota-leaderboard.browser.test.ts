import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';

// Opt-in, read-only: QUOTA_LEADERBOARD_TEST_BASE_URL=http://localhost:3000 npx tsx --test scripts/quota-leaderboard.browser.test.ts
// QUOTA_LEADERBOARD_TEST_CHROMIUM_PATH may point to an already installed Chromium.
const baseUrl = process.env.QUOTA_LEADERBOARD_TEST_BASE_URL;

const MONTH_BY_MULTIPLE = [
  'claude-pro-month-agentic',
  'claude-pro-month-output',
  'x-ultra-month',
  'codex-pro-month',
  'volcengine-pro-month',
  'cursor-legacy-month',
];
const MONTH_BY_USD = [
  'x-ultra-month',
  'codex-pro-month',
  'cursor-legacy-month',
  'claude-pro-month-agentic',
  'claude-pro-month-output',
  'volcengine-pro-month',
];
const WEEK_BY_MULTIPLE = [
  'claude-pro-week-agentic',
  'volcengine-pro-week',
  'claude-pro-week-output',
  'x-ultra-week',
  'codex-pro-week',
];
const WEEK_BY_USD = [
  'x-ultra-week',
  'codex-pro-week',
  'claude-pro-week-agentic',
  'volcengine-pro-week',
  'claude-pro-week-output',
];
const FIVE_HOUR = ['claude-pro-5h-agentic', 'volcengine-pro-5h', 'claude-pro-5h-output'];

test('quota sort is one global ranking and reorders when the metric or window changes', { skip: !baseUrl }, async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.QUOTA_LEADERBOARD_TEST_CHROMIUM_PATH });
  try {
    for (const locale of ['zh', 'en']) {
      const page = await browser.newPage();
      try {
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${baseUrl}/${locale}/quota-bench`, { waitUntil: 'networkidle' });
        const board = page.getByTestId('quota-leaderboard');
        const multiple = board.getByRole('button', { name: locale === 'zh' ? '月费倍数' : 'Fee multiple', exact: true });
        const usd = board.getByRole('button', { name: locale === 'zh' ? '绝对金额' : 'Absolute value', exact: true });
        const status = board.getByRole('status');
        const ranked = () => board.locator('tr[data-rank]').evaluateAll(rows => rows.map(row => ({
          id: row.getAttribute('data-row'),
          rank: row.getAttribute('data-rank'),
        })));
        const expectRanks = async (ids: string[]) => {
          const rows = await ranked();
          assert.deepEqual(rows.map(row => row.id), ids);
          assert.deepEqual(rows.map(row => row.rank), ids.map((_, index) => String(index + 1)));
        };
        assert.equal(await board.locator('table').count(), 1);
        assert.equal(await board.locator('h3').count(), 0);
        assert.equal(await multiple.getAttribute('aria-pressed'), 'true');
        await expectRanks(MONTH_BY_MULTIPLE);
        assert.equal(await board.locator('[data-rank="1"] td').first().innerText(), '#1');
        assert.match(await board.locator('[data-row="claude-pro-month-agentic"]').innerText(), locale === 'zh' ? /Agent/ : /Agentic/);
        const high = board.getByRole('button', { name: locale === 'zh' ? '从高到低' : 'High to low', exact: true });
        const low = board.getByRole('button', { name: locale === 'zh' ? '从低到高' : 'Low to high', exact: true });
        const cursor = board.locator('[data-row="cursor-legacy-month"]');
        assert.equal(await high.getAttribute('aria-pressed'), 'true');
        assert.equal(await low.getAttribute('aria-pressed'), 'false');
        assert.equal(await cursor.getAttribute('data-unranked'), null);
        assert.equal(await cursor.getAttribute('data-rank'), '6');
        assert.match(await cursor.innerText(), /Cursor Ultra \(legacy\)/);
        assert.match(await cursor.innerText(), /composer-2\.5/);
        assert.equal(await board.getByTestId('quota-unranked').count(), 0);
        assert.doesNotMatch(await board.innerText(), /组内排序|Within each workload|两种指标名次相同|Both metrics give the same ranks/);
        await low.click();
        await status.getByText(locale === 'zh' ? '月费倍数 ↑' : 'Fee multiple ↑', { exact: true }).waitFor();
        assert.equal(await low.getAttribute('aria-pressed'), 'true');
        assert.equal(await board.locator('th[aria-sort="ascending"]').count(), 1);
        await expectRanks([...MONTH_BY_MULTIPLE].reverse());
        assert.equal(await cursor.getAttribute('data-unranked'), null);
        assert.equal(await cursor.getAttribute('data-rank'), '1');
        await high.click();
        await status.getByText(locale === 'zh' ? '月费倍数 ↓' : 'Fee multiple ↓', { exact: true }).waitFor();
        await expectRanks(MONTH_BY_MULTIPLE);

        await usd.click();
        await status.getByText(locale === 'zh' ? '绝对金额 ↓' : 'Absolute value ↓', { exact: true }).waitFor();
        assert.equal(await usd.getAttribute('aria-pressed'), 'true');
        assert.equal(await multiple.getAttribute('aria-pressed'), 'false');
        assert.ok((await usd.getAttribute('class'))!.includes('font-semibold'));
        assert.ok(!(await multiple.getAttribute('class'))!.includes('font-semibold'));
        await expectRanks(MONTH_BY_USD);
        assert.equal(await cursor.getAttribute('data-rank'), '3');
        assert.equal(await cursor.getAttribute('data-unranked'), null);
        assert.match(await board.getByTestId('quota-leader').innerText(), /X Subscription Ultra/);
        assert.doesNotMatch(await status.innerText(), locale === 'zh' ? /两种指标名次相同/ : /Both metrics give the same ranks/);
        await low.click();
        await status.getByText(locale === 'zh' ? '绝对金额 ↑' : 'Absolute value ↑', { exact: true }).waitFor();
        await expectRanks([...MONTH_BY_USD].reverse());
        assert.equal(await cursor.getAttribute('data-rank'), '4');
        await high.click();
        await status.getByText(locale === 'zh' ? '绝对金额 ↓' : 'Absolute value ↓', { exact: true }).waitFor();
        await expectRanks(MONTH_BY_USD);

        await board.getByRole('button', { name: locale === 'zh' ? '周' : 'Week', exact: true }).click();
        await board.locator('[data-row="codex-pro-week"]').waitFor();
        await expectRanks(WEEK_BY_USD);
        assert.equal(await board.getByTestId('quota-unranked').count(), 0);
        await multiple.click();
        await status.getByText(locale === 'zh' ? '月费倍数 ↓' : 'Fee multiple ↓', { exact: true }).waitFor();
        await expectRanks(WEEK_BY_MULTIPLE);
        await usd.click();
        await status.getByText(locale === 'zh' ? '绝对金额 ↓' : 'Absolute value ↓', { exact: true }).waitFor();
        await expectRanks(WEEK_BY_USD);
        await multiple.click();
        await status.getByText(locale === 'zh' ? '月费倍数 ↓' : 'Fee multiple ↓', { exact: true }).waitFor();
        await board.getByRole('button', { name: locale === 'zh' ? '5 小时' : '5 hours', exact: true }).click();
        await board.locator('[data-row="volcengine-pro-5h"]').waitFor();
        await expectRanks(FIVE_HOUR);
        assert.equal(await multiple.isDisabled(), true);
        assert.equal(await multiple.getAttribute('aria-pressed'), 'false');
        assert.equal(await usd.getAttribute('aria-pressed'), 'true');
        assert.ok((await usd.getAttribute('class'))!.includes('font-semibold'));
        assert.match(await board.innerText(), locale === 'zh' ? /只比绝对金额/ : /compare absolute value only/);
        await board.getByRole('button', { name: locale === 'zh' ? '周' : 'Week', exact: true }).click();
        await board.locator('[data-row="volcengine-pro-week"]').waitFor();
        assert.equal(await multiple.getAttribute('aria-pressed'), 'true');
        await expectRanks(WEEK_BY_MULTIPLE);
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});
