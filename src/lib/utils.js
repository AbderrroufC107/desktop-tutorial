// Platforms, profile themes and browser helpers shared by every page.
import qrcode from 'qrcode-generator';

function handle(v) {
  return encodeURIComponent(String(v).trim().replace(/^@/, ''));
}

// Each platform turns what the customer typed into a link. Social accounts ask for the
// profile link (pasted from the app); a bare username from older pages still works.
// kind: 'link' (profile URL), 'phone' (number), 'email', 'place' (address or maps link).
export const PLATFORMS = {
  whatsapp:  { label: 'واتساب',    brand: 'whatsapp',  color: '#25D366', kind: 'phone', ask: 'رقم واتساب مع رمز الدولة', hint: '+213 555 00 00 00', url: (v) => 'https://wa.me/' + v.replace(/\D/g, '') },
  phone:     { label: 'اتصال',     ui: 'phone',        color: '#16A34A', kind: 'phone', ask: 'رقم الهاتف', hint: '+213 555 00 00 00', url: (v) => 'tel:' + v.replace(/[^\d+]/g, '') },
  instagram: { label: 'إنستغرام',  brand: 'instagram', color: '#E4405F', kind: 'link', ask: 'رابط حسابك على إنستغرام', hint: 'https://instagram.com/yourname', url: (v) => 'https://instagram.com/' + handle(v) },
  facebook:  { label: 'فيسبوك',    brand: 'facebook',  color: '#0866FF', kind: 'link', ask: 'رابط صفحتك أو حسابك على فيسبوك', hint: 'https://facebook.com/yourpage', url: (v) => 'https://facebook.com/' + handle(v) },
  tiktok:    { label: 'تيك توك',   brand: 'tiktok',    color: '#000000', kind: 'link', ask: 'رابط حسابك على تيك توك', hint: 'https://tiktok.com/@yourname', url: (v) => 'https://www.tiktok.com/@' + handle(v) },
  snapchat:  { label: 'سناب شات',  brand: 'snapchat',  color: '#FFFC00', kind: 'link', ask: 'رابط حسابك على سناب شات', hint: 'https://snapchat.com/add/yourname', url: (v) => 'https://snapchat.com/add/' + handle(v), light: true },
  youtube:   { label: 'يوتيوب',    brand: 'youtube',   color: '#FF0000', kind: 'link', ask: 'رابط قناتك على يوتيوب', hint: 'https://youtube.com/@yourchannel', url: (v) => 'https://youtube.com/@' + handle(v) },
  telegram:  { label: 'تيليغرام',  brand: 'telegram',  color: '#26A5E4', kind: 'link', ask: 'رابط حسابك على تيليغرام', hint: 'https://t.me/yourname', url: (v) => 'https://t.me/' + handle(v) },
  linkedin:  { label: 'لينكد إن',  brand: 'linkedin',  color: '#0A66C2', kind: 'link', ask: 'رابط حسابك على لينكد إن', hint: 'https://linkedin.com/in/yourname', url: (v) => 'https://linkedin.com/in/' + handle(v) },
  x:         { label: 'X',          brand: 'x',         color: '#000000', kind: 'link', ask: 'رابط حسابك على X', hint: 'https://x.com/yourname', url: (v) => 'https://x.com/' + handle(v) },
  threads:   { label: 'ثريدز',     brand: 'threads',   color: '#000000', kind: 'link', ask: 'رابط حسابك على ثريدز', hint: 'https://threads.net/@yourname', url: (v) => 'https://www.threads.net/@' + handle(v) },
  pinterest: { label: 'بنترست',    brand: 'pinterest', color: '#BD081C', kind: 'link', ask: 'رابط حسابك على بنترست', hint: 'https://pinterest.com/yourname', url: (v) => 'https://pinterest.com/' + handle(v) },
  spotify:   { label: 'سبوتيفاي',  brand: 'spotify',   color: '#1DB954', kind: 'link', ask: 'رابط حسابك أو قائمتك على سبوتيفاي', hint: 'https://open.spotify.com/...', url: (v) => 'https://' + v.trim() },
  github:    { label: 'GitHub',     brand: 'github',    color: '#181717', kind: 'link', ask: 'رابط حسابك على GitHub', hint: 'https://github.com/yourname', url: (v) => 'https://github.com/' + handle(v) },
  website:   { label: 'الموقع الإلكتروني', ui: 'globe', color: '#4F46E5', kind: 'link', ask: 'رابط موقعك أو متجرك', hint: 'https://example.com', url: (v) => 'https://' + v.trim() },
  email:     { label: 'البريد',    ui: 'mail',         color: '#EA580C', kind: 'email', ask: 'بريدك الإلكتروني', hint: 'name@example.com', url: (v) => 'mailto:' + v.trim() },
  location:  { label: 'الموقع',    ui: 'map-pin',      color: '#DC2626', kind: 'place', ask: 'عنوانك أو رابط خرائط جوجل', hint: 'https://maps.app.goo.gl/...', url: (v) => 'https://maps.google.com/?q=' + encodeURIComponent(v.trim()) },
  // Payment details: shown with a copy button instead of opening a link.
  ccp:       { label: 'CCP',        ui: 'landmark',     color: '#FFC20E', kind: 'pay', light: true, ask: 'رقم حساب CCP مع المفتاح', hint: '0012345678 clé 90' },
  rip:       { label: 'بريدي موب (RIP)', ui: 'wallet',  color: '#00529B', kind: 'pay', ask: 'رقم RIP (20 رقماً) للتحويل عبر بريدي موب', hint: '00799999 0012345678 90' },
  card:      { label: 'بطاقة دفع',  ui: 'credit-card',  color: '#B8892D', kind: 'pay', ask: 'رقم البطاقة (الذهبية، CIB…) — لا تكتب الرمز السري أبداً', hint: '6280 0000 0000 0000' },
  bank:      { label: 'حساب بنكي (RIB)', ui: 'banknote', color: '#0F766E', kind: 'pay', ask: 'رقم RIB البنكي', hint: '000 00000 0000000000 00' }
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

export function isPayment(link) {
  const p = PLATFORMS[link.type];
  return !!p && p.kind === 'pay' && !!String(link.value || '').trim();
}

// Something worth showing on the public page: a working link or a payment detail.
export function isShown(link) {
  return isPayment(link) || !!linkUrl(link);
}

export function linkUrl(link) {
  const p = PLATFORMS[link.type];
  const v = String(link.value || '').trim();
  if (!p || !v || p.kind === 'pay') return null;
  let raw;
  if (p.kind === 'phone' || p.kind === 'email') raw = p.url(v);
  else if (/^https?:\/\//i.test(v)) raw = v;
  // A pasted link without the scheme, e.g. "instagram.com/name" or "www.facebook.com/page".
  else if (/^[\w-]+(\.[\w-]+)+\/\S*$/.test(v) || /^www\./i.test(v)) raw = 'https://' + v;
  else raw = p.url(v);
  return safeUrl(raw);
}

export function safeImage(src) {
  return /^(https?:\/\/|data:image\/)/i.test(src || '') ? src : null;
}

export function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0)).join('') || '?';
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

// Loads a picked File (or an existing image URL) into an <img>, refusing formats browsers cannot read.
export function loadImage(source) {
  return new Promise((resolve, reject) => {
    const isFile = typeof source !== 'string';
    if (isFile && (/hei[cf]/i.test(source.type) || /\.hei[cf]$/i.test(source.name || ''))) {
      reject(new Error('صيغة HEIC (صور الآيفون) غير مدعومة في المتصفح. خذ لقطة شاشة للصورة أو حوّلها إلى JPG ثم ارفعها.'));
      return;
    }
    const img = new Image();
    const url = isFile ? URL.createObjectURL(source) : source;
    // Remote photos (e.g. a Google profile picture) must allow CORS, or the canvas could not export them.
    if (!isFile && /^https?:/i.test(url)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('تعذر قراءة هذه الصورة. استعمل صورة JPG أو PNG.'));
    img.src = url;
  });
}

// Draws the source rectangle (sx, sy, sw, sh) of img into outW x outH and returns a JPEG data URL
// no longer than maxChars, lowering the quality (and then the size) until it fits the database limit.
export function exportCrop(img, rect, outW, outH, maxChars) {
  let w = outW;
  let h = outH;
  for (let attempt = 0; attempt < 4; attempt++) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, w, h);
    for (let q = 0.82; q >= 0.5; q -= 0.08) {
      const url = canvas.toDataURL('image/jpeg', q);
      if (url.length <= maxChars) return url;
    }
    w = Math.round(w * 0.8);
    h = Math.round(h * 0.8);
  }
  throw new Error('الصورة معقدة جداً، جرّب صورة أخرى.');
}

// Output size and database limit for each kind of picture (limits match the server and rules).
export const IMAGE_SPECS = {
  avatar: { width: 256, height: 256, maxChars: 140000, round: true },
  cover: { width: 720, height: 1280, maxChars: 380000, round: false }
};

// Centre crop without user adjustment.
export async function cropImage(file, width, height, maxChars) {
  const img = await loadImage(file);
  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
  const sw = width / scale;
  const sh = height / scale;
  const rect = { sx: (img.naturalWidth - sw) / 2, sy: (img.naturalHeight - sh) / 2, sw, sh };
  if (typeof file !== 'string') URL.revokeObjectURL(img.src);
  return exportCrop(img, rect, width, height, maxChars);
}

export const COVER_LIGHT = { min: 30, max: 170, initial: 100 };

export function coverLight(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(COVER_LIGHT.max, Math.max(COVER_LIGHT.min, Math.round(n))) : COVER_LIGHT.initial;
}

export function copyText(text) {
  if (navigator.clipboard) return navigator.clipboard.writeText(text);
  return Promise.reject(new Error('copy unsupported'));
}

export function cleanUsername(v) {
  return v.toLowerCase().replace(/[^a-z0-9_-]/g, '');
}
