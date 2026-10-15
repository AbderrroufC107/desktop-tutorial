// Shared logic for every page: platforms, icons, profile rendering, QR, NFC.
(function (global) {
  'use strict';

  var ICONS = global.MyLinkIcons || { brand: {}, ui: {} };

  function handle(v) {
    return encodeURIComponent(String(v).trim().replace(/^@/, ''));
  }

  // Each platform turns what the user typed (username, number, url) into a link.
  var PLATFORMS = {
    whatsapp:  { label: 'واتساب',     brand: 'whatsapp',  color: '#25D366', hint: '+213555000000', url: function (v) { return 'https://wa.me/' + v.replace(/\D/g, ''); } },
    instagram: { label: 'إنستغرام',   brand: 'instagram', color: '#E4405F', hint: 'username',      url: function (v) { return 'https://instagram.com/' + handle(v); } },
    tiktok:    { label: 'تيك توك',    brand: 'tiktok',    color: '#000000', hint: 'username',      url: function (v) { return 'https://www.tiktok.com/@' + handle(v); } },
    facebook:  { label: 'فيسبوك',     brand: 'facebook',  color: '#0866FF', hint: 'username',      url: function (v) { return 'https://facebook.com/' + handle(v); } },
    snapchat:  { label: 'سناب شات',   brand: 'snapchat',  color: '#FFFC00', hint: 'username',      url: function (v) { return 'https://snapchat.com/add/' + handle(v); } },
    youtube:   { label: 'يوتيوب',     brand: 'youtube',   color: '#FF0000', hint: 'channel',       url: function (v) { return 'https://youtube.com/@' + handle(v); } },
    x:         { label: 'X',           brand: 'x',         color: '#000000', hint: 'username',      url: function (v) { return 'https://x.com/' + handle(v); } },
    telegram:  { label: 'تيليغرام',   brand: 'telegram',  color: '#26A5E4', hint: 'username',      url: function (v) { return 'https://t.me/' + handle(v); } },
    threads:   { label: 'ثريدز',      brand: 'threads',   color: '#000000', hint: 'username',      url: function (v) { return 'https://www.threads.net/@' + handle(v); } },
    linkedin:  { label: 'لينكد إن',   brand: 'linkedin',  color: '#0A66C2', hint: 'username',      url: function (v) { return 'https://linkedin.com/in/' + handle(v); } },
    github:    { label: 'GitHub',      brand: 'github',    color: '#181717', hint: 'username',      url: function (v) { return 'https://github.com/' + handle(v); } },
    pinterest: { label: 'بنترست',     brand: 'pinterest', color: '#BD081C', hint: 'username',      url: function (v) { return 'https://pinterest.com/' + handle(v); } },
    spotify:   { label: 'سبوتيفاي',   brand: 'spotify',   color: '#1DB954', hint: 'https://open.spotify.com/...', url: function (v) { return v; } },
    phone:     { label: 'اتصل بي',    ui: 'phone',        color: '#16A34A', hint: '+213555000000', url: function (v) { return 'tel:' + v.replace(/[^\d+]/g, ''); } },
    email:     { label: 'البريد الإلكتروني', ui: 'mail',  color: '#EA580C', hint: 'me@example.com', url: function (v) { return 'mailto:' + v.trim(); } },
    location:  { label: 'موقعي',      ui: 'map-pin',      color: '#DC2626', hint: 'Algiers',       url: function (v) { return 'https://maps.google.com/?q=' + encodeURIComponent(v.trim()); } },
    website:   { label: 'موقعي الإلكتروني', ui: 'globe',  color: '#4F46E5', hint: 'example.com',   url: function (v) { return /^https?:\/\//i.test(v) ? v.trim() : 'https://' + v.trim(); } }
  };

  // Ready-made page looks. Stored as "p:<key>" in the profile's theme field;
  // any "#rrggbb" value is a custom accent on a light page.
  var THEMES = {
    violet: { label: 'بنفسجي', swatch: 'linear-gradient(135deg,#8b5cf6,#4f46e5)' },
    ocean:  { label: 'محيط',   swatch: 'linear-gradient(135deg,#38bdf8,#2563eb)' },
    sunset: { label: 'غروب',   swatch: 'linear-gradient(135deg,#fb923c,#db2777)' },
    forest: { label: 'غابة',   swatch: 'linear-gradient(135deg,#34d399,#047857)' },
    rose:   { label: 'وردي',   swatch: 'linear-gradient(135deg,#fecdd3,#f9a8d4)' },
    night:  { label: 'ليلي',   swatch: 'linear-gradient(135deg,#1e293b,#0f172a)' },
    gold:   { label: 'فاخر',   swatch: 'linear-gradient(135deg,#292524,#0c0a09)' },
    light:  { label: 'أبيض',   swatch: '#f8fafc' }
  };
  var DEFAULT_THEME = 'p:violet';

  function themeKey(theme) {
    var m = /^p:([a-z]+)$/.exec(theme || '');
    if (m && THEMES[m[1]]) return m[1];
    if (/^#[0-9a-f]{6}$/i.test(theme || '')) return 'custom';
    return 'violet';
  }

  // ---------- icons ----------

  function svg(name, cls) {
    var inner = ICONS.ui[name];
    if (!inner) return '';
    return '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }

  function brandSvg(name, cls) {
    var d = ICONS.brand[name];
    if (!d) return '';
    return '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="' + d + '"/></svg>';
  }

  function platformIcon(type, cls) {
    var p = PLATFORMS[type];
    if (!p) return '';
    return p.brand ? brandSvg(p.brand, cls) : svg(p.ui, cls);
  }

  // Replaces every <i data-icon="name"> placeholder in the page with its SVG.
  function hydrateIcons(root) {
    (root || document).querySelectorAll('i[data-icon]').forEach(function (el) {
      var name = el.getAttribute('data-icon');
      el.outerHTML = ICONS.ui[name] ? svg(name, el.className) : brandSvg(name, el.className);
    });
  }

  // ---------- links ----------

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

  function safeImage(src) {
    return /^(https?:\/\/|data:image\/)/i.test(src || '') ? src : null;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('') || '?';
  }

  function vcard(data, pageUrl) {
    var esc = function (s) { return String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n'); };
    var lines = ['BEGIN:VCARD', 'VERSION:3.0', 'FN:' + esc(data.name || ''), 'N:' + esc(data.name || '') + ';;;;'];
    if (data.bio) lines.push('NOTE:' + esc(data.bio));
    var phones = {};
    (data.links || []).forEach(function (l) {
      var v = String(l.value || '').trim();
      if (!v) return;
      if (l.type === 'phone' || l.type === 'whatsapp') {
        var tel = v.replace(/[^\d+]/g, '');
        if (!phones[tel]) { phones[tel] = 1; lines.push('TEL;TYPE=CELL:' + tel); }
      } else if (l.type === 'email') lines.push('EMAIL:' + v);
      else { var u = linkUrl(l); if (u) lines.push('URL:' + u); }
    });
    if (pageUrl) lines.push('URL:' + pageUrl);
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

  // ---------- public profile ----------

  function renderProfile(root, data, opts) {
    data = data || {};
    opts = opts || {};
    root.innerHTML = '';
    root.classList.add('profile');
    var key = themeKey(data.theme);
    root.setAttribute('data-theme', key);
    if (key === 'custom') root.style.setProperty('--accent', data.theme);
    else root.style.removeProperty('--accent');

    var card = el('main', 'p-card');

    var avatarSrc = safeImage(data.avatar);
    var avatar = el('div', 'p-avatar');
    if (avatarSrc) {
      var img = el('img');
      img.alt = data.name || '';
      img.src = avatarSrc;
      img.referrerPolicy = 'no-referrer';
      img.onerror = function () { avatar.textContent = initials(data.name); };
      avatar.appendChild(img);
    } else {
      avatar.textContent = initials(data.name);
    }
    card.appendChild(avatar);

    card.appendChild(el('h1', 'p-name', data.name || ' '));
    if (data.bio) card.appendChild(el('p', 'p-bio', data.bio));

    var links = (data.links || []).filter(function (l) { return linkUrl(l); });

    // Quick icon row for the social accounts, like a business card.
    var social = links.filter(function (l) { return PLATFORMS[l.type].brand; });
    if (social.length >= 2) {
      var row = el('div', 'p-social');
      social.slice(0, 6).forEach(function (l) {
        var a = el('a', 'p-social-btn');
        a.href = linkUrl(l);
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.setAttribute('aria-label', PLATFORMS[l.type].label);
        a.innerHTML = platformIcon(l.type);
        row.appendChild(a);
      });
      card.appendChild(row);
    }

    var save = el('button', 'p-save');
    save.type = 'button';
    save.innerHTML = svg('contact') + '<span>حفظ جهة الاتصال</span>';
    save.onclick = function () {
      downloadText((data.name || 'contact') + '.vcf', vcard(data, opts.pageUrl), 'text/vcard');
    };
    card.appendChild(save);

    var list = el('nav', 'p-links');
    links.forEach(function (link) {
      var url = linkUrl(link);
      var a = el('a', 'p-link');
      a.href = url;
      if (/^https?:/i.test(url)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      var icon = el('span', 'p-link-icon');
      icon.innerHTML = platformIcon(link.type);
      a.appendChild(icon);
      a.appendChild(el('span', 'p-link-label', link.label || PLATFORMS[link.type].label));
      var arrow = el('span', 'p-link-arrow');
      arrow.innerHTML = svg('external-link');
      a.appendChild(arrow);
      list.appendChild(a);
    });
    card.appendChild(list);

    if (opts.footer) {
      var foot = el('a', 'p-footer');
      foot.href = './';
      foot.innerHTML = svg('nfc') + '<span>أنشئ صفحتك مجاناً مع <b>My Link</b></span>';
      card.appendChild(foot);
    }

    root.appendChild(card);
    if (data.name && opts.footer) document.title = data.name + ' | My Link';
  }

  // ---------- QR / NFC / images ----------

  function qrSvg(url) {
    if (!global.qrcode) return null;
    var qr = global.qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }

  function nfcSupported() {
    return 'NDEFReader' in global;
  }

  // Web NFC: Chrome on Android over HTTPS only.
  function writeNfc(url) {
    if (!nfcSupported()) {
      return Promise.reject(new Error('متصفحك لا يدعم الكتابة على NFC. استعمل Chrome على أندرويد، أو انسخ الرابط واكتبه بتطبيق NFC Tools.'));
    }
    return new global.NDEFReader().write({ records: [{ recordType: 'url', data: url }] }, { overwrite: true });
  }

  // Shrinks a picked photo to a small square JPEG data URL that fits in the database.
  function resizeImage(file, size) {
    size = size || 256;
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(img.width, img.height);
        var canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        canvas.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        URL.revokeObjectURL(img.src);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = function () { reject(new Error('تعذر قراءة الصورة.')); };
      img.src = URL.createObjectURL(file);
    });
  }

  function copyText(text) {
    if (navigator.clipboard) return navigator.clipboard.writeText(text);
    return Promise.reject(new Error('copy unsupported'));
  }

  // Small toast at the bottom of the screen.
  var toastTimer = null;
  function toast(text, kind) {
    var t = document.getElementById('toast');
    if (!t) {
      t = el('div', 'toast');
      t.id = 'toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = text;
    t.className = 'toast show ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast ' + (kind || ''); }, 3200);
  }

  global.MyLink = {
    PLATFORMS: PLATFORMS,
    THEMES: THEMES,
    DEFAULT_THEME: DEFAULT_THEME,
    themeKey: themeKey,
    svg: svg,
    brandSvg: brandSvg,
    platformIcon: platformIcon,
    hydrateIcons: hydrateIcons,
    linkUrl: linkUrl,
    renderProfile: renderProfile,
    downloadText: downloadText,
    qrSvg: qrSvg,
    nfcSupported: nfcSupported,
    writeNfc: writeNfc,
    resizeImage: resizeImage,
    copyText: copyText,
    toast: toast
  };
})(window);
