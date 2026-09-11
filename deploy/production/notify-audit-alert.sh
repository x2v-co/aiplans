#!/usr/bin/env bash
# Telegram alert for NEW data-audit findings. Takes the digest text on stdin
# or as $1. Wired from run-scrapers.sh after audit-alert reports fingerprints
# not seen before (dedup table audit_alert_state, migration 022).
#
# Reuses the fleet Telegram bot credentials (same env as notify-failure.sh).
# Never fails the scrape chain: credential/send problems log and exit 0.
set -u

MSG="${1:-$(cat)}"
[[ -z "$MSG" ]] && exit 0

ENV_FILE="${BRAIN_TG_ENV:-/home/ubuntu/.config/brain-tg-bot/env}"
HOST="$(hostname -s 2>/dev/null || hostname)"

MSG="📊 planprice data audit on ${HOST}

${MSG}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "audit-alert: $ENV_FILE not found; digest logged only" >&2
  echo "$MSG" >&2
  exit 0
fi

# shellcheck disable=SC1090
. "$ENV_FILE"
if [[ -z "${BRAIN_TG_TOKEN:-}" || -z "${BRAIN_TG_CHAT_ID:-}" ]]; then
  echo "audit-alert: BRAIN_TG_TOKEN/BRAIN_TG_CHAT_ID unset; digest logged only" >&2
  exit 0
fi

PAYLOAD="$MSG"
if (( ${#PAYLOAD} > 3900 )); then
  PAYLOAD="${PAYLOAD:0}${PAYLOAD:0:3700}

…(truncated)"
fi

http_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 \
  -X POST "https://api.telegram.org/bot${BRAIN_TG_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${BRAIN_TG_CHAT_ID}" \
  --data-urlencode "text=$PAYLOAD" 2>/dev/null)" || http_code=000

if [[ "$http_code" != "200" ]]; then
  echo "audit-alert: Telegram send failed (http=$http_code)" >&2
fi
exit 0
