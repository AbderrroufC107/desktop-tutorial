// Data layer for the cPanel edition (PHP + MySQL in hosting/api).
// Exposes the same functions as db.js, so the pages work unchanged with either backend.
import { coverLight } from './utils.js';

export const backend = 'php';
export const isConfigured = true;
export const USERNAME_RE = /^[a-z0-9_-]{3,30}$/;

const API = new URL('api/index.php', location.href).href;

class ApiError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

async function call(action, { body, params } = {}) {
  const url = new URL(API);
  url.searchParams.set('action', action);
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
  let res;
  try {
    res = await fetch(url, body === undefined
      ? { credentials: 'same-origin' }
      : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-NFCRS': '1' }, body: JSON.stringify(body) });
  } catch (e) {
    throw new ApiError('auth/network-request-failed');
  }
  let json;
  try { json = await res.json(); } catch (e) { throw new ApiError('server-error', 'Unexpected server response (' + res.status + ').'); }
  if (!json.ok) throw new ApiError(json.error.code, json.error.message);
  return json.data;
}

// Dates from the API are ISO strings; wrap them like Firestore timestamps so pages can call toDate().
const stamp = (iso) => (iso ? { toDate: () => new Date(iso) } : null);
const cardIn = (c) => Object.assign({}, c, { createdAt: stamp(c.createdAt), activatedAt: stamp(c.activatedAt) });

const CODE_RE = /[^A-Z0-9]/g;
export function normalizeCode(code) {
  return String(code || '').toUpperCase().replace(CODE_RE, '');
}

// ---------- auth ----------

let user = null;
let admin = false;
let loaded = false;
const listeners = new Set();

function setUser(u, isAdminFlag) {
  user = u;
  if (isAdminFlag !== undefined) admin = isAdminFlag;
  loaded = true;
  listeners.forEach((cb) => cb(user));
}

const ready = call('me').then((d) => setUser(d.user, d.isAdmin), () => setUser(null, false));

export function onUser(cb) {
  listeners.add(cb);
  if (loaded) setTimeout(() => listeners.has(cb) && cb(user), 0);
  return () => listeners.delete(cb);
}

export function currentUser() {
  return user;
}

async function signedIn(d) {
  const me = await call('me');
  setUser(d.user, me.isAdmin);
  return d;
}

let gisConfig = null;
function loadConfig() {
  if (!gisConfig) gisConfig = call('config');
  return gisConfig;
}

export async function googleEnabled() {
  return Boolean((await loadConfig()).googleClientId);
}

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.accounts) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new ApiError('auth/network-request-failed'));
    document.head.appendChild(s);
  });
}

export async function signInGoogle() {
  const { googleClientId } = await loadConfig();
  if (!googleClientId) throw new ApiError('auth/operation-not-allowed');
  await loadGoogleScript();
  const token = await new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: 'openid email profile',
      callback: (r) => (r.access_token ? resolve(r.access_token) : reject(new ApiError('auth/popup-closed-by-user'))),
      error_callback: () => reject(new ApiError('auth/popup-closed-by-user'))
    });
    client.requestAccessToken();
  });
  return signedIn(await call('google', { body: { access_token: token } }));
}

export async function signUpEmail(name, email, password) {
  return signedIn(await call('signup', { body: { name, email, password } }));
}

export async function signInEmail(email, password) {
  return signedIn(await call('login', { body: { email, password } }));
}

export function resetPassword(email) {
  return call('reset_request', { body: { email } });
}

// Finishes a reset started by the e-mailed link (login.html?reset=TOKEN).
export async function confirmReset(token, password) {
  return signedIn(await call('reset_confirm', { body: { token, password } }));
}

export async function signOut() {
  await call('logout', { body: {} });
  setUser(null, false);
}

export function authErrorMessage(e) {
  const map = {
    'auth/invalid-email': 'البريد الإلكتروني غير صحيح.',
    'auth/weak-password': 'كلمة المرور ضعيفة، استعمل 6 أحرف على الأقل.',
    'auth/email-already-in-use': 'هذا البريد مسجّل من قبل، سجّل الدخول بدلاً من ذلك.',
    'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة.',
    'auth/too-many-requests': 'محاولات كثيرة، انتظر قليلاً ثم حاول من جديد.',
    'auth/popup-closed-by-user': 'تم إغلاق نافذة جوجل قبل إكمال التسجيل.',
    'auth/operation-not-allowed': 'الدخول بجوجل غير مفعّل في هذا الموقع.',
    'auth/expired-action-code': 'انتهت صلاحية رابط إعادة التعيين، اطلب رابطاً جديداً.',
    'auth/network-request-failed': 'مشكلة في الاتصال بالإنترنت.',
    'db-unavailable': 'تعذر الاتصال بقاعدة البيانات (راجع api/config.php).',
    'not-configured': 'الموقع غير مُعدّ بعد (انسخ api/config.sample.php إلى api/config.php).'
  };
  return map[e && e.code] || ('حدث خطأ: ' + (e && (e.message || e.code) || e));
}

// ---------- profiles ----------

export function getProfile(uid) {
  return call('profile', { params: { uid } });
}

export function getProfileByUsername(username) {
  const name = String(username || '').toLowerCase();
  if (!USERNAME_RE.test(name)) return Promise.resolve(null);
  return call('profile_by_username', { params: { username: name } });
}

const USERNAME_PROBLEMS = {
  invalid: 'من 3 إلى 30 حرفاً: حروف إنجليزية صغيرة وأرقام و - و _ فقط.',
  reserved: 'هذا الاسم محجوز.',
  taken: 'هذا الاسم مأخوذ، جرّب اسماً آخر.'
};

export async function checkUsername(username) {
  if (!USERNAME_RE.test(username)) return USERNAME_PROBLEMS.invalid;
  const problem = await call('check_username', { params: { username } });
  return problem ? USERNAME_PROBLEMS[problem] : '';
}

export async function saveProfile(uid, data) {
  try {
    await call('save_profile', {
      body: {
        profile: {
          username: data.username, name: data.name || '', bio: data.bio || '', avatar: data.avatar || '',
          cover: data.cover || '', coverLight: coverLight(data.coverLight), theme: data.theme || 'p:gold',
          links: (data.links || []).map((l) => ({ type: l.type, value: l.value || '', label: l.label || '' }))
        }
      }
    });
  } catch (e) {
    const m = /^username-(\w+)$/.exec(e.code || '');
    if (m) throw new Error(USERNAME_PROBLEMS[m[1]] || e.message);
    throw e;
  }
}

export function recordView(uid) {
  return call('view', { body: { uid } }).catch(() => {});
}

export function getViews() {
  return call('views');
}

// ---------- cards ----------

export async function getCard(code) {
  const id = normalizeCode(code);
  if (!id) return null;
  const c = await call('card', { params: { code: id } });
  return c ? cardIn(c) : null;
}

export function recordTap(code) {
  return call('tap', { body: { code } }).catch(() => {});
}

export async function claimCard(code) {
  try {
    return cardIn(await call('claim', { body: { code: normalizeCode(code) } }));
  } catch (e) {
    if (e.code === 'card-not-found') throw new Error('رمز البطاقة غير صحيح.');
    if (e.code === 'card-taken') throw new Error('هذه البطاقة مفعّلة على حساب آخر.');
    throw e;
  }
}

export function releaseCard(code) {
  return call('release', { body: { code } });
}

export async function myCards() {
  return (await call('my_cards')).map(cardIn);
}

// ---------- admin ----------

export async function isAdmin() {
  await ready;
  return admin;
}

export function createCards(count, note) {
  return call('admin_create', { body: { count, note } });
}

export async function listCards() {
  return (await call('admin_cards')).map(cardIn);
}

export function updateCardNote(code, note) {
  return call('admin_note', { body: { code, note } });
}

export function listCustomers() {
  return call('admin_customers');
}

export function resetCard(code) {
  return call('admin_reset', { body: { code } });
}

export function deleteCard(code) {
  return call('admin_delete', { body: { code } });
}

// ---------- links ----------

export function siteBase() {
  return new URL('./', location.href).href;
}

export function profileUrl(username) {
  return siteBase() + '?u=' + encodeURIComponent(username);
}

export function cardUrl(code) {
  return siteBase() + '?c=' + encodeURIComponent(code);
}

// Test builds only: lets the end-to-end tests probe what a signed-in user may do.
if (import.meta.env.VITE_TEST) {
  window.__test = {
    backend: 'php',
    db: { currentUser, createCards, listCards, listCustomers, saveProfile, claimCard },
    async probe(otherUid, codes) {
      const tryIt = async (fn) => { try { await fn(); return 'allowed'; } catch (e) { return e.code || e.message; } };
      const uid = user.uid;
      return {
        createCards: await tryIt(() => createCards(1)),
        listAllCards: await tryIt(() => listCards()),
        listCustomers: await tryIt(() => listCustomers()),
        stealUsername: await tryIt(() => saveProfile(uid, { username: 'seller', name: 'x', links: [] })),
        editCardNote: await tryIt(() => updateCardNote(codes[0], 'x')),
        resetCard: await tryIt(() => resetCard(codes[0])),
        deleteCard: await tryIt(() => deleteCard(codes[2])),
        postWithoutHeader: await tryIt(async () => {
          const r = await fetch(API + '?action=admin_create', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{"count":1}' });
          const j = await r.json();
          if (!j.ok) throw new ApiError(j.error.code);
        }),
        claimSecondCard: await tryIt(() => claimCard(codes[1]))
      };
    }
  };
}
