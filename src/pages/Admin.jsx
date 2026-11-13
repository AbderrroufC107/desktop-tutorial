// admin.html: create, track, program and print the NFC cards you sell.
import { useEffect, useState } from 'react';
import * as db from '../lib/db.js';
import { Icon, Logo, Spinner, StateCard, useToast } from '../components/ui.jsx';
import { copyText, downloadText, qrSvg, writeNfc } from '../lib/utils.js';

export default function Admin() {
  const toast = useToast();
  const [phase, setPhase] = useState('loading');
  const [uid, setUid] = useState('');
  const [cards, setCards] = useState([]);
  const [owners, setOwners] = useState({});
  const [filter, setFilter] = useState('all');
  const [count, setCount] = useState(10);
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!db.isConfigured) { setPhase('unconfigured'); return undefined; }
    return db.onUser(async (u) => {
      if (!u) { location.replace('login.html?next=admin.html'); return; }
      setUid(u.uid);
      if (!(await db.isAdmin(u.uid))) { setPhase('denied'); return; }
      setPhase('ready');
      load();
    });
  }, []);

  async function load() {
    const list = await db.listCards();
    setCards(list);
    const ids = [...new Set(list.filter((c) => c.owner).map((c) => c.owner))];
    const entries = await Promise.all(ids.map(async (id) => {
      const p = await db.getProfile(id).catch(() => null);
      return [id, p ? p.username : ''];
    }));
    setOwners(Object.fromEntries(entries));
  }

  const visible = cards.filter((c) => filter === 'all' || (filter === 'free' ? !c.owner : !!c.owner));
  const used = cards.filter((c) => c.owner).length;
  const taps = cards.reduce((n, c) => n + (c.taps || 0), 0);

  async function create() {
    const n = Math.max(1, Math.min(200, parseInt(count, 10) || 0));
    setCreating(true);
    try {
      const codes = await db.createCards(n, note.trim());
      toast('تم إنشاء ' + codes.length + ' بطاقة ✓');
      await load();
    } catch (e) {
      toast('فشل الإنشاء: ' + (e.message || e), 'err');
    }
    setCreating(false);
  }

  async function nfc(code) {
    toast('قرّب البطاقة ' + code + ' من ظهر الهاتف…');
    try { await writeNfc(db.cardUrl(code)); toast('تمت كتابة البطاقة ' + code + ' ✓'); } catch (e) { toast(e.message || String(e), 'err'); }
  }

  async function reset(code) {
    if (!confirm('فصل البطاقة ' + code + ' عن صاحبها وتصفير عدّادها؟')) return;
    await db.resetCard(code);
    toast('تمت إعادة تعيين البطاقة');
    load();
  }

  async function remove(code) {
    if (!confirm('حذف البطاقة ' + code + ' نهائياً؟ لن يعمل رابطها بعد ذلك.')) return;
    await db.deleteCard(code);
    toast('تم حذف البطاقة');
    load();
  }

  function exportCsv() {
    const lines = [['code', 'url', 'status', 'owner', 'taps', 'note'].join(',')];
    cards.forEach((c) => {
      lines.push([c.id, db.cardUrl(c.id), c.owner ? 'active' : 'new', owners[c.owner] || '', c.taps || 0,
        '"' + String(c.note || '').replace(/"/g, '""') + '"'].join(','));
    });
    downloadText('nfcrs-cards.csv', '﻿' + lines.join('\n'), 'text/csv');
  }

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
  if (phase === 'denied') {
    return (
      <>
        {header}
        <StateCard icon="shield-check" muted title="هذه الصفحة لصاحب الموقع فقط" text="لإضافة حسابك كمدير، استعمل معرّف الحساب التالي:" code={uid}>
          <button className="btn btn-outline btn-block" type="button" onClick={() => copyText(uid).then(() => toast('تم النسخ ✓'))}>نسخ المعرّف</button>
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
              <h1>إدارة البطاقات</h1>
              <p>أنشئ بطاقات للبيع، اكتبها على NFC، وتابع تفعيلها.</p>
            </div>
          </div>

          <div className="stat-row no-print">
            <div className="stat"><div className="ic"><Icon name="credit-card" /></div><div><b id="s-total">{cards.length}</b><span>بطاقة</span></div></div>
            <div className="stat"><div className="ic"><Icon name="circle-check" /></div><div><b id="s-used">{used}</b><span>مفعّلة</span></div></div>
            <div className="stat"><div className="ic"><Icon name="nfc" /></div><div><b id="s-taps">{taps}</b><span>لمسة</span></div></div>
          </div>

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
            <div className="card-head wrap">
              <h2 className="card-title">البطاقات</h2>
              <div className="row wrap">
                <select className="input select-sm" id="filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="all">الكل</option>
                  <option value="free">غير مفعّلة</option>
                  <option value="used">مفعّلة</option>
                </select>
                <button className="btn btn-sm" id="print" type="button" onClick={() => window.print()}><Icon name="printer" />طباعة QR</button>
                <button className="btn btn-sm" id="export" type="button" onClick={exportCsv}><Icon name="file-spreadsheet" />CSV</button>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>الرمز</th><th>الحالة</th><th>اللمسات</th><th>ملاحظة</th><th /></tr></thead>
                <tbody id="rows">
                  {visible.length === 0 && (
                    <tr><td colSpan={5} className="center muted" style={{ padding: 32 }}>لا توجد بطاقات بعد — أنشئ أول دفعة من الأعلى.</td></tr>
                  )}
                  {visible.map((c) => (
                    <tr key={c.id}>
                      <td><span className="code">{c.id}</span></td>
                      <td>
                        {c.owner
                          ? <a className="chip ok" href={owners[c.owner] ? db.profileUrl(owners[c.owner]) : undefined} target="_blank" rel="noopener noreferrer">
                              {owners[c.owner] ? '@' + owners[c.owner] : 'مفعّلة'}
                            </a>
                          : <span className="chip">غير مفعّلة</span>}
                      </td>
                      <td>{c.taps || 0}</td>
                      <td className="muted">{c.note || '—'}</td>
                      <td>
                        <div className="actions">
                          <button type="button" className="btn btn-sm btn-gold" onClick={() => nfc(c.id)}><Icon name="nfc" />NFC</button>
                          <button type="button" className="btn btn-sm" onClick={() => copyText(db.cardUrl(c.id)).then(() => toast('تم نسخ رابط ' + c.id))}><Icon name="copy" />نسخ</button>
                          {c.owner && <button type="button" className="btn btn-sm" onClick={() => reset(c.id)}><Icon name="rotate-ccw" />إعادة</button>}
                          <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={() => remove(c.id)}><Icon name="trash-2" />حذف</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="print-sheet" id="sheet">
            {visible.map((c) => (
              <div className="print-item" key={c.id}>
                <div dangerouslySetInnerHTML={{ __html: qrSvg(db.cardUrl(c.id)) }} />
                <div className="code">{c.id}</div>
              </div>
            ))}
          </section>
        </div>
      </main>
    </>
  );
}
