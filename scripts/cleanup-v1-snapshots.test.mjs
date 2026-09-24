import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const script = new URL('./cleanup-v1-snapshots.mjs', import.meta.url);

test('retains the 90-day boundary and removes older immutable snapshots', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'planprice-retention-'));
  try {
    await writeFile(join(directory, 'cat_older.json'), JSON.stringify({ generatedAt: '2026-06-25T00:00:00.000Z' }));
    await writeFile(join(directory, 'cat_boundary.json'), JSON.stringify({ generatedAt: '2026-06-26T00:00:00.000Z' }));
    await writeFile(join(directory, 'cat_newer.json'), JSON.stringify({ generatedAt: '2026-06-27T00:00:00.000Z' }));
    await writeFile(join(directory, 'current.json'), '{}');
    const { stdout } = await exec(process.execPath, [script.pathname], {
      env: { ...process.env, PLANPRICE_V1_SNAPSHOT_DIR: directory, PLANPRICE_SNAPSHOT_NOW: '2026-09-24T00:00:00.000Z', PLANPRICE_SNAPSHOT_RETENTION_DAYS: '90' },
    });
    const result = JSON.parse(stdout.slice(stdout.lastIndexOf('{')));
    assert.equal(result.removed, 1);
    assert.equal(result.retained, 2);
    await assert.rejects(readFile(join(directory, 'cat_older.json')));
    await assert.doesNotReject(readFile(join(directory, 'cat_boundary.json')));
    await assert.doesNotReject(readFile(join(directory, 'cat_newer.json')));
    await assert.doesNotReject(readFile(join(directory, 'current.json')));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
