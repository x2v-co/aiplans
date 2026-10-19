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
"${compose[@]}" run --rm scraper npm run refresh:fx
fx_status=$?
if [[ "${SKIP_API:-0}" == "1" ]]; then
  echo "SKIP_API=1 — skipping API price scrapers"
  api_status=0
else
  "${compose[@]}" run --rm scraper npm run scrape
  api_status=$?
fi

# Models past shutdown_date (UTC) lose their live channels even when the API
# scrape is skipped or crashed before its own sweep. One way: true → false + lock.
"${compose[@]}" run --rm scraper npm run seed:shutdown-availability -- --apply
shutdown_status=$?

if [[ "${SKIP_PLANS:-0}" == "1" ]]; then
  echo "SKIP_PLANS=1 — skipping plan scrapers"
  plans_status=0
else
  "${compose[@]}" run --rm scraper npm run scrape:plans
  plans_status=$?
fi
set -e

set +e
# Production writes to plans.model_selector / model_plan_mapping are manual-only
# (SRE, after user approval). Timers and deploys run read-only previews by
# default; set PLAN_MAPPINGS_APPLY=1 only for an explicitly approved run.
# 2026-10-15 17:15 SGT: the API-scraper timer applied an unreviewed selector set.
if [[ "${SKIP_PLAN_MAPPINGS:-0}" == "1" ]]; then
  echo "SKIP_PLAN_MAPPINGS=1 — skipping plan kind backfill and model↔plan materialization"
  kinds_status=0
  mappings_status=0
elif [[ "${PLAN_MAPPINGS_APPLY:-0}" == "1" ]]; then
  echo "PLAN_MAPPINGS_APPLY=1 — applying plan kinds and model↔plan mappings (approved manual run)"
  "${compose[@]}" run --rm scraper npm run fix:kinds
  kinds_status=$?
  "${compose[@]}" run --rm scraper npm run mappings:materialize:apply
  mappings_status=$?
else
  echo "Plan kinds / mappings: dry-run only (set PLAN_MAPPINGS_APPLY=1 for an approved apply)"
  "${compose[@]}" run --rm scraper npm run fix:kinds:dry-run
  kinds_status=$?
  "${compose[@]}" run --rm scraper npm run mappings:materialize:dry-run
  mappings_status=$?
fi

if [[ "${SKIP_AUDIT:-0}" == "1" ]]; then
  echo "SKIP_AUDIT=1 — skipping data audit and audit alerts"
  audit_status=0
else
  "${compose[@]}" run --rm scraper npm run audit
  audit_status=$?

  # Alert on NEW critical / models.dev-reference findings. Runs after the audit
  # so audit_alert_state is current; dedup means a recurring finding never spams.
  # A second audit:json run costs ~seconds and keeps the exit-code run above.
  alert_text="$("${compose[@]}" run --rm -e AUDIT_ALERT_APPLY=1 scraper sh -c 'npm run audit:json --silent 2>/dev/null | npm run audit:alert --silent 2>/dev/null')"
  echo "$alert_text"
  if [[ "$alert_text" == *"NEW finding"* ]]; then
    printf '%s\n' "$alert_text" | "${script_dir}/notify-audit-alert.sh" || true
  fi
fi

if [[ "${SKIP_ARENA:-0}" == "1" ]]; then
  echo "SKIP_ARENA=1 — skipping Arena leaderboard ingestion"
  arena_status=0
else
  "${compose[@]}" run --rm scraper npm run ingest:arena
  arena_status=$?
fi

if [[ "${SKIP_BENCHMARKS:-0}" == "1" ]]; then
  echo "SKIP_BENCHMARKS=1 — skipping task benchmark ingestion"
  benchmarks_status=0
else
  "${compose[@]}" run --rm scraper npm run ingest:benchmarks
  benchmarks_status=$?
fi

if [[ "${SKIP_CODING_AGENTS:-0}" == "1" ]]; then
  echo "SKIP_CODING_AGENTS=1 — skipping coding agent leaderboard ingestion"
  coding_agents_status=0
else
  "${compose[@]}" run --rm scraper npm run ingest:coding-agents
  coding_agents_status=$?
fi
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

if [[ "$shutdown_status" != "0" ]]; then
  echo "Warning: past-shutdown channel sweep failed ($shutdown_status); index-dynamic's own sweep still applies when the API scrape runs." >&2
fi

if [[ "$fx_status" != "0" ]]; then
  echo "Exchange-rate refresh failed ($fx_status); the previous FX snapshot remains active." >&2
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

# Publish a new immutable v1 catalog only after the data and derived mappings
# completed successfully. A failed scraper or FX refresh must leave the last
# known-good catalog addressable rather than replacing it with a partial view.
if [[ "$api_status" == "0" && "$plans_status" == "0" && "$fx_status" == "0" ]]; then
  "${compose[@]}" run --rm scraper npm run publish:v1
else
  echo "Skipping v1 catalog publication: api=$api_status plans=$plans_status fx=$fx_status" >&2
fi

if [[ "$arena_status" != "0" ]]; then
  echo "Warning: Arena leaderboard update failed; keeping the previous ranking snapshot." >&2
fi

if [[ "$benchmarks_status" != "0" ]]; then
  echo "Warning: task benchmark update failed; keeping the previous benchmark snapshot." >&2
fi

if [[ "$coding_agents_status" != "0" ]]; then
  echo "Warning: coding agent leaderboard update failed; keeping the previous snapshot." >&2
fi
