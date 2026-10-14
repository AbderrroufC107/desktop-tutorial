// Shared logic for the profile page and the editor.
(function (global) {
  'use strict';

  var ICON_CDN = 'https://cdn.jsdelivr.net/npm/simple-icons@11.0.0/icons/';

  function handle(v) {
    return encodeURIComponent(String(v).trim().replace(/^@/, ''));
  }

  // Each platform turns the value the user typed (username, number, url) into a link.
  var PLATFORMS = {
    whatsapp:  { label: 'واتساب',    color: '#25D366', icon: 'whatsapp',  hint: '+213555000000', url: function (v) { return 'https://wa.me/' + v.replace(/\D/g, ''); } },
    instagram: { label: 'إنستغرام',  color: '#E4405F', icon: 'instagram', hint: 'username',      url: function (v) { return 'https://instagram.com/' + handle(v); } },
    tiktok:    { label: 'تيك توك',   color: '#000000', icon: 'tiktok',    hint: 'username',      url: function (v) { return 'https://www.tiktok.com/@' + handle(v); } },
    facebook:  { label: 'فيسبوك',    color: '#1877F2', icon: 'facebook',  hint: 'username',      url: function (v) { return 'https://facebook.com/' + handle(v); } },
    snapchat:  { label: 'سناب شات',  color: '#FFFC00', icon: 'snapchat',  hint: 'username',      url: function (v) { return 'https://snapchat.com/add/' + handle(v); }, dark: true },
    youtube:   { label: 'يوتيوب',    color: '#FF0000', icon: 'youtube',   hint: 'channel',       url: function (v) { return 'https://youtube.com/@' + handle(v); } },
    x:         { label: 'X',          color: '#000000', icon: 'x',         hint: 'username',      url: function (v) { return 'https://x.com/' + handle(v); } },
    telegram:  { label: 'تيليغرام',  color: '#26A5E4', icon: 'telegram',  hint: 'username',      url: function (v) { return 'https://t.me/' + handle(v); } },
    linkedin:  { label: 'لينكد إن',  color: '#0A66C2', icon: 'linkedin',  hint: 'username',      url: function (v) { return 'https://linkedin.com/in/' + handle(v); } },
    github:    { label: 'GitHub',     color: '#181717', icon: 'github',    hint: 'username',      url: function (v) { return 'https://github.com/' + handle(v); } },
    phone:     { label: 'اتصال',     color: '#16A34A', glyph: '☎',       hint: '+213555000000', url: function (v) { return 'tel:' + v.replace(/[^\d+]/g, ''); } },
    email:     { label: 'البريد',    color: '#EA580C', glyph: '@',        hint: 'me@example.com', url: function (v) { return 'mailto:' + v.trim(); } },
    location:  { label: 'الموقع',    color: '#DC2626', glyph: '⌖',       hint: 'Algiers',       url: function (v) { return 'https://maps.google.com/?q=' + encodeURIComponent(v.trim()); } },
    website:   { label: 'موقع ويب',  color: '#4F46E5', glyph: '↗',       hint: 'example.com',   url: function (v) { return /^https?:\/\//i.test(v) ? v.trim() : 'https://' + v.trim(); } }
  };

  // Only allow schemes that can't run code in the page.
  function safeUrl(url) {
    return /^(https?:|tel:|mailto:)/i.test(url) ? url : null;
  }

  function linkUrl(link) {
    var p = PLATFORMS[link.type];
    var v = String(link.value || '').trim();
    if (!p || !v) return null;
    var url = /^https?:\/\//i.test(v) && link.type !== 'phone' && link.type !== 'email' ? v : p.url(v);
    return safeUrl(url);
  }

  function safeColor(c, fallback) {
    return /^#[0-9a-f]{3,8}$/i.test(c || '') ? c : fallback;
  }

  function safeImage(src) {
    return /^(https?:\/\/|data:image\/)/i.test(src || '') ? src : null;
  }

  // base64url <-> UTF-8 JSON, so Arabic text survives inside a link.
  function encodeProfile(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj));
    var bin = '';
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeProfile(str) {
    var b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function iconFor(type) {
    var p = PLATFORMS[type];
    var wrap = el('span', 'icon');
    wrap.style.background = p.color;
    if (p.dark) wrap.classList.add('icon-dark');
    if (p.icon) {
      var img = el('img');
      img.alt = '';
      img.src = ICON_CDN + p.icon + '.svg';
      img.onerror = function () { wrap.textContent = p.label.charAt(0); };
      wrap.appendChild(img);
    } else {
      wrap.textContent = p.glyph;
    }
    return wrap;
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase() || '?';
  }

  function vcard(data) {
    var lines = ['BEGIN:VCARD', 'VERSION:3.0', 'FN:' + (data.name || ''), 'N:' + (data.name || '') + ';;;;'];
    if (data.bio) lines.push('NOTE:' + data.bio.replace(/\n/g, '\\n'));
    (data.links || []).forEach(function (l) {
      var v = String(l.value || '').trim();
      if (!v) return;
      if (l.type === 'phone' || l.type === 'whatsapp') lines.push('TEL;TYPE=CELL:' + v);
      else if (l.type === 'email') lines.push('EMAIL:' + v);
      else { var u = linkUrl(l); if (u) lines.push('URL:' + u); }
    });
    lines.push('END:VCARD');
    return lines.join('\r\n');
  }

  function downloadText(filename, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function renderProfile(root, data) {
    data = data || {};
    root.innerHTML = '';
    root.style.setProperty('--accent', safeColor(data.theme, '#6d28d9'));

    var card = el('main', 'card');

    var avatarSrc = safeImage(data.avatar);
    var avatar = el('div', 'avatar');
    if (avatarSrc) {
      var img = el('img');
      img.alt = data.name || '';
      img.src = avatarSrc;
      img.onerror = function () { avatar.textContent = initials(data.name); };
      avatar.appendChild(img);
    } else {
      avatar.textContent = initials(data.name);
    }
    card.appendChild(avatar);

    card.appendChild(el('h1', 'name', data.name || 'بدون اسم'));
    if (data.bio) card.appendChild(el('p', 'bio', data.bio));

    var list = el('nav', 'links');
    (data.links || []).forEach(function (link) {
      var url = linkUrl(link);
      if (!url) return;
      var a = el('a', 'link');
      a.href = url;
      if (/^https?:/i.test(url)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      a.appendChild(iconFor(link.type));
      a.appendChild(el('span', 'link-label', link.label || PLATFORMS[link.type].label));
      list.appendChild(a);
    });
    card.appendChild(list);

    var save = el('button', 'save-contact', 'حفظ جهة الاتصال');
    save.type = 'button';
    save.onclick = function () {
      downloadText((data.name || 'contact') + '.vcf', vcard(data), 'text/vcard');
    };
    card.appendChild(save);

    root.appendChild(card);
    if (data.name) document.title = data.name;
  }

  global.MyLink = {
    PLATFORMS: PLATFORMS,
    linkUrl: linkUrl,
    encodeProfile: encodeProfile,
    decodeProfile: decodeProfile,
    renderProfile: renderProfile,
    downloadText: downloadText
  };
})(window);
