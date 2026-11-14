// Shared helpers for the end-to-end suites.
const path = require('path');
const { chromium } = require('playwright');

const BASE = 'http://localhost:8766/';
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
  await fetch(`${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
}

async function makeAdmin(uid) {
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

module.exports = { BASE, SHOTS, check, finish, launch, newPage, resetEmulators, makeAdmin, fillSignup, onboard, toastHas };
