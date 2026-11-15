// The public page people see when they tap a card or open ?u=username.
// Layout: optional full-page photo background, avatar, name and bio, a row of round social icons,
// "glass" buttons for calls, WhatsApp and other links, then payment details with a copy button.
import { useState } from 'react';
import { Icon, PlatformIcon, useToast } from './ui.jsx';
import { PLATFORMS, copyText, coverLight, initials, isPayment, linkUrl, safeImage, themeKey } from '../lib/utils.js';

function Avatar({ src, name }) {
  const [broken, setBroken] = useState(false);
  const url = safeImage(src);
  return (
    <div className="p-avatar">
      {url && !broken
        ? <img src={url} alt={name || ''} referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        : initials(name)}
    </div>
  );
}

function external(url) {
  return /^https?:/i.test(url) ? { target: '_blank', rel: 'noopener noreferrer' } : {};
}

function PaymentRow({ link }) {
  const toast = useToast();
  const p = PLATFORMS[link.type];
  const value = String(link.value).trim();
  return (
    <button type="button" className="p-pay" onClick={() => copyText(value).then(() => toast('تم نسخ ' + (link.label || p.label) + ' ✓'), () => toast(value))}>
      <span className={'p-chip' + (p.light ? ' light' : '')} style={{ background: p.color }}><PlatformIcon type={link.type} /></span>
      <span className="p-pay-text">
        <span className="p-pay-label">{link.label || p.label}</span>
        <span className="p-pay-value ltr">{value}</span>
      </span>
      <span className="p-pay-copy"><Icon name="copy" /></span>
    </button>
  );
}

// Social accounts without a custom label become round icons; everything else is a full button.
function isIcon(link) {
  const p = PLATFORMS[link.type];
  return !!p.brand && link.type !== 'whatsapp' && !String(link.label || '').trim();
}

const PILL_ORDER = ['phone', 'whatsapp'];

export default function ProfileView({ data, footer = false, className = '' }) {
  const profile = data || {};
  const key = themeKey(profile.theme);
  const all = profile.links || [];
  const links = all.filter((l) => linkUrl(l));
  const icons = links.filter(isIcon);
  // Call and WhatsApp first, then the rest in the customer's order (sort is stable).
  const rank = (l) => (PILL_ORDER.includes(l.type) ? 0 : 1);
  const pills = links.filter((l) => !isIcon(l)).sort((a, b) => rank(a) - rank(b));
  const payments = all.filter(isPayment);
  const cover = safeImage(profile.cover);
  const style = key === 'custom' ? { '--accent': profile.theme } : undefined;

  return (
    <div className={'profile ' + (cover ? 'has-bg ' : '') + className} data-theme={key} style={style}>
      {cover && (
        <div className="p-bg" aria-hidden="true">
          <img src={cover} alt="" style={{ filter: `brightness(${coverLight(profile.coverLight)}%)` }} />
        </div>
      )}
      <main className="p-card">
        {!cover && <div className="p-cover" />}
        <div className="p-head">
          <Avatar src={profile.avatar} name={profile.name} />
          <h1 className="p-name">{profile.name || ' '}</h1>
          {profile.bio && <p className="p-bio">{profile.bio}</p>}
        </div>

        {icons.length > 0 && (
          <div className="p-social">
            {icons.map((l, i) => {
              const p = PLATFORMS[l.type];
              return (
                <a key={i} className={'p-social-btn' + (p.light ? ' light' : '')} href={linkUrl(l)} {...external(linkUrl(l))}
                  aria-label={p.label} title={p.label} style={{ background: p.color }}>
                  <PlatformIcon type={l.type} />
                </a>
              );
            })}
          </div>
        )}

        {pills.length > 0 && (
          <nav className="p-pills">
            {pills.map((l, i) => {
              const p = PLATFORMS[l.type];
              return (
                <a key={i} className="p-pill" data-type={l.type} href={linkUrl(l)} {...external(linkUrl(l))}>
                  <span className={'p-chip' + (p.light ? ' light' : '')} style={{ background: p.color }}><PlatformIcon type={l.type} /></span>
                  <span className="p-pill-label">{l.label || p.label}</span>
                  <span className="p-pill-arrow"><Icon name="external-link" /></span>
                </a>
              );
            })}
          </nav>
        )}

        {payments.length > 0 && (
          <section className="p-payments">
            <h2 className="p-section-title"><Icon name="wallet" />الدفع والتحويل</h2>
            {payments.map((l, i) => <PaymentRow key={i} link={l} />)}
          </section>
        )}

        {footer && (
          <a className="p-footer" href="./">
            <Icon name="nfc" /><span>أنشئ بطاقتك الذكية مع <b>NFC RS</b></span>
          </a>
        )}
      </main>
    </div>
  );
}
