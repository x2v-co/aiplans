import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';

// Run against a server with catalog data; never seeds or writes the database.
// MODEL_PAGE_TEST_BASE_URL=http://localhost:3000 node --import tsx --test scripts/model-page-walkthrough.browser.test.ts
const baseUrl = process.env.MODEL_PAGE_TEST_BASE_URL;
const models = ['openai-gpt-6-astra', 'anthropic-claude-opus-5-5', 'gemini-3.1-pro',
  'deepseek-v4-pro', 'kimi-k3', 'glm-5.2'];

test('PM walkthrough: twelve model pages hydrate without React #418', { skip: !baseUrl }, async t => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const locale of ['zh', 'en']) for (const slug of models) {
      await t.test(`${locale}/${slug}`, async () => {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
        try {
          const errors: string[] = [];
          page.on('pageerror', error => errors.push(error.message));
          page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
          const response = await page.goto(`${baseUrl}/${locale}/models/${slug}`, { waitUntil: 'networkidle' });
          assert.equal(response?.status(), 200);
          // An interactive client component confirms hydration has completed.
          await page.locator('button[aria-controls="mobile-navigation"]').click();
          await page.locator('#mobile-navigation').waitFor({ state: 'visible' });
          assert.doesNotMatch(errors.join('\n'), /#418|hydration|hydrated|server rendered HTML/i);
          assert.ok(await page.locator('h1').textContent());
          const cards = await page.locator('[data-plan-card]').allTextContents();
          for (const card of cards) assert.doesNotMatch(card, /Sources:.*verified|来源：.*核验|(?:最近核验|Last verified)[^\n]*(?:未记录|Not recorded)/);
          if (locale === 'en') assert.doesNotMatch(await page.locator('main').innerText(), /月之暗面|智谱|支付宝\/微信可用/);
        } finally { await page.close(); }
      });
    }
  } finally { await browser.close(); }
});
