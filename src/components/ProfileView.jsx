// The public page people see when they tap a card or open ?u=username.
// A compact digital business card: cover + avatar, name and bio, call/WhatsApp buttons,
// a two-column grid of link buttons, and "save contact" at the bottom.
import { useState } from 'react';
import { Icon, PlatformIcon } from './ui.jsx';
import { PLATFORMS, downloadText, initials, linkUrl, safeImage, themeKey, vcard } from '../lib/utils.js';

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

const CONTACT_TYPES = ['phone', 'whatsapp'];

export default function ProfileView({ data, footer = false, pageUrl, className = '' }) {
  const profile = data || {};
  const key = themeKey(profile.theme);
  const links = (profile.links || []).filter((l) => linkUrl(l));
  const style = key === 'custom' ? { '--accent': profile.theme } : undefined;

  // The first phone and first WhatsApp become the two contact buttons; everything else is a link button.
  const contacts = CONTACT_TYPES.map((t) => links.find((l) => l.type === t)).filter(Boolean);
  const rest = links.filter((l) => !contacts.includes(l));

  function saveContact() {
    downloadText((profile.name || 'contact') + '.vcf', vcard(profile, pageUrl), 'text/vcard');
  }

  return (
    <div className={'profile ' + className} data-theme={key} style={style}>
      <main className="p-card">
        <div className="p-cover" />
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

        <button type="button" className="p-save" onClick={saveContact}>
          <Icon name="contact" /><span>حفظ جهة الاتصال</span>
        </button>

        {footer && (
          <a className="p-footer" href="./">
            <Icon name="nfc" /><span>أنشئ بطاقتك الذكية مع <b>NFC RS</b></span>
          </a>
        )}
      </main>
    </div>
  );
}
