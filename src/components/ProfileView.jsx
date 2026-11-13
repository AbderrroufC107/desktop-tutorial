// The public page people see when they tap a card or open ?u=username.
// Laid out as a compact digital business card that fits on one phone screen:
// cover + avatar, name, quick actions (call / WhatsApp / save contact), then a tile grid.
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

// Up to two contact links get a quick-action button; they are left out of the tile grid.
const QUICK_TYPES = ['phone', 'whatsapp', 'email'];
const QUICK_LABELS = { phone: 'اتصال', whatsapp: 'واتساب', email: 'بريد' };

export default function ProfileView({ data, footer = false, pageUrl, className = '' }) {
  const profile = data || {};
  const key = themeKey(profile.theme);
  const links = (profile.links || []).filter((l) => linkUrl(l));
  const style = key === 'custom' ? { '--accent': profile.theme } : undefined;

  const quick = [];
  QUICK_TYPES.forEach((type) => {
    const l = links.find((x) => x.type === type);
    if (l && quick.length < 2) quick.push(l);
  });
  const tiles = links.filter((l) => !quick.includes(l));

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

        <div className="p-quick">
          {quick.map((l, i) => (
            <a key={i} className="p-quick-btn" href={linkUrl(l)} {...external(linkUrl(l))}>
              <PlatformIcon type={l.type} /><span>{QUICK_LABELS[l.type]}</span>
            </a>
          ))}
          <button type="button" className="p-quick-btn p-save" onClick={saveContact}>
            <Icon name="contact" /><span>حفظ الرقم</span>
          </button>
        </div>

        {tiles.length > 0 && (
          <nav className="p-grid">
            {tiles.map((l, i) => {
              const p = PLATFORMS[l.type];
              return (
                <a key={i} className="p-tile" href={linkUrl(l)} {...external(linkUrl(l))}>
                  <span className={'p-tile-icon' + (p.light ? ' light' : '')} style={{ background: p.color }}>
                    <PlatformIcon type={l.type} />
                  </span>
                  <span className="p-tile-label">{l.label || p.label}</span>
                </a>
              );
            })}
          </nav>
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
