#!/usr/bin/env bash
# Deletes everything the stack created, including the published files.
set -euo pipefail
source "$(dirname "$0")/common.sh"
require_aws

echo "This permanently deletes stack '$STACK' in $REGION (account $ACCOUNT)."
read -r -p "Type the stack name to confirm: " answer
[ "$answer" = "$STACK" ] || die "aborted"

for key in SiteBucketName ArtifactBucketName; do
  bucket="$(output "$key")"
  case "$bucket" in ''|None) continue ;; esac
  log "Emptying $bucket"
  aws_ s3 rm --only-show-errors --recursive "s3://$bucket/"
done
log "Deleting the stack"
aws_ cloudformation delete-stack --stack-name "$STACK"
aws_ cloudformation wait stack-delete-complete --stack-name "$STACK"
log "Deleted. A budget created with budget.sh is not removed."
