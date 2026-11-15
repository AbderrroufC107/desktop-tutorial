<?php
// NFC RS — JSON API for shared hosting (PHP 7.4+ / 8.x, MySQL or MariaDB).
// Every request: api/index.php?action=NAME. Reads are GET, writes are POST with a JSON body
// and the header "X-NFCRS: 1" (a page on another site cannot send that header, which blocks CSRF).

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const USERNAME_RE = '/^[a-z0-9_-]{3,30}$/';
const RESERVED = ['admin', 'login', 'app', 'api', 'www', 'help', 'support', 'mylink', 'nfcrs', 'settings'];
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LINK_TYPES = ['whatsapp', 'phone', 'instagram', 'facebook', 'tiktok', 'snapchat', 'youtube', 'telegram', 'linkedin', 'x',
    'threads', 'pinterest', 'spotify', 'github', 'website', 'email', 'location', 'ccp', 'rip', 'card', 'bank'];
const MAX_BODY = 2000000;

// ---------------------------------------------------------------- helpers

function respond($data = null): void
{
    echo json_encode(['ok' => true, 'data' => $data], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $code, string $message = '', int $status = 400): void
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => ['code' => $code, 'message' => $message]], JSON_UNESCAPED_UNICODE);
    exit;
}

function config(): array
{
    static $cfg = null;
    if ($cfg === null) {
        $file = __DIR__ . '/config.php';
        if (!is_file($file)) fail('not-configured', 'Copy api/config.sample.php to api/config.php and fill it in.', 500);
        $cfg = require $file;
    }
    return $cfg;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $c = config();
        $opts = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        // db_user may list several candidates (e.g. with and without the cPanel account prefix).
        foreach ((array) $c['db_user'] as $user) {
            try {
                $pdo = new PDO('mysql:host=' . $c['db_host'] . ';dbname=' . $c['db_name'] . ';charset=utf8mb4', $user, $c['db_pass'], $opts);
                break;
            } catch (PDOException $e) {
                // Wrong database name? If this user can see exactly one database, use that one.
                try {
                    $pdo = new PDO('mysql:host=' . $c['db_host'] . ';charset=utf8mb4', $user, $c['db_pass'], $opts);
                    $names = array_values(array_diff($pdo->query('SHOW DATABASES')->fetchAll(PDO::FETCH_COLUMN),
                        ['information_schema', 'performance_schema', 'mysql', 'sys']));
                    if (count($names) !== 1) throw $e;
                    $pdo->exec('USE `' . str_replace('`', '``', $names[0]) . '`');
                    break;
                } catch (PDOException $e2) {
                    $pdo = null;
                }
            }
        }
        if ($pdo === null) fail('db-unavailable', 'Database connection failed. Check api/config.php.', 500);
        ensure_schema($pdo);
    }
    return $pdo;
}

// Creates the tables on the first request if they are missing (same as importing database.sql).
function ensure_schema(PDO $pdo): void
{
    if ($pdo->query("SHOW TABLES LIKE 'rate_limits'")->fetchColumn() !== false) return;
    $file = __DIR__ . '/schema.sql';
    if (!is_file($file)) fail('db-unavailable', 'Tables missing: import database.sql in phpMyAdmin.', 500);
    $sql = preg_replace('/^--.*$/m', '', (string) file_get_contents($file));
    foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) $pdo->exec($stmt);
}

function q(string $sql, array $args = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute($args);
    return $st;
}

function body(): array
{
    static $b = null;
    if ($b === null) {
        $raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
        if (strlen((string) $raw) > MAX_BODY) fail('too-large', 'Request too large.', 413);
        $b = $raw ? json_decode($raw, true) : [];
        if (!is_array($b)) fail('bad-request', 'Invalid JSON.');
    }
    return $b;
}

function str(array $src, string $key, int $max): string
{
    $v = $src[$key] ?? '';
    if (!is_string($v)) fail('bad-request', "Field $key must be text.");
    return mb_substr(trim($v), 0, $max);
}

function iso(?string $dt): ?string
{
    return $dt ? str_replace(' ', 'T', $dt) . 'Z' : null;
}

function client_ip(): string
{
    return substr((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 0, 45);
}

// Allows $limit attempts per $window seconds for this action from this IP.
function throttle(string $action, int $limit = 10, int $window = 600): void
{
    $k = $action . ':' . client_ip();
    $now = time();
    $row = q('SELECT hits, window_start FROM rate_limits WHERE k = ?', [$k])->fetch();
    if (!$row || $now - (int) $row['window_start'] > $window) {
        q('REPLACE INTO rate_limits (k, hits, window_start) VALUES (?, 1, ?)', [$k, $now]);
        return;
    }
    if ((int) $row['hits'] >= $limit) fail('auth/too-many-requests', 'Too many attempts. Try again later.', 429);
    q('UPDATE rate_limits SET hits = hits + 1 WHERE k = ?', [$k]);
}

function site_base(): string
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $dir = rtrim(str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME']))), '/');
    return ($https ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . $dir . '/';
}

function http_get_json(string $url, array $headers = []): ?array
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_HTTPHEADER => $headers]);
        $out = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
    } else {
        $ctx = stream_context_create(['http' => ['header' => implode("\r\n", $headers), 'timeout' => 10, 'ignore_errors' => true]]);
        $out = @file_get_contents($url, false, $ctx);
        $status = 200;
        if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) $status = (int) $m[1];
    }
    if ($out === false || $status !== 200) return null;
    $j = json_decode((string) $out, true);
    return is_array($j) ? $j : null;
}

// ---------------------------------------------------------------- session

function start_session(): void
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_name('nfcrs');
    session_set_cookie_params(['lifetime' => 60 * 60 * 24 * 30, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax']);
    ini_set('session.gc_maxlifetime', (string) (60 * 60 * 24 * 30));
    session_start();
}

function current_user(): ?array
{
    if (empty($_SESSION['uid'])) return null;
    static $u = false;
    if ($u === false) {
        $u = q('SELECT id, email, name, photo_url FROM users WHERE id = ?', [$_SESSION['uid']])->fetch() ?: null;
    }
    return $u;
}

function require_user(): array
{
    $u = current_user();
    if (!$u) fail('unauthenticated', 'Please sign in.', 401);
    return $u;
}

function is_admin(?array $u): bool
{
    if (!$u) return false;
    $admins = array_map('strtolower', config()['admin_emails'] ?? []);
    return in_array(strtolower($u['email']), $admins, true);
}

function require_admin(): array
{
    $u = require_user();
    if (!is_admin($u)) fail('permission-denied', 'Admins only.', 403);
    return $u;
}

function login_as(int $id): void
{
    session_regenerate_id(true);
    $_SESSION['uid'] = $id;
}

function user_out(?array $u): ?array
{
    if (!$u) return null;
    return ['uid' => (string) $u['id'], 'email' => $u['email'], 'displayName' => $u['name'], 'photoURL' => $u['photo_url']];
}

// ---------------------------------------------------------------- profiles

function profile_out(array $p): array
{
    $links = json_decode((string) $p['links'], true);
    return [
        'username' => $p['username'],
        'name' => $p['name'],
        'bio' => $p['bio'],
        'avatar' => (string) $p['avatar'],
        'cover' => (string) $p['cover'],
        'coverLight' => (int) $p['cover_light'],
        'theme' => $p['theme'],
        'links' => is_array($links) ? $links : [],
        'updatedAt' => iso($p['updated_at']),
    ];
}

function username_problem(string $name, int $uid): string
{
    if (!preg_match(USERNAME_RE, $name)) return 'invalid';
    if (in_array($name, RESERVED, true)) return 'reserved';
    $owner = q('SELECT user_id FROM profiles WHERE username = ?', [$name])->fetchColumn();
    if ($owner !== false && (int) $owner !== $uid) return 'taken';
    return '';
}

function clean_image($v, int $max): string
{
    if (!is_string($v) || $v === '') return '';
    if (strlen($v) > $max) fail('bad-request', 'Image too large.');
    if (preg_match('#^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$#', $v)) return $v;
    if (preg_match('#^https://[^\s"\'<>]+$#', $v)) return $v;
    fail('bad-request', 'Invalid image.');
    return '';
}

function clean_links($links): array
{
    if (!is_array($links)) return [];
    $out = [];
    foreach (array_slice($links, 0, 30) as $l) {
        if (!is_array($l) || !in_array($l['type'] ?? '', LINK_TYPES, true)) continue;
        $value = mb_substr(trim((string) ($l['value'] ?? '')), 0, 300);
        if ($value === '') continue;
        $out[] = ['type' => $l['type'], 'value' => $value, 'label' => mb_substr(trim((string) ($l['label'] ?? '')), 0, 60)];
    }
    return $out;
}

// ---------------------------------------------------------------- cards

function card_out(array $c): array
{
    return [
        'id' => $c['code'],
        'owner' => $c['owner_id'] !== null ? (string) $c['owner_id'] : null,
        'taps' => (int) $c['taps'],
        'note' => $c['note'],
        'createdAt' => iso($c['created_at']),
        'activatedAt' => iso($c['activated_at']),
    ];
}

function normalize_code($code): string
{
    return substr(preg_replace('/[^A-Z0-9]/', '', strtoupper((string) $code)), 0, 16);
}

// ---------------------------------------------------------------- router

start_session();
$action = (string) ($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST' && ($_SERVER['HTTP_X_NFCRS'] ?? '') !== '1') fail('forbidden', 'Missing request header.', 403);

$GETS = ['me', 'config', 'profile', 'profile_by_username', 'check_username', 'card', 'my_cards', 'views', 'admin_cards', 'admin_customers'];
if (in_array($action, $GETS, true) !== ($method === 'GET')) fail('bad-request', 'Wrong method for this action.', 405);

switch ($action) {

    // ---------- account

    case 'config':
        respond(['googleClientId' => (string) (config()['google_client_id'] ?? '')]);

    case 'me':
        $u = current_user();
        respond(['user' => user_out($u), 'isAdmin' => is_admin($u)]);

    case 'signup':
        throttle('signup', 10, 3600);
        $b = body();
        $email = strtolower(str($b, 'email', 190));
        $password = (string) ($b['password'] ?? '');
        $name = str($b, 'name', 80);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('auth/invalid-email');
        if (strlen($password) < 6) fail('auth/weak-password');
        if (q('SELECT id FROM users WHERE email = ?', [$email])->fetch()) fail('auth/email-already-in-use');
        q('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)', [$email, password_hash($password, PASSWORD_DEFAULT), $name]);
        login_as((int) db()->lastInsertId());
        respond(['user' => user_out(current_user())]);

    case 'login':
        throttle('login', 10, 600);
        $b = body();
        $u = q('SELECT id, password_hash FROM users WHERE email = ?', [strtolower(str($b, 'email', 190))])->fetch();
        if (!$u || !$u['password_hash'] || !password_verify((string) ($b['password'] ?? ''), $u['password_hash'])) {
            fail('auth/invalid-credential');
        }
        login_as((int) $u['id']);
        respond(['user' => user_out(current_user())]);

    case 'logout':
        $_SESSION = [];
        session_destroy();
        respond(null);

    case 'google':
        throttle('google', 20, 600);
        $clientId = (string) (config()['google_client_id'] ?? '');
        if ($clientId === '') fail('auth/operation-not-allowed', 'Google sign-in is not configured.');
        $token = str(body(), 'access_token', 4096);
        $info = http_get_json('https://oauth2.googleapis.com/tokeninfo?access_token=' . urlencode($token));
        if (!$info || (($info['aud'] ?? '') !== $clientId && ($info['azp'] ?? '') !== $clientId)) fail('auth/invalid-credential');
        $g = http_get_json('https://openidconnect.googleapis.com/v1/userinfo', ['Authorization: Bearer ' . $token]);
        if (!$g || empty($g['sub']) || empty($g['email']) || empty($g['email_verified'])) fail('auth/invalid-credential');
        $email = strtolower((string) $g['email']);
        $u = q('SELECT id FROM users WHERE google_sub = ? OR email = ? ORDER BY google_sub IS NULL LIMIT 1', [$g['sub'], $email])->fetch();
        if ($u) {
            q("UPDATE users SET google_sub = ?, photo_url = IF(photo_url = '', ?, photo_url) WHERE id = ?", [$g['sub'], (string) ($g['picture'] ?? ''), $u['id']]);
            $id = (int) $u['id'];
        } else {
            q('INSERT INTO users (email, name, google_sub, photo_url) VALUES (?, ?, ?, ?)',
                [$email, mb_substr((string) ($g['name'] ?? ''), 0, 80), $g['sub'], (string) ($g['picture'] ?? '')]);
            $id = (int) db()->lastInsertId();
        }
        login_as($id);
        respond(['user' => user_out(current_user())]);

    case 'reset_request':
        throttle('reset', 5, 3600);
        $email = strtolower(str(body(), 'email', 190));
        $u = q('SELECT id FROM users WHERE email = ?', [$email])->fetch();
        if ($u) {
            $token = bin2hex(random_bytes(24));
            q('DELETE FROM password_resets WHERE user_id = ? OR expires_at < NOW()', [$u['id']]);
            q('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))', [hash('sha256', $token), $u['id']]);
            $link = site_base() . 'login.html?reset=' . $token;
            $from = (string) (config()['mail_from'] ?? '');
            $subject = '=?UTF-8?B?' . base64_encode('إعادة تعيين كلمة المرور — NFC RS') . '?=';
            $text = "لإعادة تعيين كلمة المرور افتح هذا الرابط (صالح لمدة ساعة):\n\n$link\n\nإذا لم تطلب ذلك، تجاهل هذه الرسالة.";
            @mail($email, $subject, $text, "From: $from\r\nContent-Type: text/plain; charset=UTF-8");
        }
        respond(null); // Same answer whether or not the e-mail exists.

    case 'reset_confirm':
        throttle('reset', 10, 3600);
        $b = body();
        $password = (string) ($b['password'] ?? '');
        if (strlen($password) < 6) fail('auth/weak-password');
        $row = q('SELECT user_id FROM password_resets WHERE token_hash = ? AND expires_at > NOW()', [hash('sha256', str($b, 'token', 100))])->fetch();
        if (!$row) fail('auth/expired-action-code');
        q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($password, PASSWORD_DEFAULT), $row['user_id']]);
        q('DELETE FROM password_resets WHERE user_id = ?', [$row['user_id']]);
        login_as((int) $row['user_id']);
        respond(['user' => user_out(current_user())]);

    // ---------- profiles

    case 'profile':
        $p = q('SELECT * FROM profiles WHERE user_id = ?', [(int) ($_GET['uid'] ?? 0)])->fetch();
        respond($p ? profile_out($p) : null);

    case 'profile_by_username':
        $name = strtolower((string) ($_GET['username'] ?? ''));
        if (!preg_match(USERNAME_RE, $name)) respond(null);
        $p = q('SELECT * FROM profiles WHERE username = ?', [$name])->fetch();
        respond($p ? ['uid' => (string) $p['user_id'], 'profile' => profile_out($p)] : null);

    case 'check_username':
        $u = require_user();
        respond(username_problem(strtolower((string) ($_GET['username'] ?? '')), (int) $u['id']));

    case 'save_profile':
        $u = require_user();
        $p = body()['profile'] ?? null;
        if (!is_array($p)) fail('bad-request', 'Missing profile.');
        $username = strtolower(str($p, 'username', 30));
        $problem = username_problem($username, (int) $u['id']);
        if ($problem) fail('username-' . $problem);
        $theme = str($p, 'theme', 9);
        if (!preg_match('/^(p:[a-z]+|#[0-9a-fA-F]{6})$/', $theme)) $theme = 'p:gold';
        $light = max(30, min(170, (int) ($p['coverLight'] ?? 100)));
        $args = [
            $username, str($p, 'name', 80), str($p, 'bio', 300),
            clean_image($p['avatar'] ?? '', 150000), clean_image($p['cover'] ?? '', 400000), $light, $theme,
            json_encode(clean_links($p['links'] ?? []), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ];
        try {
            q('INSERT INTO profiles (user_id, username, name, bio, avatar, cover, cover_light, theme, links) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE username = VALUES(username), name = VALUES(name), bio = VALUES(bio), avatar = VALUES(avatar),
               cover = VALUES(cover), cover_light = VALUES(cover_light), theme = VALUES(theme), links = VALUES(links)',
               array_merge([(int) $u['id']], $args));
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') fail('username-taken'); // lost a race for the same username
            throw $e;
        }
        respond(profile_out(q('SELECT * FROM profiles WHERE user_id = ?', [$u['id']])->fetch()));

    case 'view':
        q('UPDATE profiles SET views = views + 1 WHERE user_id = ?', [(int) (body()['uid'] ?? 0)]);
        respond(null);

    case 'views':
        $u = require_user();
        respond((int) q('SELECT views FROM profiles WHERE user_id = ?', [$u['id']])->fetchColumn());

    // ---------- cards

    case 'card':
        $c = q('SELECT * FROM cards WHERE code = ?', [normalize_code($_GET['code'] ?? '')])->fetch();
        respond($c ? card_out($c) : null);

    case 'tap':
        q('UPDATE cards SET taps = taps + 1 WHERE code = ? AND owner_id IS NOT NULL', [normalize_code(body()['code'] ?? '')]);
        respond(null);

    case 'claim':
        $u = require_user();
        $code = normalize_code(body()['code'] ?? '');
        $c = q('SELECT * FROM cards WHERE code = ?', [$code])->fetch();
        if (!$c) fail('card-not-found');
        if ($c['owner_id'] !== null && (int) $c['owner_id'] !== (int) $u['id']) fail('card-taken');
        q('UPDATE cards SET owner_id = ?, activated_at = NOW() WHERE code = ? AND owner_id IS NULL', [$u['id'], $code]);
        respond(card_out(q('SELECT * FROM cards WHERE code = ?', [$code])->fetch()));

    case 'release':
        $u = require_user();
        q('UPDATE cards SET owner_id = NULL, activated_at = NULL WHERE code = ? AND owner_id = ?', [normalize_code(body()['code'] ?? ''), $u['id']]);
        respond(null);

    case 'my_cards':
        $u = require_user();
        respond(array_map('card_out', q('SELECT * FROM cards WHERE owner_id = ? ORDER BY activated_at DESC', [$u['id']])->fetchAll()));

    // ---------- admin

    case 'admin_cards':
        require_admin();
        respond(array_map('card_out', q('SELECT * FROM cards ORDER BY created_at DESC, code LIMIT 2000')->fetchAll()));

    case 'admin_customers':
        require_admin();
        $rows = q('SELECT user_id, username, name, avatar, links, views FROM profiles ORDER BY views DESC LIMIT 2000')->fetchAll();
        respond(array_map(function ($p) {
            $links = json_decode((string) $p['links'], true);
            return ['uid' => (string) $p['user_id'], 'username' => $p['username'], 'name' => $p['name'],
                'avatar' => (string) $p['avatar'], 'links' => is_array($links) ? $links : [], 'views' => (int) $p['views']];
        }, $rows));

    case 'admin_create':
        require_admin();
        $b = body();
        $count = max(1, min(200, (int) ($b['count'] ?? 1)));
        $note = str($b, 'note', 80);
        $codes = [];
        while (count($codes) < $count) {
            $code = '';
            for ($i = 0; $i < 8; $i++) $code .= CODE_ALPHABET[random_int(0, strlen(CODE_ALPHABET) - 1)];
            if (q('INSERT IGNORE INTO cards (code, note) VALUES (?, ?)', [$code, $note])->rowCount() === 1) $codes[] = $code;
        }
        respond($codes);

    case 'admin_note':
        require_admin();
        $b = body();
        q('UPDATE cards SET note = ? WHERE code = ?', [str($b, 'note', 80), normalize_code($b['code'] ?? '')]);
        respond(null);

    case 'admin_reset':
        require_admin();
        q('UPDATE cards SET owner_id = NULL, activated_at = NULL, taps = 0 WHERE code = ?', [normalize_code(body()['code'] ?? '')]);
        respond(null);

    case 'admin_delete':
        require_admin();
        q('DELETE FROM cards WHERE code = ?', [normalize_code(body()['code'] ?? '')]);
        respond(null);

    default:
        fail('not-found', 'Unknown action.', 404);
}
