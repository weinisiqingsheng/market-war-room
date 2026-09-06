#!/usr/bin/env bash
# Fail if any source file appears to contain a real secret.
# Patterns: OpenAI/Anthropic keys, AWS access keys, GitHub PATs, Alpaca API
# keys, PEM keys.
set -uo pipefail
cd "$(dirname "$0")/.."

HITS=$(
  find . -type f \
    -not -path './node_modules/*' \
    -not -path '*/node_modules/*' \
    -not -path './.git/*' \
    -not -path '*/.next/*' \
    -not -path '*/.venv/*' \
    -not -path '*/__pycache__/*' \
    -not -path './scripts/check-secrets.sh' \
    -not -name 'package-lock.json' \
    -not -name '*.pyc' \
    -not -name '.env' \
    -not -name '.env.*' \
    -print0 \
    | xargs -0 grep -lE '(sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{35}|AKIA[0-9A-Z]{16}|ghp_[0-9A-Za-z]{36}|-----BEGIN [A-Z ]*PRIVATE KEY-----|APCA-API-KEY-ID: [^ ]+|ALPACA_API_KEY_ID\s*=\s*[A-Za-z0-9]{20,}|ALPACA_API_SECRET_KEY\s*=\s*[A-Za-z0-9]{20,}|^PKKST7[A-Z0-9]+$)' 2>/dev/null || true
)

if [ -n "$HITS" ]; then
  echo "Possible secrets found in:" >&2
  echo "$HITS" >&2
  exit 1
fi

echo "No obvious secrets found."
