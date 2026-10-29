import assert from 'node:assert/strict';
import test from 'node:test';
import { runScraperCli, scraperExitCode } from './cli-exit';

test('scraperExitCode is non-zero for success:false, zero prices or no result', () => {
  assert.equal(scraperExitCode({ success: true, prices: [{}] }), 0);
  assert.equal(scraperExitCode({ success: false, prices: [{}] }), 1);
  assert.equal(scraperExitCode({ success: true, prices: [] }), 1);
  assert.equal(scraperExitCode({ success: true }), 1);
  assert.equal(scraperExitCode(undefined), 1);
});

async function exitCodeOf(scrape: () => Promise<{ success: boolean; prices?: unknown[] }>) {
  const saved = process.exitCode;
  const reported: unknown[] = [];
  try {
    process.exitCode = undefined;
    await runScraperCli(scrape, result => reported.push(result));
    return { code: process.exitCode, reported };
  } finally {
    process.exitCode = saved;
  }
}

test('runScraperCli sets process.exitCode = 1 on failure and leaves 0 on success', async () => {
  assert.equal((await exitCodeOf(async () => ({ success: true, prices: [1] }))).code, 0);
  const failed = await exitCodeOf(async () => ({ success: false, prices: [] }));
  assert.equal(failed.code, 1);
  assert.equal(failed.reported.length, 1, 'result is still printed on failure');
  assert.equal((await exitCodeOf(async () => ({ success: true, prices: [] }))).code, 1);
  const origError = console.error;
  console.error = () => {};
  try {
    assert.equal((await exitCodeOf(async () => { throw new Error('boom'); })).code, 1);
  } finally {
    console.error = origError;
  }
});
