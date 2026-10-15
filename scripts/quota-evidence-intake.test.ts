import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { evidenceDatabase, insertStatement, intakeEvidence, loadEvidence, reviewEvidence, type EvidenceDatabase } from './quota-evidence-intake';
import { agreementSuggestions, ccusageDraft, evidenceHash, evidenceSchema, intakeOptions, monthlyRange, parseEvidence, planInsert, type Evidence } from './utils/quota-evidence';
import type { Sql } from 'postgres';

function claim(overrides: Record<string, unknown> = {}): Evidence {
  return evidenceSchema.parse({
    plan_slug: 'synthetic-plan', source_name: 'reddit', url: 'https://example.com/post/1',
    observed_at: '2026-10-14T12:00:00+00:00', captured_at: '2026-10-15',
    raw_value: 'Synthetic claim; not real quota data', confidence: 'low', ...overrides,
  });
}
function measurement(overrides: Record<string, unknown> = {}): Evidence {
  return claim({
    tokens: { input: 100000, cached_input: 0, output: 0 },
    quota_pct_before: 10, quota_pct_after: 20, window: 'weekly', usage_mix_id: 'synthetic-input-only',
    calculation: { list_prices: { input: 1, cached_input: 0.1, output: 5 }, mix: { cache_read_pct: 0, input_pct: 100, output_pct: 0 } },
    ...overrides,
  });
}
function fakeDatabase(known = false) {
  const writes: unknown[] = [], reads: string[] = [];
  const database: EvidenceDatabase = {
    async known(hash) { reads.push(hash); return known; },
    async insert(row) { writes.push(row); return 12; },
    async review(id, status) { writes.push({ id, status }); return true; },
  };
  return { database, writes, reads };
}

test('strict JSON/YAML format requires provenance, valid dates and coherent measurements', () => {
  const e = claim();
  assert.deepEqual(parseEvidence(JSON.stringify(e), 'a.json'), e);
  assert.equal(parseEvidence(`plan_slug: synthetic\nsource_name: self\nscreenshot_url: https://example.com/s.png\nobserved_at: 2026-10-14T12:00:00Z\ncaptured_at: 2026-10-15\nraw_value: synthetic only\nconfidence: low\n`, 'a.yaml').plan_slug, 'synthetic');
  for (const overrides of [
    { url: undefined }, { url: 'javascript:alert(1)' }, { observed_at: '2026-02-30T00:00:00Z' },
    { observed_at: '2026-10-16T00:00:00Z' }, { captured_at: '2026-02-30' }, { confidence: 'certain' },
    { typo: 1 }, { quota_pct_before: 10 }, { quota_pct_before: 50, quota_pct_after: 10 },
    { tokens: { input: -1, cached_input: 0, output: 0 } }, { tokens: { input: 2 ** 54, cached_input: 0, output: 0 } },
  ]) assert.throws(() => claim(overrides));
  assert.throws(() => measurement({ tokens: undefined }));
  assert.throws(() => measurement({ window: '5h' }));
  assert.throws(() => measurement({ calculation: { list_prices: { input: 1, cached_input: 1, output: 1 }, mix: { cache_read_pct: 0, input_pct: 50, output_pct: 1 } } }));
});

test('engine computes monthly range with explicit assumptions; community never auto high', () => {
  const range = monthlyRange(measurement())!;
  assert.ok(Math.abs(range.low / (4000000 / 1.1) - 1) < 1e-12);
  assert.ok(Math.abs(range.high / (4000000 / 0.9) - 1) < 1e-12);
  assert.equal(planInsert(claim({ confidence: 'high' })).confidence, 'low');
  assert.equal(planInsert(claim({ confidence: 'medium' })).confidence, 'low');
  assert.equal(planInsert(measurement({ confidence: 'high' })).confidence, 'medium');
  assert.equal(planInsert(measurement()).review_status, 'pending');
  assert.match(planInsert(measurement()).notes, /implied monthly tokens=.*low/);
  assert.match(planInsert(measurement()).notes, /list_prices/);
  const short = measurement({ window: 'daily', calculation: { ...measurement().calculation, windows_per_week: 3 } });
  assert.ok(Math.abs(monthlyRange(short)!.low / (range.low * 3) - 1) < 1e-12);
  assert.throws(() => monthlyRange(measurement({ quota_pct_before: 10, quota_pct_after: 11 })), /rounding uncertainty/);
});

test('stable observation hash ignores metadata and key order but distinguishes measurements/plans', () => {
  const e = measurement();
  assert.equal(evidenceHash(e), evidenceHash({ ...e, captured_at: '2026-10-16', notes: 'recaptured', confidence: 'high', observed_at: '2026-10-14T08:00:00-04:00' }));
  assert.equal(evidenceHash(e), evidenceHash(evidenceSchema.parse({ ...e, tokens: { output: 0, cached_input: 0, input: 100000 } })));
  for (const change of [{ plan_slug: 'other' }, { quota_pct_after: 22 }, { raw_value: 'different' }]) {
    assert.notEqual(evidenceHash(e), evidenceHash(measurement(change)));
  }
});

test('dry-run prints exact SQL/parameters without any database; optional dedupe is read-only', async () => {
  const e = claim({ raw_value: "quoted ' value $1" });
  const logs: string[] = [];
  await intakeEvidence([e], false, undefined, (line) => logs.push(line));
  const printed = JSON.parse(logs.find((line) => line.startsWith('DRY-RUN '))!.slice(8));
  assert.deepEqual(printed, insertStatement(planInsert(e)));
  assert.ok(printed.parameters.includes(e.raw_value));
  assert.ok(!printed.sql.includes(e.raw_value));
  assert.match(printed.sql, /ON CONFLICT \(content_hash\) DO NOTHING RETURNING id$/);
  const fake = fakeDatabase();
  await intakeEvidence([e, e], false, fake.database, () => {});
  assert.equal(fake.reads.length, 1);
  assert.equal(fake.writes.length, 0);
  const duplicate = fakeDatabase(true);
  const skipped: string[] = [];
  await intakeEvidence([e], true, duplicate.database, (line) => skipped.push(line));
  assert.equal(duplicate.writes.length, 0);
  assert.ok(skipped.some((line) => line.startsWith('SKIP duplicate')));
});

test('apply writes the printed insert once; invalid derivations fail before any write', async () => {
  const fake = fakeDatabase();
  const e = measurement();
  await intakeEvidence([e, e], true, fake.database, () => {});
  assert.deepEqual(fake.writes, [planInsert(e)]);
  await assert.rejects(intakeEvidence([e], true, undefined, () => {}), /DATABASE_URL/);
  const invalid = measurement({ quota_pct_before: 10, quota_pct_after: 11 });
  const empty = fakeDatabase();
  await assert.rejects(intakeEvidence([e, invalid], true, empty.database, () => {}), /rounding uncertainty/);
  assert.equal(empty.writes.length, 0);
});

test('database adapter enforces read-only dedupe and parameterized pending-only review', async () => {
  const calls: unknown[][] = [];
  const connection = Object.assign(async (strings: TemplateStringsArray, ...params: unknown[]) => {
    calls.push([strings.join('?'), ...params]); return [{ id: 1 }];
  }, {
    begin: async (mode: string, read: (sql: unknown) => Promise<unknown>) => { calls.push([mode]); return read(connection); },
    unsafe: async (query: string, params: unknown[]) => { calls.push([query, params]); return [{ id: 42 }]; },
  });
  const database = evidenceDatabase(connection as unknown as Sql);
  assert.equal(await database.known('hash'), true);
  assert.deepEqual(calls[0], ['read only']);
  assert.match(String(calls[1][0]), /^SELECT id/);
  assert.equal(await database.review(99, 'rejected'), true);
  assert.match(String(calls[2][0]), /reviewed_at = clock_timestamp\(\)/);
  assert.match(String(calls[2][0]), /review_status = 'pending'/);
  assert.deepEqual(calls[2].slice(1), ['rejected', 99]);
  const row = planInsert(claim());
  assert.equal(await database.insert(row), 42);
  const statement = insertStatement(row);
  assert.deepEqual(calls[3], [statement.sql, statement.parameters]);
});

test('review requires apply, a database and pending row, preserving confidence/estimates', async () => {
  const fake = fakeDatabase();
  await assert.rejects(reviewEvidence(1, 'accepted', false, fake.database), /requires --apply/);
  await assert.rejects(reviewEvidence(1, 'accepted', true), /DATABASE_URL/);
  assert.equal(fake.writes.length, 0);
  await reviewEvidence(1, 'accepted', true, fake.database);
  await reviewEvidence(2, 'rejected', true, fake.database);
  assert.deepEqual(fake.writes, [{ id: 1, status: 'accepted' }, { id: 2, status: 'rejected' }]);
  await assert.rejects(reviewEvidence(3, 'accepted', true, { ...fake.database, review: async () => false }), /missing or already reviewed/);
});

test('agreement needs distinct attested origins and comparable assumptions within 30%', () => {
  const a = measurement({ independent_source_id: 'original-a', author_handle: 'a' });
  const b = measurement({ independent_source_id: 'original-b', author_handle: 'b', url: 'https://example.com/post/2', tokens: { input: 129000, cached_input: 0, output: 0 } });
  assert.equal(agreementSuggestions([a, b]).length, 1);
  assert.equal(agreementSuggestions([a, { ...b, tokens: { input: 131000, cached_input: 0, output: 0 } }]).length, 0);
  for (const other of [{ ...b, independent_source_id: a.independent_source_id }, { ...b, author_handle: 'a' }, { ...b, independent_source_id: undefined }, { ...b, plan_slug: 'other' }, { ...b, window: 'monthly' as const }, { ...b, usage_mix_id: 'other' }]) {
    assert.equal(agreementSuggestions([a, other]).length, 0);
  }
  assert.equal(agreementSuggestions([a, { ...a, independent_source_id: 'false independence' }]).length, 0);
  assert.equal(planInsert(a).confidence, 'medium');
});

const daily = { date: '2026-10-14', inputTokens: 100, outputTokens: 20, cacheCreationTokens: 30, cacheReadTokens: 400, totalCost: 0.02, modelsUsed: ['synthetic-model'] };
test('ccusage maps exclusive token categories and retains cache writes/cost/models as raw evidence', () => {
  const draft = ccusageDraft({ daily: [daily], totals: {} }, { plan: 'synthetic', before: 10, after: 30 }, new Date('2026-10-15T00:00:00Z'));
  assert.deepEqual(draft.tokens, { input: 100, cached_input: 400, output: 20 });
  assert.deepEqual(JSON.parse(draft.raw_value), daily);
  assert.equal(draft.confidence, 'low');
  assert.match(draft.notes, /Cache creation tokens \(30\) are excluded/);
  assert.throws(() => evidenceSchema.parse(draft), /url or screenshot_url/);
  assert.equal(evidenceSchema.parse({ ...draft, url: 'https://example.com/export' }).source_name, 'ccusage');
  const multiple = { daily: [daily, { ...daily, date: '2026-10-13' }] };
  assert.throws(() => ccusageDraft(multiple, { plan: 'p', before: 0, after: 10 }), /exactly one/);
  assert.equal(ccusageDraft(multiple, { plan: 'p', before: 0, after: 10, date: '2026-10-13' }).observed_at.slice(0, 10), '2026-10-13');
  assert.throws(() => ccusageDraft({ daily: [{ ...daily, inputTokens: -1 }] }, { plan: 'p', before: 0, after: 10 }));
  assert.throws(() => ccusageDraft({ daily: [daily] }, { plan: 'p', before: 100, after: 10 }));
});

test('CLI rejects ambiguous write modes and invalid arguments', () => {
  assert.equal(intakeOptions([]).apply, false);
  assert.equal(intakeOptions(['--dry-run']).apply, false);
  assert.deepEqual(intakeOptions(['--apply', '--review', '12', 'accept']).review, { id: 12, status: 'accepted' });
  assert.deepEqual(intakeOptions(['--review', '12', 'reject', '--apply']).review, { id: 12, status: 'rejected' });
  for (const args of [['--apply', '--dry-run'], ['--review', '12', 'accept'], ['--review', '0', 'accept', '--apply'], ['--apply', '--review', '12', 'promote'], ['--unknown'], ['--plan', 'a'], ['--from-ccusage', 'file'], ['--from-ccusage', 'file', '--plan', 'p', '--pct-before', '10', '--pct-after', '20', '--apply'], ['--apply', '--review', '12', 'accept', 'a.json']]) assert.throws(() => intakeOptions(args));
});

test('file discovery excludes .sample; actual CLI dry-run/import run offline', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'quota-evidence-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'example.json.sample'), 'not loaded');
  assert.deepEqual(await loadEvidence([], directory), []);
  const file = join(directory, 'evidence.json');
  await writeFile(file, JSON.stringify(claim()));
  assert.equal((await loadEvidence([], directory)).length, 1);
  const env = { ...process.env };
  delete env.DATABASE_URL;
  const cli = (args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', resolve('scripts/quota-evidence-intake.ts'), ...args], { env, encoding: 'utf8', timeout: 20000 });
  const preview = cli([file]);
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /DRY-RUN .*INSERT INTO quota_evidence/);
  const exportFile = join(directory, 'ccusage.json');
  const output = join(directory, 'draft.json');
  await writeFile(exportFile, JSON.stringify({ daily: [daily] }));
  const args = ['--from-ccusage', exportFile, '--plan', 'synthetic', '--pct-before', '10', '--pct-after', '30', '--output', output];
  const imported = cli(args);
  assert.equal(imported.status, 0, imported.stderr);
  assert.equal(JSON.parse(await readFile(output, 'utf8')).tokens.cached_input, 400);
  assert.equal(cli(args).status, 1, 'must not overwrite a draft');
});
