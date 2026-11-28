#!/usr/bin/env bash
# Publishes the game and the server. Usage: scripts/deploy.sh [all|web|server]
set -euo pipefail
source "$(dirname "$0")/common.sh"
TARGET="${1:-all}"
case "$TARGET" in all|web|server) ;; *) die "usage: $0 [all|web|server]" ;; esac
require_aws

VERSION="$(date -u +%Y%m%d%H%M%S)-$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo nogit)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

deploy_server() {
  local bucket instance origins status command_id remote
  bucket="$(output ArtifactBucketName)"
  instance="$(output InstanceId)"
  origins="$(output AllowedOrigins)"

  log "Uploading server $VERSION"
  # COPYFILE_DISABLE keeps macOS metadata files out of the archive.
  COPYFILE_DISABLE=1 tar -czf "$WORK/server.tar.gz" -C "$ROOT/server" \
    server.js limits.js package.json
  aws_ s3 cp --only-show-errors "$WORK/server.tar.gz" "s3://$bucket/builds/$VERSION.tar.gz"
  aws_ s3 cp --only-show-errors "$ROOT/scripts/remote-install.sh" "s3://$bucket/builds/$VERSION.sh"

  log "Waiting for the instance to accept commands"
  local tries=0
  until [ "$(aws_ ssm describe-instance-information \
      --filters "Key=InstanceIds,Values=$instance" \
      --query 'InstanceInformationList[0].PingStatus' --output text)" = "Online" ]; do
    tries=$((tries + 1))
    [ "$tries" -lt 60 ] || die "instance $instance did not register in Systems Manager"
    sleep 5
  done

  log "Installing on $instance"
  remote="aws s3 cp --only-show-errors s3://$bucket/builds/$VERSION.sh /tmp/install.sh"
  remote="$remote && bash /tmp/install.sh s3://$bucket/builds/$VERSION.tar.gz $VERSION '$origins'"
  command_id="$(aws_ ssm send-command --instance-ids "$instance" \
    --document-name AWS-RunShellScript --comment "deploy $VERSION" \
    --parameters "{\"commands\":[\"$remote\"]}" \
    --query 'Command.CommandId' --output text)"

  tries=0
  while :; do
    sleep 5
    status="$(aws_ ssm get-command-invocation --command-id "$command_id" \
      --instance-id "$instance" --query Status --output text 2>/dev/null || echo Pending)"
    case "$status" in
      Success) break ;;
      Pending|InProgress|Delayed) ;;
      *)
        aws_ ssm get-command-invocation --command-id "$command_id" --instance-id "$instance" \
          --query '[StandardOutputContent,StandardErrorContent]' --output text
        die "server install failed: $status" ;;
    esac
    tries=$((tries + 1))
    [ "$tries" -lt 120 ] || die "server install timed out (command $command_id)"
  done
}

deploy_web() {
  local bucket distribution file
  bucket="$(output SiteBucketName)"
  distribution="$(output DistributionId)"

  log "Uploading the game"
  mkdir "$WORK/site"
  # Publish exactly what index.html loads.
  cp "$ROOT/index.html" "$WORK/site/"
  for file in $(sed -n 's/.*<script src="\([^"]*\)".*/\1/p' "$ROOT/index.html"); do
    cp "$ROOT/$file" "$WORK/site/"
  done
  aws_ s3 sync --only-show-errors --delete --exact-timestamps \
    --cache-control no-cache "$WORK/site" "s3://$bucket/"
  aws_ cloudfront create-invalidation --distribution-id "$distribution" \
    --paths '/*' --query 'Invalidation.Id' --output text >/dev/null
}

[ "$TARGET" = "web" ] || deploy_server
[ "$TARGET" = "server" ] || deploy_web
log "Deployed. Check it with: scripts/check.sh"
