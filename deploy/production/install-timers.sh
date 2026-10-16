#!/usr/bin/env bash
# Install and (re)start planprice systemd timers, respecting operator pauses.
#
# Usage: install-timers.sh <unit-source-dir> <timer>...
#
# A timer is PAUSED, and is neither installed, enabled nor restarted, when:
#   - it is masked:      systemctl mask <timer>          (is-enabled = masked)
#   - or a marker exists: /etc/planprice/paused-timers/<timer>
# Installing over a masked unit would replace the /dev/null symlink and silently
# unmask it, so paused timers are skipped before `install` as well.
# Remove the pause with `systemctl unmask <timer>` / deleting the marker, then
# redeploy (or enable/start the timer by hand).
set -euo pipefail

SYSTEMCTL=${SYSTEMCTL:-systemctl}
UNIT_DIR=${UNIT_DIR:-/etc/systemd/system}
PAUSE_DIR=${PLANPRICE_PAUSE_DIR:-/etc/planprice/paused-timers}

src=${1:?unit source dir required}
shift

active=()
for timer in "$@"; do
  state=$($SYSTEMCTL is-enabled "$timer" 2>/dev/null || true)
  if [[ "$state" == masked || "$state" == masked-runtime ]]; then
    echo "⏸️  $timer is masked; skipping install/enable/restart (paused by operator)"
    continue
  fi
  if [[ -e "$PAUSE_DIR/$timer" ]]; then
    echo "⏸️  $timer has pause marker $PAUSE_DIR/$timer; skipping install/enable/restart${state:+ (current state: $state)}"
    continue
  fi
  install -m 0644 "$src/$timer" "$UNIT_DIR/$timer"
  active+=("$timer")
done

$SYSTEMCTL daemon-reload
if (( ${#active[@]} )); then
  $SYSTEMCTL enable "${active[@]}"
  $SYSTEMCTL restart "${active[@]}"
  echo "▶️  enabled/restarted: ${active[*]}"
else
  echo "⏸️  all requested timers are paused; nothing enabled"
fi
