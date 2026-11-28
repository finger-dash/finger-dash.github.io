# Shared settings and helpers. Compatible with the bash 3.2 shipped with macOS.
STACK="${STACK:-finger-podium}"
REGION="${REGION:-sa-east-1}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export AWS_PAGER=""

die() { echo "error: $*" >&2; exit 1; }
log() { echo "==> $*"; }
aws_() { aws --region "$REGION" "$@"; }

require_aws() {
  command -v aws >/dev/null || die "AWS CLI v2 is not installed"
  ACCOUNT="$(aws_ sts get-caller-identity --query Account --output text)" ||
    die "no valid AWS credentials (set AWS_PROFILE, or run: aws configure sso)"
}

output() {
  aws_ cloudformation describe-stacks --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
