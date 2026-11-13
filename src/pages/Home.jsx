// index.html: landing page, public profiles (?u=name) and card taps (?c=CODE).
import { useEffect, useState } from 'react';
import * as db from '../lib/db.js';
import ProfileView from '../components/ProfileView.jsx';
import { Icon, Logo, NfcCardArt, Phone, PlatformIcon, Spinner, StateCard } from '../components/ui.jsx';

const DEMO = {
  name: 'سارة بن علي',
  bio: 'مصممة جرافيك · الجزائر العاصمة',
  theme: 'p:gold',
  links: [
    { type: 'whatsapp', value: '1' }, { type: 'instagram', value: 'x' },
    { type: 'tiktok', value: 'x' }, { type: 'facebook', value: 'x' },
    { type: 'phone', value: '1' }, { type: 'website', value: 'x.com', label: 'معرض أعمالي' }
  ]
};

const FEATURES = [
  { icon: 'nfc', title: 'مشاركة بلمسة', text: 'قرّب البطاقة من أي هاتف حديث فتفتح صفحتك فوراً، بدون أي تطبيق.' },
  { icon: 'qr-code', title: 'رمز QR مدمج', text: 'لكل بطاقة رمز QR للهواتف القديمة، وللطباعة على منشوراتك ومحلك.' },
  { icon: 'contact', title: 'حفظ جهة الاتصال', text: 'زر واحد يحفظ اسمك ورقمك وبريدك مباشرة في هاتف من قابلته.' },
  { icon: 'palette', title: 'تصاميم فاخرة', text: 'ثيمات جاهزة بلمسة احترافية، أو لونك الخاص، مع صورتك ونبذتك.' },
  { icon: 'bar-chart-3', title: 'إحصائيات حيّة', text: 'تابع عدد زيارات صفحتك وعدد مرات لمس بطاقتك.' },
  { icon: 'pencil', title: 'عدّل متى شئت', text: 'غيّر روابطك في أي وقت، وتبقى بطاقتك تعمل دون إعادة برمجة.' }
];

const STEPS = [
  { title: 'المس بطاقتك', text: 'قرّب بطاقة NFC RS الجديدة من هاتفك لتفعيلها.' },
  { title: 'أنشئ صفحتك', text: 'سجّل بجوجل في ثوانٍ، وأضف صورتك وحساباتك واختر التصميم.' },
  { title: 'شارك بلمسة', text: 'من يلمس بطاقتك يرى صفحتك ويحفظ رقمك بضغطة واحدة.' }
];

const SHOWCASE_PLATFORMS = ['whatsapp', 'instagram', 'tiktok', 'facebook', 'snapchat', 'youtube', 'telegram', 'linkedin', 'x'];

function Landing() {
  const [code, setCode] = useState('');

  function activate(e) {
    e.preventDefault();
    const c = db.normalizeCode(code);
    if (c) location.href = '?c=' + c;
  }

  return (
    <div className="landing">
      <header className="topbar">
        <div className="container">
          <Logo />
          <nav className="topnav">
            <a href="#features">المميزات</a>
            <a href="#how">كيف تعمل</a>
            <a href="#activate">تفعيل بطاقة</a>
          </nav>
          <div className="row">
            <a className="btn btn-ghost" href="login.html">دخول</a>
            <a className="btn btn-gold" href="login.html?mode=signup">ابدأ الآن</a>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="hero-glow" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow"><span className="dot" />بطاقات أعمال ذكية بتقنية NFC</span>
            <h1>بطاقتك الذكية،<br /><span className="gold-text">بلمسة واحدة.</span></h1>
            <p className="lead">
              بطاقة أنيقة تحمل كل حساباتك: واتساب، إنستغرام، تيك توك ورقم هاتفك.
              يلمسها الشخص بهاتفه فتفتح صفحتك الاحترافية فوراً.
            </p>
            <div className="ctas">
              <a className="btn btn-gold btn-lg" href="login.html?mode=signup">أنشئ صفحتك مجاناً</a>
              <a className="btn btn-outline btn-lg" href="#activate"><Icon name="credit-card" />عندي بطاقة</a>
            </div>
            <div className="hero-stats">
              <div><b>+17</b><span>منصة مدعومة</span></div>
              <div><b>0</b><span>تطبيقات مطلوبة</span></div>
              <div><b>∞</b><span>تعديلات مجانية</span></div>
            </div>
          </div>

          <div className="showcase">
            <Phone><ProfileView data={DEMO} className="demo" /></Phone>
            <NfcCardArt variant="gold" className="float-a" />
            <NfcCardArt variant="black" className="float-b" />
          </div>
        </div>
      </section>

      <section className="strip">
        <div className="container strip-inner">
          <span>يعمل مع كل حساباتك</span>
          <div className="strip-icons">
            {SHOWCASE_PLATFORMS.map((p) => <PlatformIcon key={p} type={p} />)}
          </div>
        </div>
      </section>

      <section className="section" id="features">
        <div className="container">
          <div className="section-head">
            <span className="kicker">المميزات</span>
            <h2>كل ما تحتاجه لتترك انطباعاً لا يُنسى</h2>
            <p>بطاقة واحدة بدل عشرات الأرقام والروابط.</p>
          </div>
          <div className="features">
            {FEATURES.map((f) => (
              <div className="feature" key={f.title}>
                <div className="ic"><Icon name={f.icon} /></div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt" id="how">
        <div className="container">
          <div className="section-head">
            <span className="kicker">كيف تعمل</span>
            <h2>ثلاث خطوات فقط</h2>
          </div>
          <div className="steps">
            {STEPS.map((s, i) => (
              <div className="step" key={s.title}>
                <span className="step-num">0{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="activate">
        <div className="container">
          <div className="activate-panel">
            <div>
              <span className="kicker">تفعيل بطاقة</span>
              <h2>عندك بطاقة NFC RS؟</h2>
              <p>المس البطاقة بهاتفك، أو اكتب الرمز المطبوع عليها.</p>
            </div>
            <form className="activate-form" onSubmit={activate}>
              <input className="input code-input" value={code} onChange={(e) => setCode(e.target.value)}
                placeholder="XXXXXXXX" maxLength={12} autoComplete="off" aria-label="رمز البطاقة" id="code" />
              <button className="btn btn-gold" type="submit">تفعيل</button>
            </form>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="cta-band">
            <h2>جاهز لتكون <span className="gold-text">لا يُنسى</span>؟</h2>
            <p>أنشئ صفحتك الآن مجاناً، وشاركها بلمسة.</p>
            <a className="btn btn-gold btn-lg" href="login.html?mode=signup">ابدأ الآن</a>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="container">
          <Logo />
          <span>© {new Date().getFullYear()} NFC RS. جميع الحقوق محفوظة.</span>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState({ kind: 'loading' });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('c');
    const username = params.get('u');

    async function load() {
      if (!db.isConfigured) return setView({ kind: 'unconfigured' });
      if (code) {
        const card = await db.getCard(code);
        if (!card) return setView({ kind: 'unknown-card' });
        if (!card.owner) return setView({ kind: 'new-card', card });
        const profile = await db.getProfile(card.owner);
        if (!profile) return setView({ kind: 'empty-card' });
        db.recordTap(card.id);
        db.recordView(card.owner);
        return setView({ kind: 'profile', profile });
      }
      if (username) {
        const found = await db.getProfileByUsername(username);
        if (!found) return setView({ kind: 'no-user' });
        db.recordView(found.uid);
        return setView({ kind: 'profile', profile: found.profile });
      }
      setView({ kind: 'landing' });
    }

    load().catch((e) => {
      console.error(e);
      setView({ kind: 'error' });
    });
  }, []);

  useEffect(() => {
    if (view.kind === 'profile' && view.profile.name) document.title = view.profile.name + ' | NFC RS';
  }, [view]);

  switch (view.kind) {
    case 'loading':
      return <Spinner />;
    case 'landing':
      return <Landing />;
    case 'profile':
      return <ProfileView data={view.profile} footer pageUrl={db.profileUrl(view.profile.username)} />;
    case 'new-card': {
      const next = encodeURIComponent('app.html?activate=' + view.card.id);
      return (
        <StateCard icon="nfc" title="مرحباً ببطاقتك الجديدة!"
          text="هذه البطاقة لم تُفعّل بعد. أنشئ حسابك في ثوانٍ وستفتح هذه البطاقة صفحتك أنت."
          code={view.card.id}>
          <a className="btn btn-gold btn-lg btn-block" href={'login.html?mode=signup&next=' + next}>تفعيل البطاقة</a>
          <a className="btn btn-outline btn-lg btn-block" href={'login.html?next=' + next}>لدي حساب — تسجيل الدخول</a>
        </StateCard>
      );
    }
    case 'unknown-card':
      return (
        <StateCard icon="credit-card" muted title="بطاقة غير معروفة" text="لم نجد بطاقة بهذا الرمز. تأكد منه أو تواصل مع البائع.">
          <a className="btn btn-outline btn-lg btn-block" href="./">الصفحة الرئيسية</a>
        </StateCard>
      );
    case 'empty-card':
      return <StateCard icon="user" muted title="الصفحة قيد الإنشاء" text="صاحب هذه البطاقة لم يُكمل صفحته بعد." />;
    case 'no-user':
      return (
        <StateCard icon="user" muted title="الصفحة غير موجودة" text="لا يوجد مستخدم بهذا الاسم. هل تريد حجزه لنفسك؟">
          <a className="btn btn-gold btn-lg btn-block" href="login.html?mode=signup">احجز هذا الاسم مجاناً</a>
          <a className="btn btn-outline btn-lg btn-block" href="./">الصفحة الرئيسية</a>
        </StateCard>
      );
    case 'unconfigured':
      return <StateCard icon="settings" muted title="الموقع غير مُعدّ بعد" text="أضف إعدادات Firebase في src/lib/firebase-config.js (راجع README)." />;
    default:
      return (
        <StateCard icon="wifi" muted title="تعذر التحميل" text="تحقق من اتصالك بالإنترنت ثم أعد المحاولة.">
          <button className="btn btn-gold btn-lg btn-block" type="button" onClick={() => location.reload()}>إعادة المحاولة</button>
        </StateCard>
      );
  }
}
