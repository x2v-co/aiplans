import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/app/[locale]/layout.tsx', 'utf8');

test('locale layout has no Vibeloft loader or dedicated script import', () => {
  for (const marker of ['vibeloft', 'vibeloft.ai', 'telemetry/v1.js', 'data-vl-', 'vl_web.']) {
    assert.equal(source.toLowerCase().includes(marker), false, `Unexpected layout marker: ${marker}`);
  }
  assert.equal(/\bfrom\s*['"]next\/script['"]/.test(source), false);
});

test('locale layout retains Google Analytics and the consent manager', () => {
  assert.match(source, /import GoogleAnalytics from ['"]@\/components\/GoogleAnalytics['"]/);
  assert.match(source, /<GoogleAnalytics\s*\/>/);
  assert.match(source, /import ConsentManager from ['"]@\/components\/ConsentManager['"]/);
  assert.match(source, /<ConsentManager\s+locale=\{locale\}\s*\/>/);
});
