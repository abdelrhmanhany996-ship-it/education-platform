#!/usr/bin/env bash
# Creates the signing key for this app build and registers it with the platform.
# GitHub signs the OIDC token, so only this repository's apps workflow on main can register keys.
# Usage: app-key.sh <android|windows|mac>
set -euo pipefail
PLATFORM="$1"
APP_URL=$(grep '^appUrl=' android/gradle.properties | cut -d= -f2- | tr -d '\r' | sed 's#/*$##')
KEY=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")
echo "::add-mask::$KEY"
echo "APP_SIGN_KEY=$KEY" >> "$GITHUB_ENV"

# The platform may still be deploying the commit that added /api/app-keys; keep trying for ~20 minutes
for i in $(seq 1 40); do
  OIDC=$(curl -sf -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
    "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=academic-platform-apps" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).value))")
  echo "::add-mask::$OIDC"
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$APP_URL/api/app-keys" \
    -H "Authorization: Bearer $OIDC" -H 'Content-Type: application/json' \
    -d "{\"platform\":\"$PLATFORM\",\"key\":\"$KEY\"}" || true)
  if [ "$CODE" = "200" ]; then echo "Key registered for $PLATFORM"; exit 0; fi
  echo "Attempt $i: platform answered $CODE, retrying in 30s"
  sleep 30
done
echo "Could not register the signing key with $APP_URL" >&2
exit 1
