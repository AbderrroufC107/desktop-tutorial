// admin.html: create, track, program and print the NFC cards you sell, and see your customers.
import { useEffect, useMemo, useState } from 'react';
import * as db from '@data';
import { Icon, Logo, Spinner, StateCard, useToast } from '../components/ui.jsx';
import { copyText, downloadText, initials, linkUrl, qrSvg, safeImage, writeNfc } from '../lib/utils.js';

function fmtDate(ts) {
  if (!ts || !ts.toDate) return '—';
  return ts.toDate().toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function useNfc(toast) {
  return async (code) => {
    toast('قرّب البطاقة ' + code + ' من ظهر الهاتف…');
    try { await writeNfc(db.cardUrl(code)); toast('تمت كتابة البطاقة ' + code + ' ✓'); } catch (e) { toast(e.message || String(e), 'err'); }
  };
}

// Large QR + link for one card, with download / copy / NFC.
function CardModal({ card, owner, onClose }) {
  const toast = useToast();
  const nfc = useNfc(toast);
  const url = db.cardUrl(card.id);
  const svg = useMemo(() => qrSvg(url), [url]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={'بطاقة ' + card.id} onClick={(e) => e.stopPropagation()} id="card-modal">
        <button type="button" className="btn btn-ghost btn-icon modal-close" aria-label="إغلاق" onClick={onClose}><Icon name="x" /></button>
        <div className="modal-qr" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="code modal-code">{card.id}</div>
        <div className="modal-url ltr">{url.replace(/^https?:\/\//, '')}</div>
        <div className="modal-meta">
          {card.owner
            ? <span className="chip ok"><bdi>{owner ? '@' + owner : 'مفعّلة'}</bdi></span>
            : <span className="chip">غير مفعّلة</span>}
          <span className="chip">{card.taps || 0} لمسة</span>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-gold" onClick={() => nfc(card.id)}><Icon name="nfc" />كتابة على NFC</button>
          <button type="button" className="btn" onClick={() => copyText(url).then(() => toast('تم نسخ الرابط ✓'))}><Icon name="copy" />نسخ الرابط</button>
          <button type="button" className="btn" onClick={() => downloadText('nfcrs-' + card.id + '.svg', svg, 'image/svg+xml')}><Icon name="download" />تحميل QR</button>
        </div>
      </div>
    </div>
  );
}

function NoteCell({ card, onSaved }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(card.note || '');

  async function save() {
    setEditing(false);
    if (value.trim() === (card.note || '')) return;
    try {
      await db.updateCardNote(card.id, value.trim());
      toast('تم حفظ الملاحظة ✓');
      onSaved();
    } catch (e) {
      toast('تعذر الحفظ: ' + (e.message || e), 'err');
    }
  }

  if (editing) {
    return (
      <input className="input note-input" autoFocus maxLength={80} value={value} aria-label="ملاحظة"
        onChange={(e) => setValue(e.target.value)} onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setValue(card.note || ''); setEditing(false); } }} />
    );
  }
  return (
    <button type="button" className="note-btn" title="تعديل الملاحظة" onClick={() => setEditing(true)}>
      <span>{card.note || 'أضف ملاحظة'}</span><Icon name="pencil" />
    </button>
  );
}

function CardsTab({ cards, owners, reload }) {
  const toast = useToast();
  const nfc = useNfc(toast);
  const [count, setCount] = useState(10);
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [modal, setModal] = useState(null);

  const q = search.trim().toLowerCase();
  const visible = cards.filter((c) => {
    if (filter === 'free' && c.owner) return false;
    if (filter === 'used' && !c.owner) return false;
    if (!q) return true;
    return c.id.toLowerCase().includes(q) || (c.note || '').toLowerCase().includes(q) || (owners[c.owner] || '').includes(q);
  });
  const chosen = visible.filter((c) => selected.has(c.id));
  const target = chosen.length ? chosen : visible;
  const allChecked = visible.length > 0 && chosen.length === visible.length;

  function toggle(id) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(visible.map((c) => c.id)));
  }

  async function create() {
    const n = Math.max(1, Math.min(200, parseInt(count, 10) || 0));
    setCreating(true);
    try {
      const codes = await db.createCards(n, note.trim());
      toast('تم إنشاء ' + codes.length + ' بطاقة ✓');
      setNote('');
      await reload();
    } catch (e) {
      toast('فشل الإنشاء: ' + (e.message || e), 'err');
    }
    setCreating(false);
  }

  async function reset(code) {
    if (!confirm('فصل البطاقة ' + code + ' عن صاحبها وتصفير عدّادها؟')) return;
    await db.resetCard(code);
    toast('تمت إعادة تعيين البطاقة');
    reload();
  }

  async function remove(code) {
    if (!confirm('حذف البطاقة ' + code + ' نهائياً؟ لن يعمل رابطها بعد ذلك.')) return;
    await db.deleteCard(code);
    const next = new Set(selected);
    next.delete(code);
    setSelected(next);
    toast('تم حذف البطاقة');
    reload();
  }

  function exportCsv() {
    const lines = [['code', 'url', 'status', 'owner', 'taps', 'note', 'created', 'activated'].join(',')];
    target.forEach((c) => {
      lines.push([c.id, db.cardUrl(c.id), c.owner ? 'active' : 'new', owners[c.owner] || '', c.taps || 0,
        '"' + String(c.note || '').replace(/"/g, '""') + '"', fmtDate(c.createdAt), fmtDate(c.activatedAt)].join(','));
    });
    downloadText('nfcrs-cards.csv', '﻿' + lines.join('\n'), 'text/csv');
  }

  return (
    <>
      <section className="card no-print">
        <div className="card-head">
          <div>
            <h2 className="card-title">إنشاء بطاقات جديدة</h2>
            <p className="card-sub">كل بطاقة تحصل على رمز فريد. المشتري يلمسها أول مرة فينشئ حسابه وتصبح البطاقة له.</p>
          </div>
        </div>
        <div className="create-row">
          <div className="field"><label className="label" htmlFor="count">العدد</label>
            <input className="input" id="count" type="number" min="1" max="200" value={count} onChange={(e) => setCount(e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="note">ملاحظة (اختياري)</label>
            <input className="input" id="note" placeholder="مثال: دفعة نوفمبر" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <button className="btn btn-gold" id="create" type="button" disabled={creating} onClick={create}><Icon name="plus" />إنشاء</button>
        </div>
      </section>

      <section className="card no-print">
        <div className="toolbar">
          <div className="search">
            <Icon name="search" />
            <input className="input" id="search" placeholder="ابحث بالرمز، اسم الزبون أو الملاحظة" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="seg" role="group" aria-label="تصفية" id="filter">
            {[['all', 'الكل'], ['free', 'غير مفعّلة'], ['used', 'مفعّلة']].map(([k, label]) => (
              <button key={k} type="button" data-filter={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{label}</button>
            ))}
          </div>
          <div className="row">
            <button className="btn btn-sm" id="print" type="button" disabled={!target.length} onClick={() => window.print()}>
              <Icon name="printer" />طباعة QR{chosen.length ? ' (' + chosen.length + ')' : ''}
            </button>
            <button className="btn btn-sm" id="export" type="button" disabled={!target.length} onClick={exportCsv}>
              <Icon name="file-spreadsheet" />CSV{chosen.length ? ' (' + chosen.length + ')' : ''}
            </button>
          </div>
        </div>
        {chosen.length > 0 && (
          <div className="selection-bar" id="selection-bar">
            <span>{chosen.length} بطاقة محددة — الطباعة والتصدير يشملان المحدد فقط.</span>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}>إلغاء التحديد</button>
          </div>
        )}

        <div className="table-wrap">
          <table className="table cards-table">
            <thead>
              <tr>
                <th className="chk"><input type="checkbox" aria-label="تحديد الكل" checked={allChecked} onChange={toggleAll} id="select-all" /></th>
                <th>الرمز</th><th>الحالة</th><th>اللمسات</th><th>ملاحظة</th><th>تاريخ الإنشاء</th><th />
              </tr>
            </thead>
            <tbody id="rows">
              {visible.length === 0 && (
                <tr className="empty-row"><td colSpan={7} className="center muted">
                  {cards.length ? 'لا توجد نتائج لهذا البحث.' : 'لا توجد بطاقات بعد — أنشئ أول دفعة من الأعلى.'}
                </td></tr>
              )}
              {visible.map((c) => (
                <tr key={c.id} className={selected.has(c.id) ? 'selected' : ''}>
                  <td className="chk"><input type="checkbox" aria-label={'تحديد ' + c.id} checked={selected.has(c.id)} onChange={() => toggle(c.id)} /></td>
                  <td className="td-code" data-label="الرمز"><button type="button" className="code code-link" onClick={() => setModal(c)}>{c.id}</button></td>
                  <td className="td-status" data-label="الحالة">
                    {c.owner
                      ? <a className="chip ok" href={owners[c.owner] ? db.profileUrl(owners[c.owner]) : undefined} target="_blank" rel="noopener noreferrer">
                          <bdi>{owners[c.owner] ? '@' + owners[c.owner] : 'مفعّلة'}</bdi>
                        </a>
                      : <span className="chip">غير مفعّلة</span>}
                  </td>
                  <td className="td-taps" data-label="اللمسات">{c.taps || 0}<span className="m-only"> لمسة</span></td>
                  <td className="td-note" data-label="ملاحظة"><NoteCell card={c} onSaved={reload} /></td>
                  <td className="td-date muted" data-label="الإنشاء">{fmtDate(c.createdAt)}</td>
                  <td className="actions-cell">
                    <div className="actions">
                      <button type="button" className="btn btn-sm" title="رمز QR" onClick={() => setModal(c)}><Icon name="qr-code" />QR</button>
                      <button type="button" className="btn btn-sm btn-gold" onClick={() => nfc(c.id)}><Icon name="nfc" />NFC</button>
                      <button type="button" className="btn btn-sm btn-icon" title="نسخ الرابط" aria-label="نسخ الرابط"
                        onClick={() => copyText(db.cardUrl(c.id)).then(() => toast('تم نسخ رابط ' + c.id))}><Icon name="copy" /></button>
                      {c.owner && <button type="button" className="btn btn-sm btn-icon" title="إعادة تعيين" aria-label="إعادة تعيين" onClick={() => reset(c.id)}><Icon name="rotate-ccw" /></button>}
                      <button type="button" className="btn btn-sm btn-icon btn-ghost btn-danger" title="حذف" aria-label="حذف" onClick={() => remove(c.id)}><Icon name="trash-2" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="print-sheet" id="sheet">
        {target.map((c) => (
          <div className="print-item" key={c.id}>
            <div dangerouslySetInnerHTML={{ __html: qrSvg(db.cardUrl(c.id)) }} />
            <div className="code">{c.id}</div>
          </div>
        ))}
      </section>

      {modal && <CardModal card={modal} owner={owners[modal.owner]} onClose={() => setModal(null)} />}
    </>
  );
}

function CustomersTab({ customers, error, cards }) {
  const [search, setSearch] = useState('');
  const cardCount = useMemo(() => {
    const m = {};
    cards.forEach((c) => { if (c.owner) m[c.owner] = (m[c.owner] || 0) + 1; });
    return m;
  }, [cards]);

  if (error) {
    return (
      <section className="card">
        <div className="alert gold" id="customers-error">
          <Icon name="shield-check" />
          <span>لعرض الزبائن، حدّث قواعد الحماية: انسخ ملف <b>firestore.rules</b> من المستودع والصقه في Firebase ← Firestore Database ← Règles ← Publier.</span>
        </div>
      </section>
    );
  }

  const q = search.trim().toLowerCase();
  const list = customers
    .filter((p) => !q || (p.name || '').toLowerCase().includes(q) || (p.username || '').includes(q))
    .sort((a, b) => b.views - a.views);

  return (
    <section className="card">
      <div className="toolbar">
        <div className="search">
          <Icon name="search" />
          <input className="input" id="customer-search" placeholder="ابحث بالاسم أو اسم المستخدم" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span className="muted" style={{ fontSize: 13 }}>{list.length} زبون</span>
      </div>
      {list.length === 0 && <div className="empty"><Icon name="user" /><div>{customers.length ? 'لا توجد نتائج.' : 'لا يوجد زبائن بعد.'}</div></div>}
      <div className="customer-grid" id="customers">
        {list.map((p) => {
          const src = safeImage(p.avatar);
          return (
            <a key={p.uid} className="customer" href={db.profileUrl(p.username)} target="_blank" rel="noopener noreferrer">
              <div className="customer-av">{src ? <img src={src} alt="" referrerPolicy="no-referrer" /> : initials(p.name)}</div>
              <div className="customer-info">
                <b>{p.name || '—'}</b>
                <span className="ltr">@{p.username}</span>
              </div>
              <div className="customer-stats">
                <span title="زيارات"><Icon name="eye" />{p.views}</span>
                <span title="بطاقات"><Icon name="credit-card" />{cardCount[p.uid] || 0}</span>
                <span title="روابط"><Icon name="link" />{(p.links || []).filter((l) => linkUrl(l)).length}</span>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

// Admins of the cPanel edition: list, add by e-mail, remove.
function AdminsTab() {
  const toast = useToast();
  const [admins, setAdmins] = useState(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = () => db.listAdmins().then(setAdmins, (e) => toast(e.message || String(e), 'err'));
  useEffect(() => { reload(); }, []);

  async function add(e) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) return;
    setBusy(true);
    try {
      await db.addAdmin(value);
      setEmail('');
      toast('تمت إضافة ' + value + ' كمدير ✓');
      await reload();
    } catch (err) {
      toast(db.authErrorMessage(err), 'err');
    }
    setBusy(false);
  }

  async function remove(a) {
    if (!confirm('إزالة ' + a.email + ' من المدراء؟')) return;
    try {
      await db.removeAdmin(a.email);
      toast('تمت الإزالة');
      await reload();
    } catch (err) {
      toast(err.message || String(err), 'err');
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">المدراء</h2>
          <p className="card-sub">كل من يسجّل الدخول بأحد هذه البريدات يستطيع فتح لوحة الإدارة. أضف البريد ثم اطلب من صاحبه إنشاء حساب به.</p>
        </div>
      </div>
      <form className="activate-inline" id="admin-add" onSubmit={add} style={{ marginTop: 0, marginBottom: 14 }}>
        <input className="input ltr" id="admin-email" type="email" dir="ltr" placeholder="name@example.com" value={email}
          onChange={(e) => setEmail(e.target.value)} aria-label="بريد المدير الجديد" />
        <button className="btn btn-gold" type="submit" disabled={busy} style={{ height: 44 }}><Icon name="plus" />إضافة مدير</button>
      </form>
      {!admins && <div className="empty">جارٍ التحميل…</div>}
      <div className="card-list" id="admins">
        {(admins || []).map((a) => (
          <div className="card-item" key={a.email + (a.fixed ? '-fixed' : '')}>
            <div className="customer-av" style={{ width: 38, height: 38, fontSize: 14 }}>{(a.name || a.email).charAt(0).toUpperCase()}</div>
            <div className="meta">
              <div className="ltr" style={{ fontWeight: 600 }}>{a.email}</div>
              <div>{a.name || 'لم ينشئ حساباً بعد'}</div>
            </div>
            {a.you && <span className="chip gold">أنت</span>}
            {a.fixed && <span className="chip">في config.php</span>}
            {!a.you && !a.fixed && (
              <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={() => remove(a)}><Icon name="trash-2" />إزالة</button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

const SETUP_KEY = new URLSearchParams(location.search).get('setup');

export default function Admin() {
  const [phase, setPhase] = useState('loading');
  const [uid, setUid] = useState('');
  const [email, setEmail] = useState('');
  const [tab, setTab] = useState('cards');
  const [cards, setCards] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customersError, setCustomersError] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!db.isConfigured) { setPhase('unconfigured'); return undefined; }
    return db.onUser(async (u) => {
      if (!u) {
        const next = 'admin.html' + (SETUP_KEY ? '?setup=' + encodeURIComponent(SETUP_KEY) : '');
        location.replace('login.html?' + (SETUP_KEY ? 'mode=signup&' : '') + 'next=' + encodeURIComponent(next));
        return;
      }
      setUid(u.uid);
      setEmail(u.email || '');
      if (!(await db.isAdmin(u.uid))) {
        const canSetup = SETUP_KEY && db.adminSetupAvailable && await db.adminSetupAvailable(SETUP_KEY).catch(() => false);
        setPhase(canSetup ? 'setup' : 'denied');
        return;
      }
      if (SETUP_KEY) history.replaceState(null, '', 'admin.html');
      setPhase('ready');
      load();
    });
  }, []);

  async function load() {
    const [list, people] = await Promise.all([
      db.listCards(),
      db.listCustomers().then((r) => { setCustomersError(false); return r; }, (e) => { console.warn(e); setCustomersError(true); return null; })
    ]);
    setCards(list);
    if (people) {
      setCustomers(people);
    } else {
      // Without the admin list rules, fall back to the card owners' public profiles.
      const ids = [...new Set(list.filter((c) => c.owner).map((c) => c.owner))];
      const found = await Promise.all(ids.map(async (id) => {
        const p = await db.getProfile(id).catch(() => null);
        return p ? Object.assign({ uid: id, views: 0 }, p) : null;
      }));
      setCustomers(found.filter(Boolean));
    }
  }

  const owners = useMemo(() => Object.fromEntries(customers.map((p) => [p.uid, p.username])), [customers]);
  const used = cards.filter((c) => c.owner).length;
  const taps = cards.reduce((n, c) => n + (c.taps || 0), 0);
  const views = customers.reduce((n, p) => n + (p.views || 0), 0);
  const rate = cards.length ? Math.round((used / cards.length) * 100) : 0;

  const header = (
    <header className="topbar no-print">
      <div className="container">
        <Logo tag="إدارة" />
        <a className="btn btn-sm" href="app.html"><Icon name="user" />صفحتي</a>
      </div>
    </header>
  );

  if (phase === 'loading') return <>{header}<Spinner /></>;
  if (phase === 'unconfigured') return <>{header}<Spinner text="الموقع غير مُعدّ بعد: أضف إعدادات Firebase (راجع README)." /></>;
  if (phase === 'setup') {
    return (
      <>
        {header}
        <StateCard icon="shield-check" title="تفعيل المدير الرئيسي" text="سيصبح هذا الحساب مدير الموقع. هذا الرابط يعمل مرة واحدة فقط، ثم يتوقف نهائياً." code={email}>
          <button className="btn btn-gold btn-lg btn-block" type="button" id="claim-admin" onClick={async () => {
            try {
              await db.claimAdmin(SETUP_KEY);
              history.replaceState(null, '', 'admin.html');
              toast('أصبحت المدير الرئيسي ✓');
              setPhase('ready');
              load();
            } catch (e) {
              toast(e.message || String(e), 'err');
              setPhase('denied');
            }
          }}>اجعل حسابي المدير</button>
        </StateCard>
      </>
    );
  }
  if (phase === 'denied') {
    // Firebase admins are added in the console by uid; the cPanel edition adds them by e-mail from admin.html.
    const firebase = db.backend === 'firebase';
    return (
      <>
        {header}
        <StateCard icon="shield-check" muted title="هذه الصفحة للمدراء فقط"
          text={firebase ? 'لإضافة حسابك كمدير، استعمل معرّف الحساب التالي:' : 'هذا الحساب ليس مديراً. اطلب من مدير الموقع إضافة بريدك من لوحة الإدارة.'}
          code={firebase ? uid : email}>
          {firebase && <button className="btn btn-outline btn-block" type="button" onClick={() => copyText(uid).then(() => toast('تم النسخ ✓'))}>نسخ المعرّف</button>}
        </StateCard>
      </>
    );
  }

  return (
    <>
      {header}
      <main className="dash" id="admin">
        <div className="container">
          <div className="dash-head no-print">
            <div>
              <h1>لوحة الإدارة</h1>
              <p>أنشئ البطاقات وبرمجها، وتابع التفعيل والزبائن.</p>
            </div>
            <button type="button" className="btn btn-sm" onClick={() => load().then(() => toast('تم التحديث ✓'))}><Icon name="rotate-ccw" />تحديث</button>
          </div>

          <div className="stat-row stat-row-5 no-print">
            <div className="stat"><div className="ic"><Icon name="credit-card" /></div><div><b id="s-total">{cards.length}</b><span>بطاقة</span></div></div>
            <div className="stat"><div className="ic"><Icon name="circle-check" /></div><div><b id="s-used">{used}</b><span>مفعّلة · {rate}%</span></div></div>
            <div className="stat"><div className="ic"><Icon name="user" /></div><div><b id="s-customers">{customers.length}</b><span>زبون</span></div></div>
            <div className="stat"><div className="ic"><Icon name="nfc" /></div><div><b id="s-taps">{taps}</b><span>لمسة</span></div></div>
            <div className="stat"><div className="ic"><Icon name="eye" /></div><div><b id="s-views">{customersError ? '—' : views}</b><span>زيارة</span></div></div>
          </div>

          <div className="tabs no-print" role="tablist">
            <button type="button" data-tab="cards" className={'tab' + (tab === 'cards' ? ' active' : '')} onClick={() => setTab('cards')}><Icon name="credit-card" />البطاقات</button>
            <button type="button" data-tab="customers" className={'tab' + (tab === 'customers' ? ' active' : '')} onClick={() => setTab('customers')}><Icon name="user" />الزبائن</button>
            {db.listAdmins && <button type="button" data-tab="admins" className={'tab' + (tab === 'admins' ? ' active' : '')} onClick={() => setTab('admins')}><Icon name="shield-check" />المدراء</button>}
          </div>

          {tab === 'cards' && <CardsTab cards={cards} owners={owners} reload={load} />}
          {tab === 'customers' && <CustomersTab customers={customers} error={customersError} cards={cards} />}
          {tab === 'admins' && db.listAdmins && <AdminsTab />}
        </div>
      </main>
    </>
  );
}
