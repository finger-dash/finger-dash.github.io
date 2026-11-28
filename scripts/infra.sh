#!/usr/bin/env bash
# Creates or updates the AWS infrastructure.
# Optional: INSTANCE_TYPE, DOMAIN_NAME + CERTIFICATE_ARN, VPC_ID + SUBNET_ID.
set -euo pipefail
source "$(dirname "$0")/common.sh"
require_aws

STATUS="$(aws_ cloudformation describe-stacks --stack-name "$STACK" \
  --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo NONE)"
case "$STATUS" in
  ROLLBACK_COMPLETE|REVIEW_IN_PROGRESS)
    die "the first deployment failed ($STATUS); run scripts/destroy.sh, then retry" ;;
esac

PREFIX_LIST="$(aws_ ec2 describe-managed-prefix-lists \
  --filters Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing \
  --query 'PrefixLists[0].PrefixListId' --output text)"
[ "$PREFIX_LIST" != "None" ] || die "CloudFront prefix list not found in $REGION"
PARAMS=("CloudFrontPrefixListId=$PREFIX_LIST")

# On the first deployment pick defaults. On updates only pass what was asked for,
# so the network and the instance stay as they are.
if [ "$STATUS" = "NONE" ]; then
  INSTANCE_TYPE="${INSTANCE_TYPE:-t4g.nano}"
  VPC_ID="${VPC_ID:-$(aws_ ec2 describe-vpcs --filters Name=is-default,Values=true \
    --query 'Vpcs[0].VpcId' --output text)}"
  [ "$VPC_ID" != "None" ] || die "no default VPC in $REGION; set VPC_ID and SUBNET_ID"
  if [ -z "${SUBNET_ID:-}" ]; then
    # Not every availability zone offers every instance type.
    ZONES="$(aws_ ec2 describe-instance-type-offerings --location-type availability-zone \
      --filters "Name=instance-type,Values=$INSTANCE_TYPE" \
      --query 'InstanceTypeOfferings[].Location' --output text | tr '\t' ',')"
    [ -n "$ZONES" ] || die "$INSTANCE_TYPE is not offered in $REGION"
    SUBNET_ID="$(aws_ ec2 describe-subnets \
      --filters "Name=vpc-id,Values=$VPC_ID" "Name=availability-zone,Values=$ZONES" \
        Name=default-for-az,Values=true \
      --query 'Subnets[0].SubnetId' --output text)"
    [ "$SUBNET_ID" != "None" ] || die "no suitable subnet; set SUBNET_ID"
  fi
fi

[ -z "${VPC_ID:-}" ] || PARAMS+=("VpcId=$VPC_ID")
[ -z "${SUBNET_ID:-}" ] || PARAMS+=("SubnetId=$SUBNET_ID")
[ -z "${INSTANCE_TYPE:-}" ] || PARAMS+=("InstanceType=$INSTANCE_TYPE")
# Omitted parameters keep their previous value on updates.
[ -z "${DOMAIN_NAME:-}" ] || PARAMS+=("DomainName=$DOMAIN_NAME")
[ -z "${CERTIFICATE_ARN:-}" ] || PARAMS+=("CertificateArn=$CERTIFICATE_ARN")

echo "Account: $ACCOUNT   Region: $REGION   Stack: $STACK"
echo "Parameters: ${PARAMS[*]}"
echo "This creates billable resources (about USD 10-15 per month in sa-east-1)."
if [ "${YES:-}" != "1" ]; then
  read -r -p "Continue? [y/N] " answer
  [ "$answer" = "y" ] || die "aborted"
fi

log "Deploying the stack (the first time takes several minutes)"
aws_ cloudformation deploy --stack-name "$STACK" \
  --template-file "$ROOT/infra/template.yaml" \
  --capabilities CAPABILITY_IAM --no-fail-on-empty-changeset \
  --tags project=finger-podium \
  --parameter-overrides "${PARAMS[@]}"

log "Done: $(output SiteUrl)"
echo "Next: scripts/deploy.sh"
