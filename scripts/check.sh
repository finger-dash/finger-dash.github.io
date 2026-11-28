#!/usr/bin/env bash
# End-to-end check through CloudFront: the page loads and the WebSocket upgrades.
set -euo pipefail
source "$(dirname "$0")/common.sh"
require_aws

URL="$(output SiteUrl)"
FAILED=0
report() { if [ "$2" = "$3" ]; then echo "ok    $1"; else echo "FAIL  $1 (got $2, expected $3)"; FAILED=1; fi; }

handshake() { # $1 = Origin header; prints the HTTP status
  # An accepted socket stays open, so curl is expected to time out.
  curl -s --http1.1 --max-time 5 -o /dev/null -w '%{http_code}' \
    -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' \
    -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' -H "Origin: $1" "$URL/ws" || true
}

echo "Checking $URL"
report "game page" "$(curl -s --max-time 15 -o /dev/null -w '%{http_code}' "$URL/")" 200
report "websocket upgrade" "$(handshake "$URL")" 101
report "foreign origin rejected" "$(handshake https://example.com)" 403
exit "$FAILED"
