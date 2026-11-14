#!/usr/bin/env bash
# Runs every end-to-end test: builds an emulator-wired copy of the site, starts the
# Firebase emulators (with ../firestore.rules) and a static server, then runs the suites.
# Usage: cd tests && npm install && npm test
set -euo pipefail
cd "$(dirname "$0")"

PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund --silent
(cd .. && VITE_EMULATOR=1 npx vite build --outDir tests/.dist --emptyOutDir --logLevel warn)
cp ../firestore.rules firestore.rules   # the emulator only reads rules inside this folder
mkdir -p shots

# Own process groups, so stopping them also stops the emulator's Java child.
setsid npx firebase emulators:start --only auth,firestore --project demo-mylink > emulators.log 2>&1 &
EMU=$!
setsid python3 -m http.server 8766 --directory .dist > /dev/null 2>&1 &
WEB=$!
trap 'kill -- -$EMU -$WEB 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  grep -q "All emulators ready" emulators.log && break
  sleep 2
done
grep -q "All emulators ready" emulators.log || { cat emulators.log; exit 1; }

status=0
for suite in customer.test.js admin.test.js; do
  echo "=== $suite"
  node "$suite" || status=1
done
exit $status
