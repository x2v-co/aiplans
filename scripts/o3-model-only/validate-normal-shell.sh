#!/usr/bin/env bash
# Coordinator only. Does not provision PG or read any environment file.
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${O3_TEST_DATABASE_URL:?Set an explicit fresh synthetic database URL; no fallback}"
: "${O3_CLOSURE_TEST_DATABASE_URL:?Set a separate fresh synthetic closure database URL; no fallback}"
: "${O3_RACE_TEST_DATABASE_URL:?Set a separate fresh synthetic race database URL; no fallback}"
output_dir=$(mktemp -d /tmp/o3-clean-pr-validation.XXXXXXXX)
exec > >(tee "$output_dir/validation.log") 2>&1
printf 'Validation output: %s\n' "$output_dir"
# Strip possible production database settings before any application tests.
unset DATABASE_URL O3_DATABASE_URL ARGON_TEST_DATABASE_URL
node --import tsx -e 'require("./scripts/o3-model-only/guard.ts").requireO3TestUrl(process.env.O3_TEST_DATABASE_URL)'
node --import tsx -e 'const {requireO3TestUrl}=require("./scripts/o3-model-only/guard.ts"); const urls=["O3_TEST_DATABASE_URL","O3_CLOSURE_TEST_DATABASE_URL","O3_RACE_TEST_DATABASE_URL"].map(k=>requireO3TestUrl(process.env[k])); if(new Set(urls.map(u=>new URL(u).pathname)).size!==3) throw Error("Three distinct fresh databases required")'
node_modules/.bin/tsc --noEmit --incremental false
node_modules/.bin/tsc --noEmit -p scripts/tsconfig.quota.json
node_modules/.bin/tsc --noEmit -p scripts/o3-model-only/tsconfig.json
npm test
for test_file in scripts/o3-model-only/*.test.ts; do
  node --import tsx "$test_file"
done
git diff --check
timeout 240s node --import tsx scripts/o3-model-only/postgres.integration.ts
timeout 240s node --import tsx scripts/o3-model-only/concurrency.postgres.integration.ts
timeout 240s node --import tsx scripts/o3-model-only/sre-closure.postgres.integration.ts
