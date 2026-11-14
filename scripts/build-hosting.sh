#!/usr/bin/env bash
# Builds the cPanel edition (PHP + MySQL) into hosting/dist and zips it as hosting/nfc-rs-cpanel.zip.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=hosting/dist
rm -rf "$OUT"

VITE_BACKEND=php npx vite build --outDir "$OUT/public_html" --emptyOutDir --logLevel warn
mkdir -p "$OUT/public_html/api"
cp hosting/api/index.php hosting/api/config.sample.php "$OUT/public_html/api/"
cp hosting/htaccess-root.txt "$OUT/public_html/.htaccess"
cp hosting/htaccess-api.txt "$OUT/public_html/api/.htaccess"
cp hosting/database.sql hosting/INSTALL.md "$OUT/"

rm -f hosting/nfc-rs-cpanel.zip
(cd "$OUT" && zip -qr ../nfc-rs-cpanel.zip .)
echo "Built hosting/nfc-rs-cpanel.zip"
