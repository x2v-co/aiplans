#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
compose_file="${COMPOSE_FILE:-$script_dir/compose.yml}"
env_file="${ENV_FILE:-$script_dir/.env.production}"
project_name="${COMPOSE_PROJECT_NAME:-planprice-production}"
lock_path="${LOCK_PATH:-$(cd -- "$script_dir/../.." && pwd)}"
docker_cmd=(${DOCKER_CMD:-docker})

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file." >&2
  exit 2
fi

export APP_ENV_FILE="$env_file"
compose=("${docker_cmd[@]}" compose -p "$project_name" -f "$compose_file" --env-file "$env_file")

# Lock the stable project directory read-only. This lets the root-owned timer
# and the ubuntu-owned GitHub runner share one lock without /tmp ownership
# conflicts, including after a reboot.
exec 9<"$lock_path"
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
# Backfill plan_kind / plan_line / tier_rank / model_selector from the curated
# classifications. Must precede the materializer, which derives links from
# plans.model_selector -- a freshly-scraped plan has none until this runs.
"${compose[@]}" run --rm scraper npm run fix:kinds
kinds_status=$?
# Re-derive model↔plan links from each plan's model_selector. Runs after the
# plan scrapers so newly-scraped models and plans get linked, and before the
# audit so plans.no_model_mapping reflects this run.
"${compose[@]}" run --rm scraper npm run mappings:materialize
mappings_status=$?
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

# A plan whose slug is not in plan-classifications.ts simply gets no kind; the
# audit's plans.missing_kind check reports that. A non-zero exit means the
# backfill itself broke, which leaves the materializer working from stale
# selectors.
if [[ "$kinds_status" != "0" ]]; then
  echo "Warning: plan kind backfill failed ($kinds_status); selectors are unchanged from the last good run." >&2
fi

# The materializer refuses to run when a selector would wipe a plan's models,
# leaving the previous mappings in place. That needs a human, not a retry.
if [[ "$mappings_status" != "0" ]]; then
  echo "model_plan_mapping materialization failed ($mappings_status); links are unchanged from the last good run." >&2
  exit 1
fi

if [[ "$arena_status" != "0" ]]; then
  echo "Warning: Arena leaderboard update failed; keeping the previous ranking snapshot." >&2
fi
