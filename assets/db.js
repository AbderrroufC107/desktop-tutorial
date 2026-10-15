// All Firebase access lives here so the pages only deal with plain data.
import { firebaseConfig } from './firebase-config.js?v=20261015';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail,
  updateProfile, signOut as fbSignOut, connectAuthEmulator
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, collection, query, where,
  orderBy, limit, increment, serverTimestamp, connectFirestoreEmulator
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let auth = null;
let db = null;

if (isConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  auth.languageCode = 'ar';
  db = getFirestore(app);
  if (firebaseConfig.useEmulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
}

export const USERNAME_RE = /^[a-z0-9_-]{3,30}$/;
const RESERVED = new Set(['admin', 'login', 'app', 'api', 'www', 'help', 'support', 'mylink', 'settings']);

// Card codes avoid look-alike characters (0/O, 1/I/L) so they can be typed by hand.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function newCardCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, function (b) { return CODE_ALPHABET[b % CODE_ALPHABET.length]; }).join('');
}

export function normalizeCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// ---------- auth ----------

export function onUser(cb) {
  return onAuthStateChanged(auth, cb);
}

export function currentUser() {
  return auth.currentUser;
}

export async function signInGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    return await signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      return signInWithRedirect(auth, provider);
    }
    throw e;
  }
}

export async function signUpEmail(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
  return cred;
}

export function signInEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

export function signOut() {
  return fbSignOut(auth);
}

export function authErrorMessage(e) {
  const map = {
    'auth/invalid-email': 'البريد الإلكتروني غير صحيح.',
    'auth/missing-password': 'اكتب كلمة المرور.',
    'auth/weak-password': 'كلمة المرور ضعيفة، استعمل 6 أحرف على الأقل.',
    'auth/email-already-in-use': 'هذا البريد مسجّل من قبل، سجّل الدخول بدلاً من ذلك.',
    'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة.',
    'auth/wrong-password': 'البريد أو كلمة المرور غير صحيحة.',
    'auth/user-not-found': 'لا يوجد حساب بهذا البريد.',
    'auth/too-many-requests': 'محاولات كثيرة، انتظر قليلاً ثم حاول من جديد.',
    'auth/popup-closed-by-user': 'تم إغلاق نافذة جوجل قبل إكمال التسجيل.',
    'auth/cancelled-popup-request': 'تم إلغاء العملية.',
    'auth/unauthorized-domain': 'هذا النطاق غير مضاف في Firebase (Authentication → Settings → Authorized domains).',
    'auth/network-request-failed': 'مشكلة في الاتصال بالإنترنت.'
  };
  return map[e && e.code] || ('حدث خطأ: ' + (e && (e.code || e.message) || e));
}

// ---------- profiles ----------

export async function getProfile(uid) {
  const snap = await getDoc(doc(db, 'profiles', uid));
  return snap.exists() ? snap.data() : null;
}

export async function getProfileByUsername(username) {
  const name = String(username || '').toLowerCase();
  if (!USERNAME_RE.test(name)) return null;
  const snap = await getDoc(doc(db, 'usernames', name));
  if (!snap.exists()) return null;
  const uid = snap.data().uid;
  const profile = await getProfile(uid);
  return profile ? { uid: uid, profile: profile } : null;
}

// Returns '' when the name is usable, otherwise the reason it is not.
export async function checkUsername(username, uid) {
  if (!USERNAME_RE.test(username)) return 'من 3 إلى 30 حرفاً: حروف إنجليزية صغيرة وأرقام و - و _ فقط.';
  if (RESERVED.has(username)) return 'هذا الاسم محجوز.';
  const snap = await getDoc(doc(db, 'usernames', username));
  if (snap.exists() && snap.data().uid !== uid) return 'هذا الاسم مأخوذ، جرّب اسماً آخر.';
  return '';
}

// Saves the profile and moves the username reservation in one atomic write.
export async function saveProfile(uid, data, previousUsername) {
  const username = data.username;
  const problem = await checkUsername(username, uid);
  if (problem) throw new Error(problem);

  const batch = writeBatch(db);
  batch.set(doc(db, 'profiles', uid), {
    username: username,
    name: String(data.name || '').slice(0, 80),
    bio: String(data.bio || '').slice(0, 300),
    avatar: String(data.avatar || ''),
    theme: String(data.theme || '#6d28d9').slice(0, 9),
    links: (data.links || []).slice(0, 30).map(function (l) {
      return { type: String(l.type), value: String(l.value || '').slice(0, 300), label: String(l.label || '').slice(0, 60) };
    }),
    updatedAt: serverTimestamp()
  });
  if (previousUsername !== username) {
    batch.set(doc(db, 'usernames', username), { uid: uid });
    if (previousUsername) batch.delete(doc(db, 'usernames', previousUsername));
  }
  await batch.commit();
}

// ---------- stats ----------

export function recordView(uid) {
  return setDoc(doc(db, 'stats', uid), { views: increment(1) }, { merge: true }).catch(function () {});
}

export async function getViews(uid) {
  const snap = await getDoc(doc(db, 'stats', uid));
  return snap.exists() ? snap.data().views || 0 : 0;
}

// ---------- cards ----------

export async function getCard(code) {
  const id = normalizeCode(code);
  if (!id) return null;
  const snap = await getDoc(doc(db, 'cards', id));
  return snap.exists() ? Object.assign({ id: id }, snap.data()) : null;
}

export function recordTap(code) {
  return updateDoc(doc(db, 'cards', code), { taps: increment(1) }).catch(function () {});
}

export async function claimCard(code, uid) {
  const card = await getCard(code);
  if (!card) throw new Error('رمز البطاقة غير صحيح.');
  if (card.owner === uid) return card;
  if (card.owner) throw new Error('هذه البطاقة مفعّلة على حساب آخر.');
  await updateDoc(doc(db, 'cards', card.id), { owner: uid, activatedAt: serverTimestamp() });
  return card;
}

export async function releaseCard(code) {
  await updateDoc(doc(db, 'cards', code), { owner: null, activatedAt: null });
}

export async function myCards(uid) {
  const snap = await getDocs(query(collection(db, 'cards'), where('owner', '==', uid)));
  return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
}

// ---------- admin ----------

export async function isAdmin(uid) {
  try {
    return (await getDoc(doc(db, 'admins', uid))).exists();
  } catch (e) {
    return false;
  }
}

export async function createCards(count, note) {
  const batch = writeBatch(db);
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = newCardCode();
    codes.push(code);
    batch.set(doc(db, 'cards', code), {
      owner: null, taps: 0, note: String(note || '').slice(0, 80),
      createdAt: serverTimestamp(), activatedAt: null
    });
  }
  await batch.commit();
  return codes;
}

export async function listCards() {
  const snap = await getDocs(query(collection(db, 'cards'), orderBy('createdAt', 'desc'), limit(500)));
  return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
}

export async function resetCard(code) {
  await updateDoc(doc(db, 'cards', code), { owner: null, activatedAt: null, taps: 0 });
}

export async function deleteCard(code) {
  await deleteDoc(doc(db, 'cards', code));
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
