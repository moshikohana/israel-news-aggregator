#!/usr/bin/env bash
#
# record_kan_bet.sh
# Record the daily current-affairs show "בחצי היום עם אסתי פרז" on כאן ב' (Kan Bet, 95FM).
#
# The show airs every day 12:00–14:00 Israel time. By default this records a
# 60-minute window (i.e. the 12:00–13:00 hour the user asked for).
#
# Requirements: bash, curl, and ffmpeg  ( brew install ffmpeg  /  sudo apt install ffmpeg )
#
# Usage:
#   ./record_kan_bet.sh                 # record 60 min starting now
#   DURATION=7200 ./record_kan_bet.sh   # record the full 2-hour show
#   OUTPUT=esti.m4a ./record_kan_bet.sh # choose the output file
#   STREAM_URL="https://.../live.m3u8" ./record_kan_bet.sh   # force a stream URL
#
# To start it automatically at 12:00, schedule it (see scripts/README.md):
#   echo "$(pwd)/record_kan_bet.sh" | at 12:00
#
set -euo pipefail

DURATION="${DURATION:-3600}"   # seconds; 3600 = 1 hour (12:00–13:00)
OUTPUT="${OUTPUT:-kan_bet_esti_perez_$(date +%Y-%m-%d_%H%M).m4a}"
STREAM_URL="${STREAM_URL:-}"

# Kan's live-radio page for כאן ב'. The actual HLS/AAC URL is embedded in the
# page and changes from time to time, so we resolve it dynamically when the
# caller hasn't supplied STREAM_URL directly.
RADIO_PAGE="${RADIO_PAGE:-https://www.kan.org.il/live/?radio=2}"

resolve_stream() {
  echo "Resolving current כאן ב' stream URL from ${RADIO_PAGE} ..." >&2
  curl -fsSL -A 'Mozilla/5.0' "$RADIO_PAGE" \
    | grep -oE 'https?://[^"'"'"' ]+\.m3u8' \
    | grep -iE 'radio|kan-b|reshet|aac|audio' \
    | head -n1
}

if [[ -z "$STREAM_URL" ]]; then
  STREAM_URL="$(resolve_stream || true)"
fi

if [[ -z "$STREAM_URL" ]]; then
  cat >&2 <<'EOF'
Could not auto-detect the stream URL.

Grab it manually (takes 20 seconds):
  1. Open https://www.kan.org.il/live/ and start כאן ב' playing.
  2. Open the browser DevTools > Network tab, filter by "m3u8" (or "aac").
  3. Copy the streaming URL and re-run:
       STREAM_URL="<the-url>" ./record_kan_bet.sh
EOF
  exit 1
fi

echo "Stream:   $STREAM_URL"
echo "Duration: ${DURATION}s"
echo "Output:   $OUTPUT"
echo "Recording... (Ctrl-C to stop early)"

# -c copy keeps the original AAC audio without re-encoding (fast, lossless).
ffmpeg -hide_banner -loglevel warning -y \
  -i "$STREAM_URL" \
  -t "$DURATION" \
  -c copy \
  "$OUTPUT"

echo "Done. Saved to: $OUTPUT"
