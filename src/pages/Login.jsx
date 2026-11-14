// login.html: Google or email sign-in and sign-up.
import { useEffect, useState } from 'react';
import * as db from '@data';
import { Icon, Logo, NfcCardArt } from '../components/ui.jsx';

const params = new URLSearchParams(location.search);
// Only follow relative links to our own pages after login.
const nextParam = params.get('next') || '';
const NEXT = /^[a-z]+\.html(\?[\w=&%-]*)?$/i.test(nextParam) ? nextParam : 'app.html';
const FROM_CARD = /activate=/.test(NEXT);
// Password-reset links from the cPanel edition's e-mail: login.html?reset=TOKEN
const RESET_TOKEN = db.confirmReset ? params.get('reset') : null;

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="g-logo">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function Login() {
  const [mode, setMode] = useState(params.get('mode') === 'signup' ? 'signup' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState({ text: '', kind: '' });
  const [busy, setBusy] = useState(false);
  const [google, setGoogle] = useState(true);
  const signup = mode === 'signup';

  useEffect(() => {
    if (!db.isConfigured) {
      setStatus({ text: 'الموقع غير مُعدّ بعد (راجع README).', kind: 'err' });
      setBusy(true);
      return undefined;
    }
    db.googleEnabled().then(setGoogle, () => setGoogle(false));
    if (RESET_TOKEN) return undefined;
    return db.onUser((user) => { if (user) location.replace(NEXT); });
  }, []);

  async function finishReset(e) {
    e.preventDefault();
    if (password.length < 6) return setStatus({ text: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.', kind: 'err' });
    setBusy(true);
    try {
      await db.confirmReset(RESET_TOKEN, password);
      location.replace('app.html');
    } catch (err) {
      setStatus({ text: db.authErrorMessage(err), kind: 'err' });
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(signup ? 'login' : 'signup');
    setStatus({ text: '', kind: '' });
  }

  async function googleSignIn() {
    setBusy(true);
    setStatus({ text: '', kind: '' });
    try { await db.signInGoogle(); } catch (e) { setStatus({ text: db.authErrorMessage(e), kind: 'err' }); }
    setBusy(false);
  }

  async function submit(e) {
    e.preventDefault();
    if (!email.trim()) return setStatus({ text: 'اكتب بريدك الإلكتروني.', kind: 'err' });
    if (password.length < 6) return setStatus({ text: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.', kind: 'err' });
    setBusy(true);
    setStatus({ text: 'لحظة…', kind: '' });
    try {
      if (signup) await db.signUpEmail(name.trim(), email.trim(), password);
      else await db.signInEmail(email.trim(), password);
    } catch (err) {
      setStatus({ text: db.authErrorMessage(err), kind: 'err' });
    }
    setBusy(false);
  }

  async function forgot(e) {
    e.preventDefault();
    if (!email.trim()) return setStatus({ text: 'اكتب بريدك الإلكتروني أولاً، ثم اضغط "نسيت كلمة المرور".', kind: 'err' });
    try {
      await db.resetPassword(email.trim());
      setStatus({ text: 'أرسلنا رابط إعادة تعيين كلمة المرور إلى بريدك.', kind: 'ok' });
    } catch (err) {
      setStatus({ text: db.authErrorMessage(err), kind: 'err' });
    }
  }

  if (RESET_TOKEN) {
    return (
      <div className="auth">
        <main className="auth-main">
          <div className="auth-top"><Logo /></div>
          <div className="auth-form">
            <h1>كلمة مرور جديدة</h1>
            <p className="sub">اختر كلمة مرور جديدة لحسابك.</p>
            <form id="reset-form" onSubmit={finishReset} noValidate>
              <div className="field">
                <label className="label" htmlFor="new-password">كلمة المرور الجديدة</label>
                <input className="input ltr" id="new-password" type="password" dir="ltr" autoComplete="new-password"
                  placeholder="6 أحرف على الأقل" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button className="btn btn-gold btn-lg btn-block" type="submit" disabled={busy}>حفظ ومتابعة</button>
              {status.text && <p className={'status ' + status.kind} id="status">{status.text}</p>}
            </form>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="auth">
      <main className="auth-main">
        <div className="auth-top"><Logo /></div>
        <div className="auth-form">
          <h1>{signup ? 'أنشئ حسابك' : 'مرحباً بعودتك'}</h1>
          <p className="sub">{signup ? 'ابدأ صفحتك الاحترافية مجاناً في أقل من دقيقة.' : 'سجّل الدخول لإدارة صفحتك وبطاقاتك.'}</p>

          {FROM_CARD && (
            <div className="alert gold"><Icon name="credit-card" /><span>بعد الدخول ستُربط بطاقتك بحسابك تلقائياً.</span></div>
          )}

          {google && (
            <>
              <button type="button" className="btn btn-google" id="google" onClick={googleSignIn} disabled={busy}>
                <GoogleLogo />المتابعة بحساب Google
              </button>
              <div className="divider">أو بالبريد الإلكتروني</div>
            </>
          )}

          <form id="form" onSubmit={submit} noValidate>
            {signup && (
              <div className="field" id="name-field">
                <label className="label" htmlFor="name">الاسم الكامل</label>
                <input className="input" id="name" autoComplete="name" placeholder="مثال: عبد الرؤوف"
                  value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div className="field">
              <label className="label" htmlFor="email">البريد الإلكتروني</label>
              <input className="input ltr" id="email" type="email" dir="ltr" autoComplete="email" placeholder="name@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label className="label" htmlFor="password">
                كلمة المرور
                {!signup && <a href="#" className="forgot" onClick={forgot}>نسيت كلمة المرور؟</a>}
              </label>
              <input className="input ltr" id="password" type="password" dir="ltr"
                autoComplete={signup ? 'new-password' : 'current-password'}
                placeholder={signup ? '6 أحرف على الأقل' : '••••••••'}
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn btn-gold btn-lg btn-block" type="submit" id="submit" disabled={busy}>
              {signup ? 'إنشاء الحساب' : 'تسجيل الدخول'}
            </button>
            {status.text && <p className={'status ' + status.kind} id="status">{status.text}</p>}
          </form>

          <p className="auth-switch" id="switch">
            {signup ? 'لديك حساب؟ ' : 'ليس لديك حساب؟ '}
            <button type="button" onClick={switchMode}>{signup ? 'سجّل الدخول' : 'أنشئ حساباً مجاناً'}</button>
          </p>
        </div>
      </main>

      <aside className="auth-side">
        <div className="auth-side-glow" />
        <Logo />
        <div className="auth-side-art">
          <NfcCardArt variant="gold" className="tilt-a" />
          <NfcCardArt variant="black" className="tilt-b" />
        </div>
        <div>
          <h2>بطاقتك الذكية،<br /><span className="gold-text">بلمسة واحدة.</span></h2>
          <ul>
            <li><Icon name="check" />صفحة روابط بتصميم فاخر</li>
            <li><Icon name="check" />زر حفظ جهة الاتصال مباشرة</li>
            <li><Icon name="check" />إحصائيات الزيارات واللمسات</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
