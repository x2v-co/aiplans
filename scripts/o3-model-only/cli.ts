import { pathToFileURL } from 'node:url';
import { O3Executor, bootstrapO3 } from './adapter';
import { MODES, invariant, type Mode } from './exact';
/** Explicit connection, no dotenv, credentials files, application singleton or URL fallback.
 * Operator is responsible for approval/environment. Test driver has its own stricter guard. */
export async function main(args = process.argv.slice(2)) {
  const [mode, journalDirectory, expectedDigest, ...extra] = args;
  invariant(!extra.length && [...MODES,'bootstrap','resume'].includes(mode as Mode),
    'Usage: cli.ts preview|bootstrap OR freeze|rehearse|apply|repeat0|restore-rehearse|restore|resume ABS_JOURNAL_DIR EXPECTED_DIGEST; explicit O3_DATABASE_URL required');
  invariant(process.env.O3_DATABASE_URL, 'Explicit O3_DATABASE_URL required; no fallback');
  if (mode !== 'preview' && mode !== 'bootstrap') invariant(journalDirectory && expectedDigest, 'Explicit journal directory and approval digest required');
  else invariant(!journalDirectory && !expectedDigest, 'preview/bootstrap take no journal arguments');
  const { default: postgres } = await import('postgres');
  const sql = postgres(process.env.O3_DATABASE_URL, { max: 1, prepare: false, connect_timeout: 5 });
  try {
    const a = new O3Executor(sql, journalDirectory);
    const report = mode === 'bootstrap' ? (await bootstrapO3(sql), { status: 'BOOTSTRAPPED' })
      : mode === 'preview' ? await a.preview()
      : mode === 'freeze' ? await a.freeze(expectedDigest)
      : mode === 'resume' ? await a.resume(expectedDigest)
      : mode === 'rehearse' ? await a.rehearse(expectedDigest)
      : mode === 'apply' ? await a.apply(expectedDigest)
      : mode === 'repeat0' ? await a.repeat0(expectedDigest)
      : mode === 'restore-rehearse' ? await a.restoreRehearse(expectedDigest) : await a.restore(expectedDigest);
    console.log(JSON.stringify(report,null,2));
  } finally { await sql.end({ timeout: 5 }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error && typeof error === 'object' && 'severity' in error
    ? 'Database operation failed; SQLSTATE ' + String(error.code) : (error as Error).message); process.exitCode=1; });
}
