// Shared helpers for the end-to-end suites.
const path = require('path');
const { chromium } = require('playwright');

// BACKEND=php runs the suites against the cPanel edition (PHP + MariaDB) instead of the Firebase emulators.
const BACKEND = process.env.BACKEND === 'php' ? 'php' : 'firebase';
const BASE = BACKEND === 'php' ? 'http://localhost:8768/' : 'http://localhost:8766/';
const SETUP_KEY = 'test-setup-key-0123456789';
const PHP_ADMINS = path.join(__dirname, '.dist-php', 'api', 'test-admins.txt');
const PROJECT = 'demo-mylink';
const FIRESTORE = 'http://127.0.0.1:8080';
const AUTH = 'http://127.0.0.1:9099';
const SHOTS = path.join(__dirname, 'shots');

let failures = 0;
function check(cond, msg) {
  console.log((cond ? 'PASS ' : 'FAIL ') + msg);
  if (!cond) failures++;
}

function finish() {
  console.log(failures ? failures + ' FAILURE(S)' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
}

async function launch() {
  return chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
}

async function newPage(browser, viewport) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1280, height: 900 }, acceptDownloads: true });
  await ctx.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); failures++; });
  page.on('dialog', (d) => d.accept());
  return page;
}

async function resetEmulators() {
  if (BACKEND === 'php') {
    require('child_process').execSync('mysql nfcrs_test -e "SET FOREIGN_KEY_CHECKS=0; TRUNCATE cards; TRUNCATE admins; TRUNCATE password_resets; TRUNCATE profiles; TRUNCATE rate_limits; TRUNCATE users; SET FOREIGN_KEY_CHECKS=1;"');
    require('fs').writeFileSync(PHP_ADMINS, '');
    return;
  }
  await fetch(`${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
}

async function makeAdmin(uid, email) {
  if (BACKEND === 'php') {
    require('fs').appendFileSync(PHP_ADMINS, email + '\n');
    return;
  }
  const r = await fetch(`${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/admins?documentId=${uid}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { role: { stringValue: 'owner' } } })
  });
  if (!r.ok) throw new Error('makeAdmin ' + r.status + ' ' + await r.text());
}

// Fills the sign-up form on the current login page (switching to sign-up if needed).
async function fillSignup(page, name, email) {
  await page.waitForSelector('#submit');
  if (!(await page.isVisible('#name'))) await page.click('#switch button');
  await page.fill('#name', name);
  await page.fill('#email', email);
  await page.fill('#password', 'secret123');
  await page.click('#submit');
  await page.waitForURL(/app\.html/);
}

async function onboard(page, username, shot) {
  await page.waitForSelector('#onboarding', { timeout: 15000 });
  if (shot) await page.screenshot({ path: path.join(SHOTS, shot) });
  await page.fill('#ob-username', username);
  await page.waitForFunction(() => /متاح/.test((document.getElementById('ob-check') || {}).textContent || ''), null, { timeout: 10000 });
  await page.click('#ob-save');
  await page.waitForSelector('#dashboard', { timeout: 15000 });
}

function toastHas(page, re) {
  return page.waitForFunction((src) => new RegExp(src).test((document.getElementById('toast') || {}).textContent || ''), re.source, { timeout: 10000 });
}

// A solid-colour PNG of the given size, for upload tests.
function pngBuffer(width, height) {
  const zlib = require('zlib');
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, Buffer.from([40, 90, 160]))]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// A PNG full of random pixels: the worst case for JPEG compression.
function noisyPng(width, height) {
  const zlib = require('zlib');
  const crypto = require('crypto');
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const rows = [];
  for (let y = 0; y < height; y++) rows.push(Buffer.from([0]), crypto.randomBytes(width * 3));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

module.exports = { noisyPng, SETUP_KEY, BACKEND, pngBuffer, BASE, SHOTS, check, finish, launch, newPage, resetEmulators, makeAdmin, fillSignup, onboard, toastHas };
