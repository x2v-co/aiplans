import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DecisionModelCatalog } from './audited-catalog';
import { AI_VERTICAL_CATALOG } from '../lib/ai-vertical-catalog';

const items = AI_VERTICAL_CATALOG.filter((item) => item.kind === 'decision-model');

for (const locale of ['zh', 'en']) {
  test(`decision models render a card per model plus the table (${locale})`, () => {
    assert.ok(items.length > 0);
    const html = renderToStaticMarkup(createElement(DecisionModelCatalog, { items, locale }));
    assert.match(html, /data-testid="decision-model-cards"/);
    assert.match(html, locale === 'zh' ? /模型卡片/ : /Model cards/);
    assert.equal((html.match(/data-slot="card"/g) ?? []).length, items.filter((i) => i.slug).length);
    assert.match(html, /<table/);
    for (const item of items.filter((i) => i.slug)) assert.ok(html.includes(`/${locale}/decision-models/${item.slug}`));
  });
}
