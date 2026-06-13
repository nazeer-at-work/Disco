#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RELEASE_APK="$ROOT_DIR/Disco-arm64-release.apk"
DEBUG_APK="$ROOT_DIR/Disco-arm64-debug.apk"
APK_PATH="$RELEASE_APK"
ADB_BIN="${ADB_BIN:-adb}"

if ! command -v "$ADB_BIN" >/dev/null 2>&1; then
  FALLBACK_ADB="$HOME/Library/Android/sdk/platform-tools/adb"
  if [[ -x "$FALLBACK_ADB" ]]; then
    ADB_BIN="$FALLBACK_ADB"
  else
    echo "adb not found in PATH and fallback not found at $FALLBACK_ADB"
    exit 1
  fi
fi

if [[ ! -f "$APK_PATH" ]]; then
  if [[ -f "$DEBUG_APK" ]]; then
    APK_PATH="$DEBUG_APK"
  else
    echo "APK not found. Expected one of:"
    echo "  - $RELEASE_APK"
    echo "  - $DEBUG_APK"
    exit 1
  fi
fi

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT_DIR/.env"
  set +a
fi

if [[ -n "${ANDROID_SERIAL:-}" ]]; then
  if [[ "$ANDROID_SERIAL" == emulator-* ]]; then
    echo "ANDROID_SERIAL points to emulator ($ANDROID_SERIAL)."
    echo "Set ANDROID_SERIAL in .env to your phone's adb serial and retry."
    exit 1
  fi
  echo "Installing on ANDROID_SERIAL=$ANDROID_SERIAL"
  echo "APK=$APK_PATH"
  "$ADB_BIN" -s "$ANDROID_SERIAL" install -r "$APK_PATH"
else
  echo "ANDROID_SERIAL not set in .env. Please set it to your phone adb serial."
  exit 1
fi
