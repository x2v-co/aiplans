import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync, existsSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const script = new URL('../deploy/production/install-timers.sh', import.meta.url).pathname;

function run(setup: (dirs: { unit: string; pause: string }) => void) {
  const root = mkdtempSync(join(tmpdir(), 'timers-'));
  const src = join(root, 'src'); const unit = join(root, 'unit'); const pause = join(root, 'pause');
  for (const d of [src, unit, pause]) mkdirSync(d);
  for (const t of ['a.timer', 'b.timer', 'c.timer']) writeFileSync(join(src, t), `[Timer]\n# ${t}\n`);
  const log = join(root, 'log');
  const fake = join(root, 'systemctl');
  // is-enabled reports "masked" when the unit file is a symlink to /dev/null.
  writeFileSync(fake, `#!/usr/bin/env bash\necho "$*" >> ${log}\nif [[ $1 == is-enabled ]]; then [[ -L ${unit}/$2 ]] && { echo masked; exit 1; }; [[ -e ${unit}/$2 ]] && echo enabled || { echo disabled; exit 1; }; fi\n`);
  chmodSync(fake, 0o755);
  setup({ unit, pause });
  const r = spawnSync('bash', [script, src, 'a.timer', 'b.timer', 'c.timer'], {
    env: { ...process.env, SYSTEMCTL: fake, UNIT_DIR: unit, PLANPRICE_PAUSE_DIR: pause }, encoding: 'utf8' });
  return { r, unit, calls: existsSync(log) ? readFileSync(log, 'utf8') : '' };
}

test('masked and marker-paused timers are not installed, enabled or restarted', () => {
  const { r, unit, calls } = run(({ unit, pause }) => {
    symlinkSync('/dev/null', join(unit, 'b.timer'));
    writeFileSync(join(pause, 'c.timer'), 'paused 2026-10-15 by boss\n');
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /b\.timer is masked; skipping/);
  assert.match(r.stdout, /c\.timer has pause marker/);
  assert.match(calls, /^enable a\.timer$/m);
  assert.match(calls, /^restart a\.timer$/m);
  assert.doesNotMatch(calls, /^(enable|restart) .*[bc]\.timer/m);
  assert.ok(lstatSync(join(unit, 'b.timer')).isSymbolicLink(), 'mask symlink must survive');
  assert.equal(existsSync(join(unit, 'c.timer')), false);
});

test('with nothing paused all timers are installed and restarted', () => {
  const { r, calls } = run(() => {});
  assert.equal(r.status, 0, r.stderr);
  assert.match(calls, /^restart a\.timer b\.timer c\.timer$/m);
});

test('deploy workflow and rollout go through install-timers.sh', () => {
  const wf = readFileSync(new URL('../.github/workflows/deploy-production.yml', import.meta.url), 'utf8');
  const ro = readFileSync(new URL('../deploy/production/rollout.sh', import.meta.url), 'utf8');
  assert.doesNotMatch(wf, /systemctl (enable|restart) planprice-/);
  assert.match(wf, /systemctl is-enabled "\$timer"/);
  assert.match(wf, /\/etc\/planprice\/paused-timers\/\$timer/);
  assert.match(wf, /systemctl restart "\$\{active_timers\[@\]\}"/);
  assert.doesNotMatch(ro, /systemctl (enable|restart) /);
  assert.match(ro, /install-timers\.sh/);
});
