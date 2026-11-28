#!/usr/bin/env bash
# Runs on the instance (as root, through Systems Manager).
# Usage: remote-install.sh <s3-url> <version> '<allowed origins>'
set -euo pipefail
URL="$1"; VERSION="$2"; ORIGINS="$3"
export HOME="${HOME:-/root}" # npm needs it; Systems Manager may not set it
APP=/opt/fingerpodium
RELEASE="$APP/releases/$VERSION"

# On a new machine, wait for the first-boot setup to finish.
cloud-init status --wait >/dev/null || true
command -v node-24 >/dev/null || { echo "node-24 missing: see /var/log/cloud-init-output.log" >&2; exit 1; }

mkdir -p "$RELEASE"
aws s3 cp --only-show-errors "$URL" /tmp/fingerpodium.tar.gz
tar -xzf /tmp/fingerpodium.tar.gz -C "$RELEASE"
(cd "$RELEASE" && "$(command -v npm-24 || command -v npm)" install --omit=dev --no-audit --no-fund --no-package-lock)

PREVIOUS="$(readlink "$APP/current" || true)"
activate() {
  ln -sfn "$1" "$APP/current"
  systemctl restart fingerpodium
}

printf 'PORT=8080\nVERSION=%s\nALLOWED_ORIGINS="%s"\n' "$VERSION" "$ORIGINS" > /etc/fingerpodium.env
activate "$RELEASE"

for _ in 1 2 3 4 5 6 7 8 9 10; do
  sleep 1
  if curl -fs http://127.0.0.1:8080/health | grep -q "$VERSION"; then
    echo "server $VERSION is healthy"
    # Keep the three most recent releases.
    ls -1dt "$APP"/releases/* | tail -n +4 | xargs -r rm -rf
    exit 0
  fi
done

journalctl -u fingerpodium -n 30 --no-pager >&2 || true
if [ -n "$PREVIOUS" ]; then
  echo "rolling back to $PREVIOUS" >&2
  activate "$PREVIOUS"
fi
exit 1
