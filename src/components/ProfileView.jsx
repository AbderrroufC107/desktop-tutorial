// The public page people see when they tap a card or open ?u=username.
// A compact digital business card: cover (colour or photo), avatar, name and bio,
// call/WhatsApp buttons, a two-column grid of links, and payment details with a copy button.
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
      <span className={'p-item-icon' + (p.light ? ' light' : '')} style={{ background: p.color }}><PlatformIcon type={link.type} /></span>
      <span className="p-pay-text">
        <span className="p-pay-label">{link.label || p.label}</span>
        <span className="p-pay-value ltr">{value}</span>
      </span>
      <span className="p-pay-copy"><Icon name="copy" /></span>
    </button>
  );
}

const CONTACT_TYPES = ['phone', 'whatsapp'];

export default function ProfileView({ data, footer = false, className = '' }) {
  const profile = data || {};
  const key = themeKey(profile.theme);
  const all = profile.links || [];
  const links = all.filter((l) => linkUrl(l));
  const payments = all.filter(isPayment);
  const style = key === 'custom' ? { '--accent': profile.theme } : undefined;
  const cover = safeImage(profile.cover);

  // The first phone and first WhatsApp become the two contact buttons; everything else is a link button.
  const contacts = CONTACT_TYPES.map((t) => links.find((l) => l.type === t)).filter(Boolean);
  const rest = links.filter((l) => !contacts.includes(l));

  return (
    <div className={'profile ' + className} data-theme={key} style={style}>
      <main className="p-card">
        <div className={'p-cover' + (cover ? ' has-img' : '')}>
          {cover && <img src={cover} alt="" style={{ filter: `brightness(${coverLight(profile.coverLight)}%)` }} />}
        </div>
        <div className="p-head">
          <Avatar src={profile.avatar} name={profile.name} />
          <h1 className="p-name">{profile.name || ' '}</h1>
          {profile.bio && <p className="p-bio">{profile.bio}</p>}
        </div>

        {contacts.length > 0 && (
          <div className="p-contacts">
            {contacts.map((l, i) => (
              <a key={i} className={'p-contact ' + l.type} href={linkUrl(l)} {...external(linkUrl(l))}>
                <PlatformIcon type={l.type} />
                <span>{l.label || PLATFORMS[l.type].label}</span>
              </a>
            ))}
          </div>
        )}

        {rest.length > 0 && (
          <nav className="p-grid">
            {rest.map((l, i) => {
              const p = PLATFORMS[l.type];
              return (
                <a key={i} className="p-item" href={linkUrl(l)} {...external(linkUrl(l))}>
                  <span className={'p-item-icon' + (p.light ? ' light' : '')} style={{ background: p.color }}>
                    <PlatformIcon type={l.type} />
                  </span>
                  <span className="p-item-label">{l.label || p.label}</span>
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
