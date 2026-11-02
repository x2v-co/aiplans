#!/usr/bin/env bash
# Feishu-first alert for NEW data-audit findings. Takes the digest text on stdin
# or as $1. Wired from run-scrapers.sh after audit-alert reports fingerprints
# not seen before (dedup table audit_alert_state, migration 022).
#
# Delivery failures exit non-zero; run-scrapers.sh handles them without stopping scrapes.
set -euo pipefail

MSG="${1:-$(cat)}"
[[ -z "$MSG" ]] && exit 0

# Feishu is primary; the x2v Telegram bot is an optional fallback. Override config with
# AIPLANS_TG_ENV (FEISHU_ALERT_WEBHOOK_URL plus optional BRAIN_TG_*). BRAIN_TG_ENV is
# still honoured for older host configs; the personal brain bot is the last resort.
# Prod hosts keep the file under /root (mode 600); ubuntu path is a cheap fallback.
X2V_ENV_ROOT=/root/.config/x2v-alerts/env
X2V_ENV_UBUNTU=/home/ubuntu/.config/x2v-alerts/env
if [[ -n "${AIPLANS_TG_ENV:-}" ]]; then ENV_FILE="$AIPLANS_TG_ENV"
elif [[ -n "${BRAIN_TG_ENV:-}" ]]; then ENV_FILE="$BRAIN_TG_ENV"
elif [[ -f "$X2V_ENV_ROOT" ]]; then ENV_FILE="$X2V_ENV_ROOT"
elif [[ -f "$X2V_ENV_UBUNTU" ]]; then ENV_FILE="$X2V_ENV_UBUNTU"
else ENV_FILE=/home/ubuntu/.config/brain-tg-bot/env; fi
TAG="${AIPLANS_ALERT_TAG-[aiplans]}"
HOST="$(hostname -s 2>/dev/null || hostname)"

MSG="${TAG:+$TAG }📊 planprice data audit on ${HOST}

${MSG}"

# A directly configured channel also works without a host credential file.
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  . "$ENV_FILE"
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "audit-alert: python3 is required for JSON encoding/validation" >&2
  exit 1
fi

post_json() {
  # Suppress curl errors: they can include the credential-bearing URL.
  curl --silent --show-error --fail --max-time 15 --noproxy '*' \
    --request POST --header 'Content-Type: application/json' \
    --data-binary "$2" "$1" 2>/dev/null
}

valid_response() {
  python3 -c '
import json, sys
try:
    body = json.load(sys.stdin)
    value = body.get("code" if sys.argv[1] == "feishu" else "ok")
    valid = type(value) in (int, float) and value == 0 if sys.argv[1] == "feishu" else value is True
except (ValueError, AttributeError):
    valid = False
sys.exit(0 if valid else 1)
' "$1"
}

if [[ -n "${FEISHU_ALERT_WEBHOOK_URL:-}" ]]; then
  payload="$(printf '%s' "$MSG" | python3 -c 'import json, sys; print(json.dumps({"msg_type": "text", "content": {"text": sys.stdin.read()}}, ensure_ascii=False))')"
  if response="$(post_json "$FEISHU_ALERT_WEBHOOK_URL" "$payload")" &&
      printf '%s' "$response" | valid_response feishu; then
    exit 0
  fi
  echo "audit-alert: Feishu send failed; trying Telegram fallback if configured" >&2
fi

if [[ -n "${BRAIN_TG_TOKEN:-}" && -n "${BRAIN_TG_CHAT_ID:-}" ]]; then
  payload="$(printf '%s' "$MSG" | python3 -c 'import json, sys; print(json.dumps({"chat_id": sys.argv[1], "text": sys.stdin.read()[:3900], "disable_web_page_preview": True}, ensure_ascii=False))' "$BRAIN_TG_CHAT_ID")"
  if response="$(post_json "https://api.telegram.org/bot${BRAIN_TG_TOKEN}/sendMessage" "$payload")" &&
      printf '%s' "$response" | valid_response telegram; then
    exit 0
  fi
  echo "audit-alert: Telegram send failed" >&2
fi

echo "audit-alert: alert not delivered (no configured channel or all deliveries failed)" >&2
exit 1
