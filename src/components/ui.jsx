// Small building blocks used across pages.
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { ICONS } from '../lib/icons.js';
import { PLATFORMS } from '../lib/utils.js';

export function Icon({ name, className = '' }) {
  if (ICONS.ui[name]) {
    return (
      <svg className={'i ' + className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: ICONS.ui[name] }} />
    );
  }
  if (ICONS.brand[name]) {
    return (
      <svg className={'i ' + className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d={ICONS.brand[name]} />
      </svg>
    );
  }
  return null;
}

export function PlatformIcon({ type, className }) {
  const p = PLATFORMS[type];
  if (!p) return null;
  return <Icon name={p.brand || p.ui} className={className} />;
}

export function PlatformBadge({ type, size = 44 }) {
  const p = PLATFORMS[type];
  return (
    <span className={'badge' + (p.light ? ' light' : '')} style={{ background: p.color, width: size, height: size }}>
      <PlatformIcon type={type} />
    </span>
  );
}

export function Logo({ href = './', tag }) {
  return (
    <a className="logo" href={href}>
      <span className="logo-mark"><Icon name="nfc" /></span>
      <span>NFC <b>RS</b></span>
      {tag && <span className="chip gold">{tag}</span>}
    </a>
  );
}

export function Spinner({ text }) {
  return (
    <div className="page-loading">
      <div className="spinner" />
      {text && <span>{text}</span>}
    </div>
  );
}

// Centered status card for "new card", "not found", errors and similar.
export function StateCard({ icon = 'nfc', muted, title, text, code, children }) {
  return (
    <div className="state-page">
      <div className="state-card">
        <div className={'big-ic' + (muted ? ' muted' : '')}><Icon name={icon} /></div>
        <h1>{title}</h1>
        {text && <p>{text}</p>}
        {code && <div className="code-box code">{code}</div>}
        {children}
      </div>
    </div>
  );
}

// A black-and-gold NFC card drawing, used on the landing page.
export function NfcCardArt({ name = 'NFC RS', variant = 'black', className = '' }) {
  return (
    <div className={'card-art ' + variant + ' ' + className}>
      <div className="card-art-top">
        <span className="card-art-brand"><Icon name="nfc" />{name}</span>
        <span className="card-art-chip" />
      </div>
      <div className="card-art-waves"><Icon name="wifi" /></div>
      <div className="card-art-bottom">
        <span className="ltr">TAP TO CONNECT</span>
        <span className="card-art-logo">RS</span>
      </div>
    </div>
  );
}

export function Phone({ children, className = '' }) {
  return (
    <div className={'device ' + className}>
      <div className="device-screen">{children}</div>
    </div>
  );
}

// ---------- toasts ----------

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const show = useCallback((text, kind = '') => {
    setToast({ text, kind, id: Date.now() });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast((t) => (t ? { ...t, hide: true } : t)), 3200);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div id="toast" role="status" className={'toast ' + (toast && !toast.hide ? 'show ' : '') + (toast ? toast.kind : '')}>
        {toast && toast.text}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
