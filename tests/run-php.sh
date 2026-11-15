#!/usr/bin/env bash
# Runs the same end-to-end suites against the cPanel edition: PHP API + MariaDB/MySQL.
# Needs php (with pdo_mysql) and a local MariaDB/MySQL server you can reach as root via `mysql`.
# Usage: cd tests && npm run test:php
set -euo pipefail
cd "$(dirname "$0")"

PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund --silent
(cd .. && VITE_BACKEND=php VITE_TEST=1 npx vite build --outDir tests/.dist-php --emptyOutDir --logLevel warn)
mkdir -p .dist-php/api shots
cp ../hosting/api/index.php .dist-php/api/
cp ../hosting/database.sql .dist-php/api/schema.sql
cat > .dist-php/api/config.php <<'PHP'
<?php
return [
    'db_host' => 'localhost', 'db_name' => 'nfcrs_test', 'db_user' => 'nfcrs', 'db_pass' => 'testpass',
    // Tests add admins at run time by appending e-mails to this file.
    'admin_emails' => array_filter(array_map('trim', @file(__DIR__ . '/test-admins.txt') ?: [])),
    'setup_key' => 'test-setup-key-0123456789',
    'google_client_id' => '',
    'mail_from' => 'no-reply@example.com',
];
PHP
: > .dist-php/api/test-admins.txt

mysqladmin ping > /dev/null 2>&1 || { (mysqld_safe --user=mysql > /dev/null 2>&1 &); sleep 5; }
mysql -e "DROP DATABASE IF EXISTS nfcrs_test; CREATE DATABASE nfcrs_test CHARACTER SET utf8mb4;
          CREATE USER IF NOT EXISTS 'nfcrs'@'localhost' IDENTIFIED BY 'testpass';
          GRANT ALL ON nfcrs_test.* TO 'nfcrs'@'localhost'; FLUSH PRIVILEGES;"
mysql nfcrs_test < ../hosting/database.sql

setsid php -S 127.0.0.1:8768 -t .dist-php > php-server.log 2>&1 &
WEB=$!
trap 'kill -- -$WEB 2>/dev/null || true' EXIT
sleep 1

status=0
for suite in customer.test.js admin.test.js; do
  echo "=== $suite (PHP + MySQL)"
  BACKEND=php node "$suite" || status=1
done
exit $status
