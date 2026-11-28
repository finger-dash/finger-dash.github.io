#!/usr/bin/env bash
# Emails an alert when the account's monthly cost gets close to a limit.
# Usage: scripts/budget.sh you@example.com [monthly-usd]
# Note: the budget covers the whole account, and it warns but does not stop spending.
set -euo pipefail
source "$(dirname "$0")/common.sh"
EMAIL="${1:-}"; LIMIT="${2:-25}"
[ -n "$EMAIL" ] || die "usage: $0 you@example.com [monthly-usd]"
require_aws

alert() { # $1 = ACTUAL|FORECASTED, $2 = percentage
  printf '{"Notification":{"NotificationType":"%s","ComparisonOperator":"GREATER_THAN","Threshold":%s,"ThresholdType":"PERCENTAGE"},"Subscribers":[{"SubscriptionType":"EMAIL","Address":"%s"}]}' "$1" "$2" "$EMAIL"
}

aws budgets create-budget --account-id "$ACCOUNT" \
  --budget "{\"BudgetName\":\"$STACK-monthly\",\"BudgetLimit\":{\"Amount\":\"$LIMIT\",\"Unit\":\"USD\"},\"TimeUnit\":\"MONTHLY\",\"BudgetType\":\"COST\"}" \
  --notifications-with-subscribers "[$(alert ACTUAL 80),$(alert FORECASTED 100)]"
log "Budget $STACK-monthly created: USD $LIMIT per month, alerts to $EMAIL"
