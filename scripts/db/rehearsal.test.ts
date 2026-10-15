import assert from 'node:assert/strict';
import test from 'node:test';
import { runRehearsable } from './rehearsal';

function fakeSql() {
  const log: string[] = [];
  return { log, begin: async (_iso: string, fn: (tx: string) => Promise<unknown>) => {
    log.push('BEGIN');
    try { await fn('tx'); log.push('COMMIT'); } catch (e) { log.push('ROLLBACK'); throw e; }
  } };
}

test('dry-run executes work then rolls back; apply commits; real errors propagate', async () => {
  const dry = fakeSql();
  assert.equal(await runRehearsable(dry, false, async () => 3), 3);
  assert.deepEqual(dry.log, ['BEGIN', 'ROLLBACK']);
  const live = fakeSql();
  await runRehearsable(live, true, async () => 1);
  assert.deepEqual(live.log, ['BEGIN', 'COMMIT']);
  await assert.rejects(runRehearsable(fakeSql(), false, async () => { throw new Error('violates check constraint'); }), /check constraint/);
});
