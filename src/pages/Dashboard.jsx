// app.html: onboarding and the customer dashboard.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as db from '../lib/db.js';
import ProfileView from '../components/ProfileView.jsx';
import { Icon, Logo, Phone, PlatformBadge, Spinner, useToast } from '../components/ui.jsx';
import {
  DEFAULT_THEME, PLATFORMS, THEMES, cleanUsername, copyText, downloadText, initials, linkUrl, qrSvg,
  resizeImage, safeImage, themeKey, writeNfc
} from '../lib/utils.js';

const params = new URLSearchParams(location.search);

// Fields that make up a saved profile, in a stable order for comparisons.
function pick(p) {
  return {
    username: p.username || '', name: p.name || '', bio: p.bio || '', avatar: p.avatar || '', theme: p.theme || DEFAULT_THEME,
    links: (p.links || []).map((l) => ({ type: l.type, value: l.value || '', label: l.label || '' }))
  };
}

function shortUrl(username) {
  return db.profileUrl(username).replace(/^https?:\/\//, '');
}

// Debounced availability check for a username field.
function useUsernameCheck(value, uid, current) {
  const [state, setState] = useState({ text: '', kind: '', ok: true });
  useEffect(() => {
    if (!uid) return undefined;
    if (value === current) { setState({ text: '', kind: '', ok: true }); return undefined; }
    setState({ text: 'جارٍ التحقق…', kind: '', ok: false });
    let alive = true;
    const t = setTimeout(async () => {
      const problem = await db.checkUsername(value, uid);
      if (alive) setState({ text: problem || 'الاسم متاح ✓', kind: problem ? 'err' : 'ok', ok: !problem });
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [value, uid, current]);
  return state;
}

function UserPill({ user, profile }) {
  const name = (profile && profile.name) || user.displayName || user.email || '';
  const src = safeImage((profile && profile.avatar) || user.photoURL);
  return (
    <div className="user-pill" id="user-pill">
      <span id="who">{name}</span>
      <div className="av">{src ? <img src={src} alt="" referrerPolicy="no-referrer" /> : initials(name)}</div>
    </div>
  );
}

function Onboarding({ user, onDone }) {
  const suggested = cleanUsername((user.email || '').split('@')[0]);
  const [username, setUsername] = useState(suggested.length >= 3 ? suggested.slice(0, 30) : '');
  const [name, setName] = useState(user.displayName || '');
  const [status, setStatus] = useState({ text: '', kind: '' });
  const [busy, setBusy] = useState(false);
  const check = useUsernameCheck(username, user.uid, null);
  const preview = shortUrl(username || 'yourname');
  const cut = preview.lastIndexOf(username || 'yourname');

  async function create() {
    setBusy(true);
    setStatus({ text: 'جارٍ إنشاء صفحتك…', kind: '' });
    try {
      const profile = pick({ username, name: name.trim() || username, avatar: user.photoURL || '', theme: DEFAULT_THEME, links: [] });
      await db.saveProfile(user.uid, profile, null);
      onDone(profile);
    } catch (e) {
      setStatus({ text: e.message || String(e), kind: 'err' });
      setBusy(false);
    }
  }

  return (
    <section className="onboard" id="onboarding">
      <div className="card onboard-card">
        <div className="onboard-mark"><Icon name="sparkles" /></div>
        <h1>لنُنشئ صفحتك</h1>
        <p className="sub">اختر اسم مستخدم مميزاً، سيكون جزءاً من رابط صفحتك.</p>
        <div className="field">
          <label className="label" htmlFor="ob-username">اسم المستخدم</label>
          <div className="input-group" dir="ltr">
            <span className="addon">@</span>
            <input id="ob-username" value={username} maxLength={30} autoComplete="off" autoCapitalize="none" spellCheck="false"
              placeholder="yourname" onChange={(e) => setUsername(cleanUsername(e.target.value))} autoFocus />
          </div>
          {check.text && <p className={'status ' + check.kind} id="ob-check">{check.text}</p>}
          <div className="link-preview"><Icon name="link" /><span>{preview.slice(0, cut)}<b>{username || 'yourname'}</b></span></div>
        </div>
        <div className="field">
          <label className="label" htmlFor="ob-name">الاسم الذي يظهر في صفحتك</label>
          <input className="input" id="ob-name" maxLength={80} placeholder="مثال: عبد الرؤوف شنة"
            value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button className="btn btn-gold btn-lg btn-block" id="ob-save" type="button" disabled={busy || !check.ok} onClick={create}>
          إنشاء صفحتي
        </button>
        {status.text && <p className={'status ' + status.kind} id="ob-status">{status.text}</p>}
      </div>
    </section>
  );
}

function ContentTab({ draft, setDraft, user, saved, usernameCheck }) {
  const fileRef = useRef(null);
  const focusLast = useRef(false);
  const lastInput = useRef(null);
  const toast = useToast();

  useEffect(() => {
    if (focusLast.current && lastInput.current) {
      lastInput.current.focus();
      lastInput.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
      focusLast.current = false;
    }
  });

  const set = (k, v) => setDraft({ ...draft, [k]: v });
  const setLink = (i, patch) => set('links', draft.links.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= draft.links.length) return;
    const links = draft.links.slice();
    links.splice(j, 0, links.splice(i, 1)[0]);
    set('links', links);
  };

  async function pickAvatar(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try { set('avatar', await resizeImage(file, 256)); } catch (err) { toast(err.message, 'err'); }
  }

  function addLink(type) {
    if (draft.links.length >= 30) return toast('الحد الأقصى 30 رابطاً.', 'err');
    focusLast.current = true;
    set('links', [...draft.links, { type, value: '', label: '' }]);
  }

  const avatar = safeImage(draft.avatar);

  return (
    <div data-panel="content">
      <section className="card">
        <div className="profile-head">
          <div className="avatar-edit">
            <div className="av" id="avatar-preview">{avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : initials(draft.name)}</div>
            <button className="cam" type="button" title="تغيير الصورة" aria-label="تغيير الصورة" onClick={() => fileRef.current.click()}>
              <Icon name="image" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickAvatar} />
          </div>
          <div>
            <h2 className="card-title">الصورة الشخصية</h2>
            <p className="card-sub">صورة مربعة واضحة لوجهك أو شعارك.</p>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn btn-sm" type="button" onClick={() => fileRef.current.click()}>رفع صورة</button>
              {draft.avatar && <button className="btn btn-sm btn-ghost btn-danger" type="button" onClick={() => set('avatar', '')}>إزالة</button>}
            </div>
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="name">الاسم</label>
          <input className="input" id="name" maxLength={80} value={draft.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="bio">نبذة قصيرة</label>
          <textarea className="input" id="bio" rows={2} maxLength={300} placeholder="مثال: مصمم جرافيك · الجزائر"
            value={draft.bio} onChange={(e) => set('bio', e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="label" htmlFor="username">اسم المستخدم</label>
          <div className="input-group" dir="ltr">
            <span className="addon">@</span>
            <input id="username" maxLength={30} autoComplete="off" autoCapitalize="none" spellCheck="false"
              value={draft.username} onChange={(e) => set('username', cleanUsername(e.target.value))} />
          </div>
          {usernameCheck.text && <p className={'status ' + usernameCheck.kind} id="username-check">{usernameCheck.text}</p>}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">روابطك</h2>
            <p className="card-sub">اكتب اسم المستخدم أو الرقم فقط، ونكوّن الرابط تلقائياً.</p>
          </div>
        </div>
        <div className="link-list" id="links">
          {draft.links.length === 0 && (
            <div className="empty"><Icon name="link" /><div>لا توجد روابط بعد — اختر منصة من الأسفل لإضافتها.</div></div>
          )}
          {draft.links.map((l, i) => {
            const p = PLATFORMS[l.type];
            return (
              <div className="link-item" key={i}>
                <PlatformBadge type={l.type} />
                <div className="fields">
                  <div className="name">{p.label}</div>
                  <input className="input" dir="ltr" placeholder={p.hint} aria-label={p.label} value={l.value}
                    ref={i === draft.links.length - 1 ? lastInput : undefined}
                    onChange={(e) => setLink(i, { value: e.target.value })} />
                  <input className="input" maxLength={60} placeholder={'نص الزر: ' + p.label} value={l.label}
                    onChange={(e) => setLink(i, { label: e.target.value })} />
                </div>
                <div className="tools">
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" title="لأعلى" aria-label="لأعلى" onClick={() => move(i, -1)}><Icon name="chevron-up" /></button>
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" title="لأسفل" aria-label="لأسفل" onClick={() => move(i, 1)}><Icon name="chevron-down" /></button>
                  <button type="button" className="btn btn-ghost btn-icon btn-sm btn-danger" title="حذف" aria-label="حذف"
                    onClick={() => set('links', draft.links.filter((_, j) => j !== i))}><Icon name="trash-2" /></button>
                </div>
              </div>
            );
          })}
        </div>
        <h3 className="label" style={{ margin: '22px 0 10px' }}>أضف رابطاً</h3>
        <div className="platform-grid" id="platforms">
          {Object.keys(PLATFORMS).map((type) => (
            <button key={type} type="button" className="platform-btn" onClick={() => addLink(type)}>
              <PlatformBadge type={type} size={38} />{PLATFORMS[type].label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function DesignTab({ draft, setDraft }) {
  const current = themeKey(draft.theme);
  const color = current === 'custom' ? draft.theme : '#d4af6a';
  return (
    <div data-panel="design">
      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">تصميم الصفحة</h2>
            <p className="card-sub">اختر الشكل الذي يناسبك، وتظهر المعاينة فوراً.</p>
          </div>
        </div>
        <div className="theme-grid" id="themes">
          {Object.entries(THEMES).map(([key, t]) => (
            <button key={key} type="button" className={'theme-opt' + (current === key ? ' active' : '') + (t.dark ? '' : ' light-sw')}
              onClick={() => setDraft({ ...draft, theme: 'p:' + key })}>
              <div className="sw" style={{ background: t.swatch }}><i /><i /><i /><i /></div>
              <span>{t.label}</span>
            </button>
          ))}
          <label className={'theme-opt' + (current === 'custom' ? ' active' : '')}>
            <div className="sw" style={{ background: `radial-gradient(circle at 50% 0%, ${color}66, transparent 70%), #0e0e10` }}><i /><i /><i /><i /></div>
            <span>لونك الخاص</span>
            <input type="color" aria-label="لون مخصص" value={color} onChange={(e) => setDraft({ ...draft, theme: e.target.value })} />
          </label>
        </div>
      </section>
    </div>
  );
}

function ShareTab({ saved }) {
  const toast = useToast();
  const url = db.profileUrl(saved.username);
  const svg = useMemo(() => qrSvg(url), [url]);

  async function nfc() {
    toast('قرّب بطاقة NFC من ظهر الهاتف الآن…');
    try { await writeNfc(url); toast('تمت كتابة الرابط على البطاقة ✓'); } catch (e) { toast(e.message || String(e), 'err'); }
  }

  return (
    <div data-panel="share">
      <section className="card">
        <div className="share-grid">
          <div className="qr-box" id="qr" dangerouslySetInnerHTML={{ __html: svg }} />
          <div>
            <h2 className="card-title">شارك صفحتك</h2>
            <p className="card-sub">اطبع رمز QR، أو انسخ الرابط وضعه في البايو، أو اكتبه على بطاقة NFC.</p>
            <div className="share-actions">
              <button className="btn" id="copy" type="button"
                onClick={() => copyText(url).then(() => toast('تم نسخ الرابط ✓'), () => toast('تعذر النسخ، انسخ الرابط يدوياً.', 'err'))}>
                <Icon name="copy" />نسخ الرابط
              </button>
              <button className="btn" id="dl-qr" type="button" onClick={() => downloadText('nfcrs-' + saved.username + '-qr.svg', svg, 'image/svg+xml')}>
                <Icon name="download" />تحميل QR
              </button>
              <button className="btn btn-gold" id="nfc" type="button" style={{ gridColumn: '1 / -1' }} onClick={nfc}>
                <Icon name="nfc" />كتابة الرابط على بطاقة NFC
              </button>
            </div>
          </div>
        </div>
      </section>
      <section className="card">
        <h2 className="card-title" style={{ marginBottom: 12 }}>الكتابة على بطاقة NFC</h2>
        <div className="nfc-howto">
          <div><b>أندرويد</b>افتح هذه الصفحة في Chrome، اضغط "كتابة الرابط على بطاقة NFC" وقرّب البطاقة.</div>
          <div><b>آيفون</b>انسخ الرابط، ثم استعمل تطبيق NFC Tools: Write ← Add record ← URL.</div>
          <div><b>بطاقة NFC RS</b>إن اشتريت بطاقة منا فهي جاهزة — فعّلها من تبويب "بطاقاتي".</div>
        </div>
      </section>
    </div>
  );
}

function CardsTab({ cards, onActivate, onRelease, status }) {
  const [code, setCode] = useState('');
  return (
    <div data-panel="cards">
      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">بطاقاتي</h2>
            <p className="card-sub">كل بطاقة مفعّلة على حسابك تفتح صفحتك عند لمسها.</p>
          </div>
        </div>
        <div className="card-list" id="cards">
          {cards.length === 0 && (
            <div className="empty"><Icon name="credit-card" /><div>لا توجد بطاقات مفعّلة بعد. المس بطاقتك بهاتفك أو اكتب رمزها هنا.</div></div>
          )}
          {cards.map((c) => (
            <div className="card-item" key={c.id}>
              <div className="mini-card"><Icon name="nfc" /></div>
              <div className="meta"><div className="code">{c.id}</div><div>{c.taps || 0} لمسة</div></div>
              <span className="chip ok">مفعّلة</span>
              <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={() => onRelease(c.id)}>فصل</button>
            </div>
          ))}
        </div>
        <form className="activate-inline" id="activate-form"
          onSubmit={(e) => { e.preventDefault(); const c = db.normalizeCode(code); if (c) onActivate(c).then((ok) => ok && setCode('')); }}>
          <input className="input code-input" id="activate-code" placeholder="رمز البطاقة" autoComplete="off" maxLength={12}
            aria-label="رمز البطاقة" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn btn-gold" type="submit">تفعيل بطاقة</button>
        </form>
        {status.text && <p className={'status ' + status.kind} id="card-status">{status.text}</p>}
      </section>
    </div>
  );
}

const TABS = [
  { key: 'content', icon: 'pencil', label: 'المحتوى' },
  { key: 'design', icon: 'palette', label: 'التصميم' },
  { key: 'share', icon: 'qr-code', label: 'المشاركة' },
  { key: 'cards', icon: 'credit-card', label: 'بطاقاتي' }
];

export default function Dashboard() {
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [tab, setTab] = useState('content');
  const [views, setViews] = useState(0);
  const [cards, setCards] = useState([]);
  const [banner, setBanner] = useState(null);
  const [cardStatus, setCardStatus] = useState({ text: '', kind: '' });
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(() => saved && draft && JSON.stringify(pick(saved)) !== JSON.stringify(pick(draft)), [saved, draft]);
  const usernameCheck = useUsernameCheck(draft ? draft.username : '', user && user.uid, saved && saved.username);

  useEffect(() => {
    if (!db.isConfigured) { setError('الموقع غير مُعدّ بعد: أضف إعدادات Firebase (راجع README).'); return undefined; }
    return db.onUser(async (u) => {
      if (!u) {
        location.replace('login.html?next=' + encodeURIComponent('app.html' + location.search));
        return;
      }
      setUser(u);
      db.isAdmin(u.uid).then(setIsAdmin);
      try {
        const profile = await db.getProfile(u.uid);
        if (profile) openDashboard(u, profile);
        else setPhase('onboarding');
      } catch (e) {
        console.error(e);
        setError('تعذر تحميل حسابك: ' + (e.message || e));
      }
    });
  }, []);

  useEffect(() => {
    const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function loadCards(uid) {
    setCards(await db.myCards(uid).catch(() => []));
  }

  async function openDashboard(u, profile) {
    const p = pick(profile);
    setSaved(p);
    setDraft(p);
    setPhase('dashboard');
    db.getViews(u.uid).then(setViews, () => {});
    await loadCards(u.uid);
    const pending = params.get('activate');
    if (pending) {
      history.replaceState(null, '', 'app.html');
      await activate(pending, u);
    }
  }

  async function activate(code, u = user) {
    setCardStatus({ text: 'جارٍ التفعيل…', kind: '' });
    try {
      const card = await db.claimCard(code, u.uid);
      setBanner({ kind: 'ok', text: 'تم تفعيل البطاقة ' + card.id + ' — من الآن، عند لمسها تفتح صفحتك.' });
      setCardStatus({ text: '', kind: '' });
      await loadCards(u.uid);
      return true;
    } catch (e) {
      setCardStatus({ text: e.message || String(e), kind: 'err' });
      setBanner({ kind: 'err', text: e.message || String(e) });
      return false;
    }
  }

  async function release(code) {
    if (!confirm('بعد الفصل لن تفتح هذه البطاقة صفحتك، ويمكن لأي شخص تفعيلها. متأكد؟')) return;
    await db.releaseCard(code);
    toast('تم فصل البطاقة');
    loadCards(user.uid);
  }

  async function save() {
    if (draft.username !== saved.username && !usernameCheck.ok) {
      const problem = await db.checkUsername(draft.username, user.uid);
      if (problem) { setTab('content'); toast(problem, 'err'); return; }
    }
    setSaving(true);
    try {
      const data = pick({ ...draft, links: draft.links.filter((l) => String(l.value || '').trim()) });
      await db.saveProfile(user.uid, data, saved.username);
      setSaved(data);
      setDraft(data);
      toast('تم حفظ التغييرات ✓');
    } catch (e) {
      console.error(e);
      toast('فشل الحفظ: ' + (e.message || e), 'err');
    }
    setSaving(false);
  }

  async function logout() {
    if (dirty && !confirm('لديك تغييرات غير محفوظة. هل تريد الخروج؟')) return;
    await db.signOut();
  }

  const header = (
    <header className="topbar">
      <div className="container">
        <Logo />
        <div className="row">
          {isAdmin && <a className="btn btn-ghost btn-sm" id="admin-link" href="admin.html"><Icon name="layout-dashboard" />إدارة البطاقات</a>}
          {user && <UserPill user={user} profile={saved} />}
          {user && (
            <button className="btn btn-ghost btn-icon" id="logout" type="button" title="تسجيل الخروج" aria-label="تسجيل الخروج" onClick={logout}>
              <Icon name="log-out" />
            </button>
          )}
        </div>
      </div>
    </header>
  );

  if (error) return <>{header}<Spinner text={error} /></>;
  if (phase === 'loading') return <>{header}<Spinner /></>;
  if (phase === 'onboarding') return <>{header}<Onboarding user={user} onDone={(p) => openDashboard(user, p)} /></>;

  const url = db.profileUrl(saved.username);
  const short = shortUrl(saved.username);
  const cut = short.lastIndexOf(saved.username);
  const taps = cards.reduce((n, c) => n + (c.taps || 0), 0);
  const linkCount = draft.links.filter((l) => linkUrl(l)).length;

  return (
    <>
      {header}
      <main className="dash" id="dashboard">
        <div className="container">
          <div className="dash-head">
            <div>
              <h1 id="hello">مرحباً، {(draft.name || '').split(' ')[0]}</h1>
              <p>صمّم صفحتك، وشاركها، وأدِر بطاقاتك من هنا.</p>
            </div>
            <div className="mylink-bar">
              <span className="url" id="my-url">{short.slice(0, cut)}<b>{saved.username}</b></span>
              <button className="btn btn-sm" id="copy-top" type="button"
                onClick={() => copyText(url).then(() => toast('تم نسخ الرابط ✓'), () => toast('تعذر النسخ', 'err'))}>
                <Icon name="copy" />نسخ
              </button>
              <a className="btn btn-sm btn-gold" id="open-top" href={url} target="_blank" rel="noopener noreferrer"><Icon name="external-link" />عرض</a>
            </div>
          </div>

          {banner && (
            <div className={'alert ' + banner.kind} id="banner" style={{ marginBottom: 16 }}>
              <Icon name={banner.kind === 'err' ? 'zap' : 'circle-check'} /><span>{banner.text}</span>
            </div>
          )}

          <div className="stat-row">
            <div className="stat"><div className="ic"><Icon name="eye" /></div><div><b id="views">{views}</b><span>زيارة للصفحة</span></div></div>
            <div className="stat"><div className="ic"><Icon name="nfc" /></div><div><b id="taps">{taps}</b><span>لمسة للبطاقات</span></div></div>
            <div className="stat"><div className="ic"><Icon name="link" /></div><div><b id="link-count">{linkCount}</b><span>رابط في صفحتك</span></div></div>
          </div>

          <div className="dash-grid">
            <div>
              <div className="tabs" role="tablist">
                {TABS.map((t) => (
                  <button key={t.key} type="button" data-tab={t.key} className={'tab' + (tab === t.key ? ' active' : '')} onClick={() => setTab(t.key)}>
                    <Icon name={t.icon} />{t.label}
                  </button>
                ))}
              </div>
              {tab === 'content' && <ContentTab draft={draft} setDraft={setDraft} user={user} saved={saved} usernameCheck={usernameCheck} />}
              {tab === 'design' && <DesignTab draft={draft} setDraft={setDraft} />}
              {tab === 'share' && <ShareTab saved={saved} />}
              {tab === 'cards' && <CardsTab cards={cards} onActivate={(c) => activate(c)} onRelease={release} status={cardStatus} />}
            </div>
            <aside className="dash-preview">
              <Phone><ProfileView data={draft} /></Phone>
              <p className="caption">معاينة مباشرة لصفحتك</p>
            </aside>
          </div>
        </div>
      </main>

      <div className={'save-bar' + (dirty ? ' show' : '')} id="save-bar">
        <span className="msg" id="save-msg">{saving ? 'جارٍ الحفظ…' : 'تغييرات غير محفوظة'}</span>
        <button className="btn btn-sm btn-ghost" id="discard" type="button" onClick={() => { setDraft(saved); toast('تم التراجع عن التغييرات'); }}>تراجع</button>
        <button className="btn btn-sm btn-gold" id="save" type="button" disabled={saving} onClick={save}>حفظ التغييرات</button>
      </div>
    </>
  );
}
