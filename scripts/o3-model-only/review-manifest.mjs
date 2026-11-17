// Source identity only. Never reads journals, environment files, credentials or DBs.
// The coordinator attaches acceptance receipts after independent normal-Shell runs.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
const output = process.argv[2];
if (!output || !isAbsolute(output)) throw Error('Explicit absolute output JSON required');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const sha256 = data => createHash('sha256').update(data).digest('hex');
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]);
}
const paths = [...files('scripts/o3-model-only'), '.github/workflows/o3-native.yml',
  'docs/runbooks/o3-model-only.md', 'docs/runbooks/o3-model-only-sre-check.md', 'docs/runbooks/o3-model-only-sre-closure.md',
  'scripts/db/channel-write-target.ts', 'scripts/db/queries.ts', 'scripts/index-dynamic.ts',
  'scripts/scrapers/openrouter.ts', 'scripts/utils/validator.ts', 'src/lib/catalog-identity.ts'].sort();
const changedPaths = git('status', '--porcelain=v1', '--untracked-files=all');
const manifest = {
  format: 'o3-reviewed-head-v1', createdAt: new Date().toISOString(),
  headCommit: git('rev-parse', 'HEAD').trim(), headTree: git('rev-parse', 'HEAD^{tree}').trim(),
  candidateDirty: changedPaths.length > 0,
  trackedDiffSha256: sha256(execFileSync('git', ['diff', 'HEAD', '--binary'])),
  sourceFiles: paths.map(path => ({ path, sha256: sha256(readFileSync(path)) })),
  identityRule: 'HEAD tree plus tracked diff plus listed source hashes bind the uncommitted candidate; no candidate commit is fabricated',
  acceptance: 'PENDING_COORDINATOR_RECEIPTS_AND_INDEPENDENT_SRE_REVIEW', receipts: [],
  originalSreReportRead: true,
  originalSreReportReadBy: 'Codex same-session 12:35 SGT continuation; not initial authoring',
  originalSreReportSha256: 'ee97a3d700585d874f3ca8f6bbe62fc6f85d378a8572d7227396896860550666',
  historicalCascadeToolResultAvailable: false,
};
writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
