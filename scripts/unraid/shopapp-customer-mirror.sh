#!/bin/bash
set -euo pipefail

source_share='//192.168.254.72/ShopAppStorage$'
mount_point='/mnt/remotes/ShopAppStorage'
target_root='/mnt/user/projects/ShopApp Customer Files'
status_root='/mnt/user/projects/Backups/ShopApp/monitoring'
credential_file='/boot/config/plugins/shopapp-customer-mirror/windows-storage.credentials'
lock_file='/var/run/shopapp-customer-mirror.lock'
log_file="$status_root/customer-mirror.log"
status_file="$status_root/customer-mirror-status.json"

mkdir -p "$mount_point" "$target_root" "$status_root"
chown nobody:users "$target_root" "$status_root"
chmod 0770 "$target_root" "$status_root"

exec 9>"$lock_file"
if ! flock -n 9; then
  exit 0
fi

write_log() {
  printf '%s %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$1" >> "$log_file"
}

write_status() {
  local status="$1"
  local detail="$2"
  jq -n \
    --arg checkedAtUtc "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    --arg status "$status" \
    --arg detail "$detail" \
    --arg source "$source_share" \
    --arg target "$target_root" \
    '{checkedAtUtc:$checkedAtUtc,status:$status,detail:$detail,source:$source,target:$target}' \
    > "$status_file.tmp"
  mv "$status_file.tmp" "$status_file"
  chown nobody:users "$status_file"
  chmod 0660 "$status_file"
}

cleanup() {
  if mountpoint -q "$mount_point"; then
    umount "$mount_point" || true
  fi
}
trap cleanup EXIT

if [[ ! -s "$credential_file" ]]; then
  write_log 'Mirror failed: credential file is missing.'
  write_status 'failed' 'Credential file is missing.'
  exit 1
fi

if mountpoint -q "$mount_point"; then
  umount "$mount_point"
fi

if ! mount -t cifs "$source_share" "$mount_point" \
  -o "credentials=$credential_file,vers=3.1.1,seal,ro,noserverino,iocharset=utf8"; then
  write_log 'Mirror failed: Windows storage share could not be mounted.'
  write_status 'failed' 'Windows storage share could not be mounted.'
  /usr/local/emhttp/webGui/scripts/notify \
    -s 'ShopApp customer-file mirror failed' \
    -i 'alert' \
    -m 'Unraid could not connect to SHOPAPP storage.' \
    -d "Failed at $(date)" || true
  exit 1
fi

rsync_output="$(mktemp)"
if rsync -rt \
  --modify-window=2 \
  --itemize-changes \
  --exclude='Thumbs.db' \
  --exclude='.DS_Store' \
  "$mount_point/" "$target_root/" > "$rsync_output" 2>&1; then
  changed_count="$(grep -c '^[<>ch.*]' "$rsync_output" || true)"
  file_count="$(find "$target_root" -type f | wc -l | tr -d ' ')"
  detail="Mirror passed; changed=$changed_count files=$file_count."
  write_log "$detail"
  write_status 'healthy' "$detail"
  rm -f "$rsync_output"
  exit 0
fi

detail="Mirror failed: $(tail -n 1 "$rsync_output")"
write_log "$detail"
write_status 'failed' "$detail"
rm -f "$rsync_output"
/usr/local/emhttp/webGui/scripts/notify \
  -s 'ShopApp customer-file mirror failed' \
  -i 'alert' \
  -m "$detail" \
  -d "Failed at $(date)" || true
exit 1
