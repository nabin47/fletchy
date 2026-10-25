#!/usr/bin/env bash
# Emulator smoke test for the debug APK (run by android-debug.yml).
# Follows "[fletchy] screen=..." console lines in logcat to check that the app
# boots with no INTERNET permission, and that back behaves as designed on
# target SDK 36 (predictive back): in-game back pauses, back on the menu exits.
set -euo pipefail

APK="$1"
OUT="${2:-emulator-results}"
PKG=$(node -p "require('./app.config.json').appId")
mkdir -p "$OUT"

shot() { adb exec-out screencap -p > "$OUT/$1.png" || true; }

fail() {
  echo "::error::$1"
  shot failure
  adb logcat -d > "$OUT/logcat.txt" || true
  grep -E 'fletchy|Capacitor|chromium|AndroidRuntime' "$OUT/logcat.txt" | tail -80 || true
  exit 1
}

# Wait until logcat (since the last clear) contains a screen change.
wait_screen() {
  for _ in $(seq 1 "${2:-30}"); do
    if adb logcat -d 2>/dev/null | grep -q "\[fletchy\] screen=$1"; then return 0; fi
    sleep 1
  done
  fail "timed out waiting for screen=$1"
}

is_resumed() { adb shell dumpsys activity activities | grep -E 'topResumedActivity|mResumedActivity' | grep -q "$PKG"; }

adb install -r "$APK"
if adb shell dumpsys package "$PKG" | grep -q 'android.permission.INTERNET'; then fail "INTERNET permission is still requested"; fi

echo "1. First launch shows the tutorial"
adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity"
wait_screen playing 90
sleep 2
shot 01-tutorial

echo "2. Back in the tutorial skips to the menu"
adb logcat -c
adb shell input keyevent KEYCODE_BACK
wait_screen menu
sleep 1
shot 02-menu

echo "3. Back on the menu exits the app"
adb shell input keyevent KEYCODE_BACK
sleep 3
if is_resumed; then fail "app still in the foreground after back on the menu"; fi

echo "4. Relaunch goes straight to the menu (progress persisted)"
adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity"
wait_screen menu 60

echo "5. Start Rush (the Rush button has focus), back opens pause, back resumes"
adb logcat -c
adb shell input keyevent KEYCODE_ENTER
wait_screen playing
sleep 2
shot 03-rush
adb logcat -c
adb shell input keyevent KEYCODE_BACK
wait_screen pause
shot 04-pause
is_resumed || fail "back in-game closed the app instead of pausing"
adb logcat -c
adb shell input keyevent KEYCODE_BACK
wait_screen playing

echo "All emulator checks passed."
