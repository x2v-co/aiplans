// Enumerate explicitly so nested tests are included on shells without globstar.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
function tests(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? (entry.name === '_archive' ? [] : tests(path))
      : /\.test\.(ts|mjs)$/.test(entry.name) ? [path] : [];
  });
}
// The integration test remains opt-in and is never part of this DB-free unit command.
const testEnv = { ...process.env, NODE_ENV: 'production' };
delete testEnv.ARGON_TEST_DATABASE_URL;
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...tests('src'), ...tests('scripts')], { stdio: 'inherit', env: testEnv });
process.exitCode = result.status ?? 1;
