import assert from 'node:assert/strict';
import test from 'node:test';
import { parseModelShutdowns, parseDeprecationsHtml } from './openai-deprecation-sync';

test('API optional fields are additive; absent and malformed dates never clear DB notices', () => {
  const rows = parseModelShutdowns({data: [{id:'gpt-5.1',shutdown_date:'2027-04-01'}, {id:'active'},
    {id:'invalid',shutdown_date:'2026-02-30'}, {id:'unknown',shutdown_date:null}, null, 'invalid']});
  assert.deepEqual(rows, [{ids:['gpt-5.1'], shutdownDate:'2027-04-01'}]);
  assert.throws(() => parseModelShutdowns({error:'bad'}), /data array/);
});

test('HTML parser reads shutdown/model columns only; ignores replacements and prose', () => {
  assert.deepEqual(parseDeprecationsHtml('<p>gpt-5.1-codex-mini</p><table><tr><th>Shutdown date</th><th>Model</th><th>Replacement</th></tr><tr><td>2026-07-23</td><td><code>gpt-5-codex</code>, <code>gpt-5.1-codex</code></td><td>gpt-5.3-codex</td></tr></table>'), [
    {ids:['gpt-5-codex','gpt-5.1-codex'], shutdownDate:'2026-07-23'},
  ]);
  assert.deepEqual(parseDeprecationsHtml('Layout changed'), []);
  assert.deepEqual(parseDeprecationsHtml('<table><tr><th>Shutdown date</th><th>Model</th></tr><tr><td>2026-02-30</td><td>gpt-5.1</td></tr></table>'), []);
});
