#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
compose_file="${COMPOSE_FILE:-$script_dir/compose.yml}"
env_file="${ENV_FILE:-$script_dir/.env.production}"
project_name="${COMPOSE_PROJECT_NAME:-planprice-production}"
lock_file="${LOCK_FILE:-/tmp/x2v-planprice.lock}"
docker_cmd=(${DOCKER_CMD:-docker})

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file." >&2
  exit 2
fi

export APP_ENV_FILE="$env_file"
compose=("${docker_cmd[@]}" compose -p "$project_name" -f "$compose_file" --env-file "$env_file")

exec 9>"$lock_file"
if ! flock -n 9; then
  echo "Another planprice operation is active; skipping this scraper run."
  exit 0
fi

set +e
"${compose[@]}" run --rm scraper npm run scrape
api_status=$?
"${compose[@]}" run --rm scraper npm run scrape:plans
plans_status=$?
set -e

set +e
"${compose[@]}" run --rm scraper npm run audit
audit_status=$?
"${compose[@]}" run --rm scraper npm run ingest:arena
arena_status=$?
set -e

# audit-data uses 2 for warnings-only; only critical findings or an execution
# failure should fail the scheduled job.
if [[ "$audit_status" != "0" && "$audit_status" != "2" ]]; then
  exit "$audit_status"
fi

if [[ "$api_status" != "0" || "$plans_status" != "0" ]]; then
  echo "Scraper group failure: api=$api_status plans=$plans_status" >&2
  exit 1
fi

if [[ "$arena_status" != "0" ]]; then
  echo "Warning: Arena leaderboard update failed; keeping the previous ranking snapshot." >&2
fi
