import assert from 'node:assert/strict';
import test from 'node:test';
import {
  contentHash, extractText, lineDiff, monitorOptions, normalizeQuotaText,
  snapshotDecision, type SnapshotState,
} from './quota-text-monitor';
import { QUOTA_TEXT_SOURCES } from '../config/quota-text-sources';

test('extracts visible quota text with inline phrases and table rows intact', () => {
  const html = `<!doctype html><html><head><style>.limit{}</style></head><body>
    <script>window.usage = 'nonce123';</script><!-- messages 999 -->
    <h2>Usage limits</h2><p>100
      <strong>messages</strong> &amp; 20&#32;requests</p>
    <table><tr><th>Tokens</th><td>500</td></tr></table>
    <svg><text>extra limit</text></svg><p>5&#x2d;hour reset</p>
    <noscript>Enable JS for messages</noscript><template>weekly noise</template>
  </body></html>`;
  assert.equal(normalizeQuotaText(extractText(html)), 'Usage limits\n100 messages & 20 requests\nTokens 500\n5-hour reset');
});

test('normalization removes whitespace, timestamp metadata and nonce noise but preserves quota numbers', () => {
  const before = '  Usage  limit: 50\trequests  nonce=abc123 updated at: 2026-10-10T08:30:00Z\r\nweekly tokens: 200  request-id=old-123';
  const after = 'Usage limit: 50 requests nonce=new456 updated at: 2026-10-15T09:45:00Z\nweekly tokens: 200 request-id=new-567';
  assert.equal(normalizeQuotaText(before), normalizeQuotaText(after));
  assert.equal(contentHash(normalizeQuotaText(before)), contentHash(normalizeQuotaText(after)));
  assert.notEqual(contentHash(normalizeQuotaText(after)), contentHash(normalizeQuotaText(after.replace('50', '60'))));
  const promo = 'Usage limit doubles until 2026-10-31';
  assert.equal(normalizeQuotaText(promo), promo);
  assert.notEqual(contentHash(normalizeQuotaText(promo)), contentHash(normalizeQuotaText(promo.replace('31', '30'))));
});

test('filters all required quota concepts in English and Chinese without matching x inside words', () => {
  const relevant = [
    'Usage resets', 'Message cap', '100 tokens', 'Every 5 hours', '5-hour reset',
    'Weekly pool', '20x more', '20× more', 'x 5 allowance', '2倍', '今日额度', '每月100次',
    '100 prompts', '20 requests', 'Limit changed',
  ];
  assert.equal(normalizeQuotaText([...relevant, 'Experience', 'Contact sales', 'Copyright 2026', 'Updated at: 2026-10-15'].join('\n')), relevant.join('\n'));
  assert.equal(normalizeQuotaText(extractText('<script>usage limit 100</script><div>Welcome</div>')), '');
});

test('line diff is short, shows additions/removals, counts duplicates and catches reorder-only changes', () => {
  assert.equal(lineDiff('100 messages\nweekly reset', '200 messages\nweekly reset'), '- 100 messages\n+ 200 messages');
  assert.equal(lineDiff('Tokens 5\nTokens 5', 'Tokens 5'), '- Tokens 5');
  assert.equal(lineDiff('usage\nweekly', 'weekly\nusage'), '(quota lines reordered)');
  assert.equal(lineDiff('usage', 'usage'), '');
  assert.equal(lineDiff('', 'one\ntwo\nthree', 2), '+ one\n+ two\n…');
  assert.ok(lineDiff('', 'x'.repeat(1000)).length <= 300);
});

function snapshot(text: string, changed = false, alertedAt: string | null = null): SnapshotState {
  return { contentHash: contentHash(text), extractedText: text, changed, alertedAt };
}

test('first snapshot is baseline, unchanged text is quiet, new text alerts once', () => {
  const a = snapshot('Usage 10');
  const b = snapshot('Usage 20', true);
  assert.deepEqual(snapshotDecision(undefined, undefined, a.contentHash), { insert: true, changed: false, alert: false });
  assert.deepEqual(snapshotDecision(a, a, a.contentHash), { insert: false, changed: false, alert: false });
  assert.deepEqual(snapshotDecision(a, undefined, b.contentHash), { insert: true, changed: true, alert: true });
  assert.equal(snapshotDecision(b, { ...b, alertedAt: '2026-10-15' }, b.contentHash).alert, false);
});

test('reversion to baseline or an already-alerted version does not alert or insert again', () => {
  const a = snapshot('Usage 10');
  const b = snapshot('Usage 20', true, '2026-10-15');
  assert.deepEqual(snapshotDecision(b, a, a.contentHash), { insert: false, changed: false, alert: false });
  assert.deepEqual(snapshotDecision(a, b, b.contentHash), { insert: false, changed: true, alert: false });
});

test('failed changed-version alert remains retryable without a duplicate snapshot/evidence insert', () => {
  const b = snapshot('Usage 20', true);
  assert.deepEqual(snapshotDecision(b, b, b.contentHash), { insert: false, changed: true, alert: true });
});

test('CLI is safe by default, supports source filtering and rejects ambiguous flags', () => {
  assert.deepEqual(monitorOptions([]), { dryRun: true, sourceId: undefined });
  assert.deepEqual(monitorOptions(['--source=claude-usage', '--dry-run']), { dryRun: true, sourceId: 'claude-usage' });
  assert.deepEqual(monitorOptions(['--apply']), { dryRun: false, sourceId: undefined });
  for (const args of [['--apply', '--dry-run'], ['--source='], ['--unknown'], ['--source=a', '--source=b']]) {
    assert.throws(() => monitorOptions(args));
  }
});

test('official source ids are unique, stable and use HTTPS', () => {
  assert.equal(new Set(QUOTA_TEXT_SOURCES.map((source) => source.id)).size, QUOTA_TEXT_SOURCES.length);
  assert.equal(QUOTA_TEXT_SOURCES.length, 18);
  for (const id of ['google-ai-ultra', 'worldlabs-api-pricing', 'decart-pricing', 'fal-cosmos-3', 'odyssey', 'runway-gwm']) {
    assert.ok(QUOTA_TEXT_SOURCES.some((source) => source.id === id));
  }
  for (const source of QUOTA_TEXT_SOURCES) assert.equal(new URL(source.url).protocol, 'https:');
});
