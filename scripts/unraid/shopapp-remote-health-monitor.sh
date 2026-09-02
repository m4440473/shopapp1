#!/bin/bash
set -euo pipefail

health_uri='http://192.168.254.72/api/health'
status_root='/mnt/user/projects/Backups/ShopApp/monitoring'
status_file="$status_root/webserver-status.json"
log_file="$status_root/webserver-monitor.log"
lock_file='/var/run/shopapp-remote-health-monitor.lock'

mkdir -p "$status_root"
chown nobody:users "$status_root"
chmod 0770 "$status_root"

exec 9>"$lock_file"
if ! flock -n 9; then
  exit 0
fi
previous_status='unknown'
if [[ -s "$status_file" ]]; then
  previous_status="$(jq -r '.status // "unknown"' "$status_file" 2>/dev/null || printf 'unknown')"
fi

checked_at="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
if response="$(curl --fail --silent --show-error --max-time 10 "$health_uri" 2>&1)"; then
  current_status='healthy'
  detail='Health endpoint returned successfully from Unraid.'
  healthy=true
else
  current_status='failed'
  detail="Health request failed: $response"
  healthy=false
fi

jq -n \
  --arg checkedAtUtc "$checked_at" \
  --arg status "$current_status" \
  --arg detail "$detail" \
  --arg uri "$health_uri" \
  --argjson healthy "$healthy" \
  '{checkedAtUtc:$checkedAtUtc,status:$status,healthy:$healthy,detail:$detail,uri:$uri}' \
  > "$status_file.tmp"
mv "$status_file.tmp" "$status_file"
chown nobody:users "$status_file"
chmod 0660 "$status_file"

if [[ "$current_status" != "$previous_status" ]]; then
  printf '%s status=%s previous=%s detail=%s\n' \
    "$checked_at" "$current_status" "$previous_status" "$detail" >> "$log_file"

  if [[ "$current_status" == 'failed' ]]; then
    /usr/local/emhttp/webGui/scripts/notify \
      -s 'ShopApp webserver is unavailable' \
      -i 'alert' \
      -m 'Unraid cannot reach the ShopApp health endpoint.' \
      -d "$detail" || true
  elif [[ "$previous_status" == 'failed' ]]; then
    /usr/local/emhttp/webGui/scripts/notify \
      -s 'ShopApp webserver recovered' \
      -i 'normal' \
      -m 'Unraid can reach ShopApp again.' \
      -d "Recovered at $checked_at" || true
  fi
fi

if [[ "$current_status" == 'failed' ]]; then
  exit 1
fi
