import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CLAUDE_TEAM_PRICES,
  GROK_CODE_FAST_SHUTDOWN,
  catalogSeedOptions,
  teamPriceNotes,
  withoutCodexMiniStaleNote,
} from './catalog-2026-10-19';

test('Claude Team seat prices are the 2026-10-19 verified monthly and annual amounts', () => {
  assert.deepEqual(
    [CLAUDE_TEAM_PRICES['claude-team'].price, CLAUDE_TEAM_PRICES['claude-team'].price_yearly_monthly, CLAUDE_TEAM_PRICES['claude-team'].annual_price],
    [25, 20, 240],
  );
  assert.deepEqual(
    [CLAUDE_TEAM_PRICES['claude-team-premium'].price, CLAUDE_TEAM_PRICES['claude-team-premium'].price_yearly_monthly, CLAUDE_TEAM_PRICES['claude-team-premium'].annual_price],
    [125, 100, 1200],
  );
});

test('team price notes keep the API credit line and the verified minimum and Claude Code sentences', () => {
  const notes = teamPriceNotes('Min 5 users. Does NOT include Claude Code.\n[api-credit] Includes $20/month Claude API credit per Standard seat.', 'claude-team');
  assert.match(notes, /^\[api-credit\]/);
  assert.match(notes, /\[team-price\]/);
  assert.match(notes, /Minimum 2 seats \(teams of 2 to 150\)/);
  assert.match(notes, /Includes Claude Code/);
  assert.match(notes, /https:\/\/claude\.com\/pricing/);
  assert.doesNotMatch(notes, /Min 5 users/);
  assert.doesNotMatch(notes, /Does NOT include Claude Code/);
  const premium = teamPriceNotes(null, 'claude-team-premium');
  assert.match(premium, /Minimum 2 seats \(teams of 2 to 150\)/);
  assert.match(premium, /Includes Claude Code/);
  assert.match(premium, /5x more usage than a Standard seat/);
  assert.equal(withoutCodexMiniStaleNote('kept\n[needs-verification] Codex Mini shutdown date is not established by the 2026-10-15 audit; verify official deprecations.'), 'kept');
});

test('grok-code-fast-1 records the retirement and the recommended-table replacement only', () => {
  assert.equal(GROK_CODE_FAST_SHUTDOWN.shutdown_date, '2026-05-15');
  assert.equal(GROK_CODE_FAST_SHUTDOWN.replacement_model, 'grok-build-0.1');
  assert.match(GROK_CODE_FAST_SHUTDOWN.deprecation_source_url, /may-15-retirement/);
});

test('catalog seed is dry-run by default and is not on the deploy path', () => {
  assert.deepEqual(catalogSeedOptions([]), { apply: false });
  assert.equal(catalogSeedOptions(['--apply']).apply, true);
  assert.throws(() => catalogSeedOptions(['--apply', '--dry-run']), /Usage/);
  for (const file of ['../../deploy/production/rollout.sh', '../../.github/workflows/deploy-production.yml']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /seed:catalog-2026-10-19|seed-catalog-2026-10-19/);
  }
});
