// The public page people see when they tap a card or open ?u=username.
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

export default function ProfileView({ data, footer = false, pageUrl, className = '' }) {
  const profile = data || {};
  const key = themeKey(profile.theme);
  const links = (profile.links || []).filter((l) => linkUrl(l));
  const social = links.filter((l) => PLATFORMS[l.type].brand);
  const style = key === 'custom' ? { '--accent': profile.theme } : undefined;

  function saveContact() {
    downloadText((profile.name || 'contact') + '.vcf', vcard(profile, pageUrl), 'text/vcard');
  }

  return (
    <div className={'profile ' + className} data-theme={key} style={style}>
      <main className="p-card">
        <Avatar src={profile.avatar} name={profile.name} />
        <h1 className="p-name">{profile.name || ' '}</h1>
        {profile.bio && <p className="p-bio">{profile.bio}</p>}

        {social.length >= 2 && (
          <div className="p-social">
            {social.slice(0, 6).map((l, i) => (
              <a key={i} className="p-social-btn" href={linkUrl(l)} target="_blank" rel="noopener noreferrer"
                aria-label={PLATFORMS[l.type].label}>
                <PlatformIcon type={l.type} />
              </a>
            ))}
          </div>
        )}

        <button type="button" className="p-save" onClick={saveContact}>
          <Icon name="contact" /><span>حفظ جهة الاتصال</span>
        </button>

        <nav className="p-links">
          {links.map((l, i) => {
            const url = linkUrl(l);
            const external = /^https?:/i.test(url);
            return (
              <a key={i} className="p-link" href={url}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                <span className="p-link-icon"><PlatformIcon type={l.type} /></span>
                <span className="p-link-label">{l.label || PLATFORMS[l.type].label}</span>
                <span className="p-link-arrow"><Icon name="external-link" /></span>
              </a>
            );
          })}
        </nav>

        {footer && (
          <a className="p-footer" href="./">
            <Icon name="nfc" /><span>أنشئ بطاقتك الذكية مع <b>NFC RS</b></span>
          </a>
        )}
      </main>
    </div>
  );
}
