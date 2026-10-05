#!/usr/bin/env bash
# One-click local run on macOS/Linux: update, install, start, open the browser.
set -e
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js 20+ is required: https://nodejs.org"; exit 1; }
command -v git >/dev/null && git pull || true
[ -f .env ] || echo "FIREBASE_USE_ADC=false" > .env
npm install
( sleep 8; (command -v open >/dev/null && open http://localhost:3000) || xdg-open http://localhost:3000 ) >/dev/null 2>&1 &
npm run dev
