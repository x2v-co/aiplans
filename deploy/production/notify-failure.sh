#!/usr/bin/env bash
# Telegram alert for a failed planprice systemd unit. Wired through
# OnFailure= in planprice-scraper.service (see planprice-scraper-failure.service).
#
# Reuses the fleet Telegram bot credentials shared with
# brain/scripts/morning-brief.sh. Missing credentials degrade to journald
# logging instead of silently pretending the alert went out, but this script
# exits non-zero on a real send failure so the failure unit itself is visible
# in systemctl.
set -u

UNIT="${1:?usage: notify-failure.sh <systemd-unit>}"
ENV_FILE="${BRAIN_TG_ENV:-/home/ubuntu/.config/brain-tg-bot/env}"
HOST="$(hostname -s 2>/dev/null || hostname)"
LOG_LINES="${NOTIFY_LOG_LINES:-25}"

log_tail="$(journalctl -u "$UNIT" -n "$LOG_LINES" --no-pager -o cat 2>/dev/null || true)"
MSG="🚨 planprice: ${UNIT} failed on ${HOST}

${log_tail}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "notify-failure: $ENV_FILE not found; alert logged to journal only" >&2
  echo "$MSG" >&2
  exit 0
fi

# shellcheck disable=SC1090
. "$ENV_FILE"
if [[ -z "${BRAIN_TG_TOKEN:-}" || -z "${BRAIN_TG_CHAT_ID:-}" ]]; then
  echo "notify-failure: BRAIN_TG_TOKEN/BRAIN_TG_CHAT_ID unset in $ENV_FILE; alert logged to journal only" >&2
  echo "$MSG" >&2
  exit 0
fi

# Telegram hard-caps message length at 4096 characters.
PAYLOAD="$MSG"
if (( ${#PAYLOAD} > 3900 )); then
  PAYLOAD="${PAYLOAD:0:3700}

…(truncated — see journalctl -u $UNIT on $HOST)"
fi

response_file="$(mktemp)"
trap 'rm -f "$response_file"' EXIT
http_code="$(curl -sS -o "$response_file" -w '%{http_code}' --max-time 15 \
  -X POST "https://api.telegram.org/bot${BRAIN_TG_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${BRAIN_TG_CHAT_ID}" \
  --data-urlencode "text=$PAYLOAD" 2>>"$response_file")" || http_code=000

if [[ "$http_code" != "200" ]]; then
  echo "notify-failure: Telegram send failed (http=$http_code)" >&2
  cat "$response_file" >&2 || true
  exit 1
fi
