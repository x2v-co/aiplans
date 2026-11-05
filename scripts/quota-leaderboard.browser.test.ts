import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';

// Opt-in, read-only: QUOTA_LEADERBOARD_TEST_BASE_URL=http://localhost:3000 npx tsx --test scripts/quota-leaderboard.browser.test.ts
// QUOTA_LEADERBOARD_TEST_CHROMIUM_PATH may point to an already installed Chromium.
const baseUrl = process.env.QUOTA_LEADERBOARD_TEST_BASE_URL;

test('quota sort responds, reorders weekly input rows, and keeps five-hour state consistent', { skip: !baseUrl }, async () => {
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
        const inputRows = board.locator('[data-mix="input"] tbody tr');
        const ids = () => inputRows.evaluateAll(rows => rows.map(row => row.getAttribute('data-row')));
        assert.equal(await multiple.getAttribute('aria-pressed'), 'true');
        await usd.click();
        await status.getByText(locale === 'zh' ? '绝对金额 ↓' : 'Absolute value ↓', { exact: true }).waitFor();
        assert.equal(await usd.getAttribute('aria-pressed'), 'true');
        assert.equal(await multiple.getAttribute('aria-pressed'), 'false');
        assert.ok((await usd.getAttribute('class'))!.includes('font-semibold'));
        assert.ok(!(await multiple.getAttribute('class'))!.includes('font-semibold'));
        assert.match(await status.innerText(), locale === 'zh' ? /两种排序结果相同/ : /Both sorts give the same order/);
        await board.getByRole('button', { name: locale === 'zh' ? '周' : 'Week', exact: true }).click();
        await board.locator('[data-row="codex-pro-week"]').waitFor();
        assert.deepEqual(await ids(), ['codex-pro-week', 'volcengine-pro-week']);
        await multiple.click();
        await status.getByText(locale === 'zh' ? '月费倍数 ↓' : 'Fee multiple ↓', { exact: true }).waitFor();
        assert.deepEqual(await ids(), ['volcengine-pro-week', 'codex-pro-week']);
        await usd.click();
        await status.getByText(locale === 'zh' ? '绝对金额 ↓' : 'Absolute value ↓', { exact: true }).waitFor();
        assert.deepEqual(await ids(), ['codex-pro-week', 'volcengine-pro-week']);
        await multiple.click();
        await status.getByText(locale === 'zh' ? '月费倍数 ↓' : 'Fee multiple ↓', { exact: true }).waitFor();
        await board.getByRole('button', { name: locale === 'zh' ? '5 小时' : '5 hours', exact: true }).click();
        await board.locator('[data-row="volcengine-pro-5h"]').waitFor();
        assert.equal(await multiple.isDisabled(), true);
        assert.equal(await multiple.getAttribute('aria-pressed'), 'false');
        assert.equal(await usd.getAttribute('aria-pressed'), 'true');
        assert.ok((await usd.getAttribute('class'))!.includes('font-semibold'));
        await board.getByRole('button', { name: locale === 'zh' ? '周' : 'Week', exact: true }).click();
        await board.locator('[data-row="volcengine-pro-week"]').waitFor();
        assert.equal(await multiple.getAttribute('aria-pressed'), 'true');
        assert.deepEqual(await ids(), ['volcengine-pro-week', 'codex-pro-week']);
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});
