import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COPILOT_DEC_DEPRECATION_SOURCE, COPILOT_DEPRECATION_SOURCE, COPILOT_DEPRECATION_SOURCES,
  COPILOT_MODEL_DEPRECATIONS, COPILOT_NOV_DEPRECATION_SOURCE,
} from './copilot';

test('Copilot deprecations keep the mid-November list and add the 2026-12-14 models', () => {
  assert.equal(COPILOT_DEPRECATION_SOURCE, COPILOT_DEC_DEPRECATION_SOURCE);
  assert.deepEqual(COPILOT_DEPRECATION_SOURCES, [COPILOT_NOV_DEPRECATION_SOURCE, COPILOT_DEC_DEPRECATION_SOURCE]);
  const byDate = Object.fromEntries(
    ['2026-11-16', '2026-12-14'].map(date => [date, COPILOT_MODEL_DEPRECATIONS.filter(item => item.date === date)]),
  );
  assert.equal(byDate['2026-11-16'].length, 3);
  assert.deepEqual(byDate['2026-12-14'].map(item => [item.model, item.replacement, item.exceptAnnualIndividual]), [
    ['Claude Fable 5', 'Claude Fable 5.2', false],
    ['Claude Haiku 4.5', 'Claude Haiku 5.5', true],
    ['Gemini 3.8 Flash', 'Gemini 4 Hydrogen', false],
    ['Gemini 4 Argon', 'Gemini 4 Carbon', false],
    ['Grok 4.6', 'Grok 4.7', false],
    ['Kimi K3', 'To be announced', false],
  ]);
  assert.equal(byDate['2026-12-14'].every(item => item.source === COPILOT_DEC_DEPRECATION_SOURCE), true);
});
