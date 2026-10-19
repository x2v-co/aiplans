#!/usr/bin/env bash
# Manual catalog write. App rollout does not call this script.
# Default is dry-run. --apply writes only after diff.txt and a pg_dump backup
# exist in the record directory.
set -euo pipefail

usage() {
  cat <<'EOF'
用法: deploy/production/seed-catalog.sh [--apply] [--slug a,b] [--sync-availability]

默认只跑 dry-run，把逐字段 diff 写进记录目录，不写数据库。
--apply 会先做 pg_dump 备份，再写入。没有 diff.txt 和非空 backup.dump 不会写。
有 --slug 时只跑 vertical models 与 pricing。logo、已核实创作套餐、benchmark
不能按 slug 缩小，这次会跳过。
--sync-availability 才会改已有行的 is_available。

记录目录: ${LOCK_PATH:-仓库根}/snapshots/seed-catalog/<UTC 时间>/
  meta.txt diff.txt，以及 apply 时的 backup.dump backup.sha256 apply.txt audit.txt
EOF
}

APPLY=0
SLUGS=""
SYNC=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --apply) APPLY=1 ;;
    --slug)
      [[ $# -ge 2 ]] || { echo "missing value for --slug" >&2; exit 2; }
      [[ -z "$SLUGS" ]] || { echo "pass one --slug a,b list" >&2; exit 2; }
      SLUGS="$2"
      shift
      ;;
    --slug=*)
      [[ -z "$SLUGS" ]] || { echo "pass one --slug a,b list" >&2; exit 2; }
      SLUGS="${1#--slug=}"
      ;;
    --sync-availability) SYNC=1 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

if [[ -n "$SLUGS" && ! "$SLUGS" =~ ^[a-z0-9][a-z0-9._-]*(,[a-z0-9][a-z0-9._-]*)*$ ]]; then
  echo "invalid --slug (use lowercase catalog slugs, comma-separated): $SLUGS" >&2
  exit 2
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
compose_file="${COMPOSE_FILE:-$script_dir/compose.yml}"
env_file="${ENV_FILE:-$script_dir/.env.production}"
project_name="${COMPOSE_PROJECT_NAME:-planprice-production}"
lock_path="${LOCK_PATH:-$(cd -- "$script_dir/../.." && pwd)}"
record_root="${SEED_RECORD_DIR:-$lock_path/snapshots/seed-catalog}"
docker_cmd=(${DOCKER_CMD:-docker})

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file." >&2
  exit 2
fi
if [[ ! -f "$compose_file" ]]; then
  echo "Missing $compose_file." >&2
  exit 2
fi
if [[ ! -d "$lock_path" ]]; then
  echo "Missing lock path: $lock_path" >&2
  exit 2
fi

export APP_ENV_FILE="$env_file"
compose=("${docker_cmd[@]}" compose -p "$project_name" -f "$compose_file" --env-file "$env_file")

exec 9<"$lock_path"
if ! flock -w 1800 9; then
  echo "timed out waiting for lock: $lock_path" >&2
  exit 1
fi

umask 027
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
record="$record_root/$stamp"
if [[ -e "$record" ]]; then
  record="${record}-$$"
fi
mkdir -p "$record"

mode="dry-run"
if [[ "$APPLY" == 1 ]]; then
  mode="apply"
fi

cat > "$record/meta.txt" <<EOF
at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
mode: $mode
slugs: ${SLUGS:-<full catalog>}
sync_availability: $SYNC
git_sha: ${GITHUB_SHA:-unknown}
run_id: ${GITHUB_RUN_ID:-local}
EOF

finish() {
  local rc=$?
  if [[ -n "${record:-}" && -d "$record" ]]; then
    echo "$rc" > "$record/exit_code.txt"
    if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
      {
        echo "## Catalog seed ($mode)"
        echo
        echo "- record: \`$record\`"
        echo "- exit: $rc"
        echo "- diff: \`$record/diff.txt\`"
        if [[ "$APPLY" == 1 ]]; then
          echo "- backup: \`$record/backup.dump\`"
        fi
      } >> "$GITHUB_STEP_SUMMARY" || true
    fi
  fi
}
trap finish EXIT

extra=()
if [[ -n "$SLUGS" ]]; then
  extra+=(--slug "$SLUGS")
fi
if [[ "$SYNC" == 1 ]]; then
  extra+=(--sync-availability)
fi

run_scraper() {
  "${compose[@]}" run --rm --no-deps scraper "$@"
}

echo "catalog seed record: $record ($mode)"

# --- dry-run (always; captured to diff.txt) ---
set -o pipefail
{
  echo "# dry-run $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "# slugs: ${SLUGS:-<full catalog>}"
  echo "# sync_availability: $SYNC"
  echo "=== seed:vertical-models dry-run ==="
  run_scraper npm run seed:vertical-models -- "${extra[@]}"
  if [[ -z "$SLUGS" ]]; then
    echo "=== seed:vertical-logos dry-run ==="
    run_scraper npm run seed:vertical-logos:dry-run
  else
    echo "slug set; skip logos (cannot narrow that seed)"
  fi
  echo "=== seed:vertical-pricing dry-run ==="
  run_scraper npm run seed:vertical-pricing -- "${extra[@]}"
  if [[ -z "$SLUGS" ]]; then
    echo "=== seed:verified-creative-plans dry-run ==="
    run_scraper npm run seed:verified-creative-plans:dry-run
    echo "=== seed:vertical-benchmarks dry-run ==="
    run_scraper npm run seed:vertical-benchmarks:dry-run
  else
    echo "slug set; skip verified creative plans and benchmarks (cannot narrow those seeds)"
  fi
  echo "=== seed:shutdown-availability dry-run ==="
  run_scraper npm run seed:shutdown-availability
} | tee "$record/diff.txt"

test -s "$record/diff.txt"

if [[ "$APPLY" != 1 ]]; then
  echo "dry-run only. diff: $record/diff.txt"
  echo "re-run with the apply flag after that diff is approved. no rows written."
  exit 0
fi

# --- backup (apply only; must succeed before any write) ---
echo "backup: $record/backup.dump"
set +e
"${compose[@]}" exec -T postgres \
  sh -c 'pg_dump --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --format=custom --data-only --no-owner --no-acl \
    --table=providers --table=models --table=plans --table=model_plan_mapping --table=usage_prices \
    --table=benchmarks --table=benchmark_versions --table=benchmark_tasks --table=benchmark_metrics \
    --table=model_benchmark_scores --table=api_channel_prices --table=api_channel_price_variants' \
  > "$record/backup.dump"
dump_status=$?
set -e
if [[ "$dump_status" != 0 ]]; then
  echo "backup failed ($dump_status); no rows written. see $record" >&2
  exit "$dump_status"
fi
test -s "$record/backup.dump"
sig="$(head -c 5 "$record/backup.dump")"
if [[ "$sig" != "PGDMP" ]]; then
  echo "backup is not a pg_dump custom archive; no rows written." >&2
  exit 1
fi
sha256sum "$record/backup.dump" > "$record/backup.sha256"
echo "backup sha256: $(cat "$record/backup.sha256")"

test -s "$record/diff.txt"
test -s "$record/backup.dump"
test -s "$record/backup.sha256"

# --- apply (only after diff.txt and backup.dump) ---
set -o pipefail
{
  echo "# apply $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "# backup: $record/backup.dump"
  echo "=== seed:vertical-models apply ==="
  run_scraper npm run seed:vertical-models -- --apply "${extra[@]}"
  if [[ -z "$SLUGS" ]]; then
    echo "=== seed:vertical-logos apply ==="
    run_scraper npm run seed:vertical-logos -- --apply
  else
    echo "slug set; skip logos"
  fi
  echo "=== seed:vertical-pricing apply ==="
  run_scraper npm run seed:vertical-pricing -- --apply "${extra[@]}"
  if [[ -z "$SLUGS" ]]; then
    echo "=== seed:verified-creative-plans apply ==="
    run_scraper npm run seed:verified-creative-plans -- --apply
    echo "=== seed:vertical-benchmarks apply ==="
    run_scraper npm run seed:vertical-benchmarks -- --apply
  else
    echo "slug set; skip verified creative plans and benchmarks"
  fi
  # One way (true → false + lock) for channels of models past shutdown_date (UTC).
  echo "=== seed:shutdown-availability apply ==="
  run_scraper npm run seed:shutdown-availability -- --apply
  echo "=== audit:verticals:db ==="
  run_scraper npm run audit:verticals:db
  echo "=== audit:shutdown-availability ==="
  run_scraper npm run audit:shutdown-availability
} | tee "$record/apply.txt"

echo "apply finished. record: $record"
