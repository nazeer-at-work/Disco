#!/usr/bin/env bash

set -euo pipefail

SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="$SDK_ROOT"
export PATH="$SDK_ROOT/platform-tools:$SDK_ROOT/emulator:$PATH"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$PWD/.gradle-local}"

if [ -z "${ANDROID_SERIAL:-}" ]; then
  EMU_SERIAL="$(adb devices | awk '/^emulator-[0-9]+[[:space:]]+device$/ { print $1; exit }')"
  if [ -n "$EMU_SERIAL" ]; then
    export ANDROID_SERIAL="$EMU_SERIAL"
  fi
fi

exec npx react-native run-android --port 19001 --no-packager "${ANDROID_SERIAL:+--device}" "${ANDROID_SERIAL:+$ANDROID_SERIAL}"
