#!/usr/bin/env sh
# 在背景等待 Metro 就緒後，主動建立 Expo Go 所需的 Android Hermes bundle。
# 讓手機掃描 QR Code 時直接取得已快取的檔案，避免冷啟動編譯超過 Expo Go 的下載等待時間。
set -eu

port="${EXPO_PORT:-8081}"
bundle_url="http://127.0.0.1:${port}/node_modules/expo-router/entry.bundle?platform=android&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=app&unstable_transformProfile=hermes-stable"
attempt=0

while [ "$attempt" -lt 25 ]; do
  attempt=$((attempt + 1))
  if curl --fail --silent --show-error --connect-timeout 2 --max-time 90 "$bundle_url" -o /dev/null; then
    exit 0
  fi
  sleep 2
done

exit 0
