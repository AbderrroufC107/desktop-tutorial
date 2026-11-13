// Platforms, profile themes and browser helpers shared by every page.
import qrcode from 'qrcode-generator';

function handle(v) {
  return encodeURIComponent(String(v).trim().replace(/^@/, ''));
}

// Each platform turns what the user typed (username, number, url) into a link.
export const PLATFORMS = {
  whatsapp:  { label: 'واتساب',     brand: 'whatsapp',  color: '#25D366', hint: '+213555000000', url: (v) => 'https://wa.me/' + v.replace(/\D/g, '') },
  instagram: { label: 'إنستغرام',   brand: 'instagram', color: '#E4405F', hint: 'username',      url: (v) => 'https://instagram.com/' + handle(v) },
  tiktok:    { label: 'تيك توك',    brand: 'tiktok',    color: '#000000', hint: 'username',      url: (v) => 'https://www.tiktok.com/@' + handle(v) },
  facebook:  { label: 'فيسبوك',     brand: 'facebook',  color: '#0866FF', hint: 'username',      url: (v) => 'https://facebook.com/' + handle(v) },
  snapchat:  { label: 'سناب شات',   brand: 'snapchat',  color: '#FFFC00', hint: 'username',      url: (v) => 'https://snapchat.com/add/' + handle(v), light: true },
  youtube:   { label: 'يوتيوب',     brand: 'youtube',   color: '#FF0000', hint: 'channel',       url: (v) => 'https://youtube.com/@' + handle(v) },
  x:         { label: 'X',           brand: 'x',         color: '#000000', hint: 'username',      url: (v) => 'https://x.com/' + handle(v) },
  telegram:  { label: 'تيليغرام',   brand: 'telegram',  color: '#26A5E4', hint: 'username',      url: (v) => 'https://t.me/' + handle(v) },
  threads:   { label: 'ثريدز',      brand: 'threads',   color: '#000000', hint: 'username',      url: (v) => 'https://www.threads.net/@' + handle(v) },
  linkedin:  { label: 'لينكد إن',   brand: 'linkedin',  color: '#0A66C2', hint: 'username',      url: (v) => 'https://linkedin.com/in/' + handle(v) },
  github:    { label: 'GitHub',      brand: 'github',    color: '#181717', hint: 'username',      url: (v) => 'https://github.com/' + handle(v) },
  pinterest: { label: 'بنترست',     brand: 'pinterest', color: '#BD081C', hint: 'username',      url: (v) => 'https://pinterest.com/' + handle(v) },
  spotify:   { label: 'سبوتيفاي',   brand: 'spotify',   color: '#1DB954', hint: 'https://open.spotify.com/...', url: (v) => v },
  phone:     { label: 'اتصل بي',    ui: 'phone',        color: '#16A34A', hint: '+213555000000', url: (v) => 'tel:' + v.replace(/[^\d+]/g, '') },
  email:     { label: 'البريد الإلكتروني', ui: 'mail',  color: '#EA580C', hint: 'me@example.com', url: (v) => 'mailto:' + v.trim() },
  location:  { label: 'موقعي',      ui: 'map-pin',      color: '#DC2626', hint: 'Algiers',       url: (v) => 'https://maps.google.com/?q=' + encodeURIComponent(v.trim()) },
  website:   { label: 'موقعي الإلكتروني', ui: 'globe',  color: '#4F46E5', hint: 'example.com',   url: (v) => (/^https?:\/\//i.test(v) ? v.trim() : 'https://' + v.trim()) }
};

// Ready-made profile looks, stored as "p:<key>" in the profile's theme field.
// Any "#rrggbb" value is a custom accent on a dark page.
export const THEMES = {
  gold:   { label: 'ذهبي فاخر', swatch: 'radial-gradient(circle at 50% 0%, rgba(214,179,106,.45), transparent 65%), #0c0a09', dark: true },
  night:  { label: 'ليلي',      swatch: 'radial-gradient(circle at 50% 0%, rgba(139,92,246,.45), transparent 65%), #0b1020', dark: true },
  violet: { label: 'بنفسجي',    swatch: 'linear-gradient(135deg,#8b5cf6,#4f46e5)', dark: true },
  ocean:  { label: 'محيط',      swatch: 'linear-gradient(135deg,#38bdf8,#2563eb)', dark: true },
  sunset: { label: 'غروب',      swatch: 'linear-gradient(135deg,#fb923c,#db2777)', dark: true },
  forest: { label: 'غابة',      swatch: 'linear-gradient(135deg,#34d399,#047857)', dark: true },
  rose:   { label: 'وردي',      swatch: 'linear-gradient(135deg,#fecdd3,#f9a8d4)' },
  light:  { label: 'أبيض',      swatch: '#f8fafc' }
};
export const DEFAULT_THEME = 'p:gold';

export function themeKey(theme) {
  const m = /^p:([a-z]+)$/.exec(theme || '');
  if (m && THEMES[m[1]]) return m[1];
  if (/^#[0-9a-f]{6}$/i.test(theme || '')) return 'custom';
  return 'gold';
}

// Only allow schemes that can't run code in the page.
function safeUrl(url) {
  return /^(https?:|tel:|mailto:)/i.test(url) ? url : null;
}

export function linkUrl(link) {
  const p = PLATFORMS[link.type];
  const v = String(link.value || '').trim();
  if (!p || !v) return null;
  const raw = /^https?:\/\//i.test(v) && link.type !== 'phone' && link.type !== 'email' ? v : p.url(v);
  return safeUrl(raw);
}

export function safeImage(src) {
  return /^(https?:\/\/|data:image\/)/i.test(src || '') ? src : null;
}

export function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0)).join('') || '?';
}

export function vcard(data, pageUrl) {
  const esc = (s) => String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', 'FN:' + esc(data.name || ''), 'N:' + esc(data.name || '') + ';;;;'];
  if (data.bio) lines.push('NOTE:' + esc(data.bio));
  const phones = new Set();
  (data.links || []).forEach((l) => {
    const v = String(l.value || '').trim();
    if (!v) return;
    if (l.type === 'phone' || l.type === 'whatsapp') {
      const tel = v.replace(/[^\d+]/g, '');
      if (!phones.has(tel)) { phones.add(tel); lines.push('TEL;TYPE=CELL:' + tel); }
    } else if (l.type === 'email') {
      lines.push('EMAIL:' + v);
    } else {
      const u = linkUrl(l);
      if (u) lines.push('URL:' + u);
    }
  });
  if (pageUrl) lines.push('URL:' + pageUrl);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

export function downloadText(filename, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}

export function qrSvg(url) {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

// Web NFC: Chrome on Android over HTTPS only.
export function writeNfc(url) {
  if (!('NDEFReader' in window)) {
    return Promise.reject(new Error('متصفحك لا يدعم الكتابة على NFC. استعمل Chrome على أندرويد، أو انسخ الرابط واكتبه بتطبيق NFC Tools.'));
  }
  return new window.NDEFReader().write({ records: [{ recordType: 'url', data: url }] }, { overwrite: true });
}

// Shrinks a picked photo to a small square JPEG data URL that fits in the database.
export function resizeImage(file, size = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => reject(new Error('تعذر قراءة الصورة.'));
    img.src = URL.createObjectURL(file);
  });
}

export function copyText(text) {
  if (navigator.clipboard) return navigator.clipboard.writeText(text);
  return Promise.reject(new Error('copy unsupported'));
}

export function cleanUsername(v) {
  return v.toLowerCase().replace(/[^a-z0-9_-]/g, '');
}
