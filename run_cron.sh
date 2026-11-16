#!/usr/bin/env bash
# Triggers the scheduled jobs locally (the hosted platform does this automatically).
# Usage: ./run_cron.sh daily-sync | monthly-report   [base_url, default http://localhost:3000]
set -euo pipefail
JOB=${1:?daily-sync or monthly-report}
BASE=${2:-http://localhost:3000}
SECRET=$(grep '^WEBHOOK_CRON_SECRET=' "$(dirname "$0")/backend/.env" | cut -d= -f2-)
curl -fsS -X POST "$BASE/api/cron/$JOB" -H "Authorization: Bearer $SECRET" -H "X-Webhook-Id: local-$(date +%s)"
echo
