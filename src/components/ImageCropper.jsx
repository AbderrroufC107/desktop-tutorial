// Lets the customer zoom and move a photo inside the frame before it is saved.
// Drag (mouse or finger) to move, slider / mouse wheel / two-finger pinch to zoom.
// The photo always covers the whole frame, so no empty edge can show.
import { useEffect, useRef, useState } from 'react';
import { Icon, useToast } from './ui.jsx';
import { IMAGE_SPECS, exportCrop, loadImage } from '../lib/utils.js';

const MAX_ZOOM = 4;

function frameSize(spec) {
  const aspect = spec.width / spec.height;
  const maxW = Math.min(320, window.innerWidth - 64);
  const maxH = Math.min(spec.round ? 320 : 430, window.innerHeight - 280);
  const fw = Math.round(Math.min(maxW, maxH * aspect));
  return { fw, fh: Math.round(fw / aspect) };
}

export default function ImageCropper({ source, kind, onDone, onCancel }) {
  const toast = useToast();
  const spec = IMAGE_SPECS[kind];
  const [{ fw, fh }] = useState(() => frameSize(spec));
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const pointers = useRef(new Map());
  const loaded = useRef(null);
  const gesture = useRef(null);

  const base = img ? Math.max(fw / img.naturalWidth, fh / img.naturalHeight) : 1;
  const scale = base * zoom;
  const dw = img ? img.naturalWidth * scale : fw;
  const dh = img ? img.naturalHeight * scale : fh;

  const clamp = (p, s) => {
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    return { x: Math.min(0, Math.max(fw - w, p.x)), y: Math.min(0, Math.max(fh - h, p.y)) };
  };

  useEffect(() => {
    let alive = true;
    loadImage(source).then((im) => {
      if (!alive) return;
      const s = Math.max(fw / im.naturalWidth, fh / im.naturalHeight);
      loaded.current = im;
      setImg(im);
      setPos({ x: (fw - im.naturalWidth * s) / 2, y: (fh - im.naturalHeight * s) / 2 });
    }, (e) => { toast(e.message, 'err'); onCancel(); });
    return () => {
      alive = false;
      // Free the temporary blob: URL made for a picked file.
      if (typeof source !== 'string' && loaded.current) URL.revokeObjectURL(loaded.current.src);
    };
  }, [source]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // Zoom keeping the point under (cx, cy) in place (default: frame centre).
  function zoomTo(next, cx = fw / 2, cy = fh / 2) {
    if (!img) return;
    const z = Math.min(MAX_ZOOM, Math.max(1, next));
    const oldS = scale;
    const newS = base * z;
    const ix = (cx - pos.x) / oldS;
    const iy = (cy - pos.y) / oldS;
    setZoom(z);
    setPos(clamp({ x: cx - ix * newS, y: cy - iy * newS }, newS));
  }

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current = null;
  }

  function onPointerMove(e) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !img) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (gesture.current) zoomTo(zoom * (dist / gesture.current));
      gesture.current = dist;
      return;
    }
    // Pointer moves are in screen pixels; the frame is laid out left-to-right.
    setPos((p) => clamp({ x: p.x + (e.clientX - prev.x), y: p.y + (e.clientY - prev.y) }, scale));
  }

  function onPointerUp(e) {
    pointers.current.delete(e.pointerId);
    gesture.current = null;
  }

  function onWheel(e) {
    const r = e.currentTarget.getBoundingClientRect();
    zoomTo(zoom * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
  }

  function save() {
    setBusy(true);
    // Let the button show its busy state before the (synchronous) export runs.
    setTimeout(() => {
      try {
        const rect = { sx: -pos.x / scale, sy: -pos.y / scale, sw: fw / scale, sh: fh / scale };
        onDone(exportCrop(img, rect, spec.width, spec.height, spec.maxChars));
      } catch (e) {
        toast(e.message || 'تعذر حفظ الصورة (قد تكون محمية من موقع آخر). ارفعها من جهازك.', 'err');
        setBusy(false);
      }
    }, 30);
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal cropper" id="cropper" role="dialog" aria-modal="true" aria-label="ضبط الصورة" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="btn btn-ghost btn-icon modal-close" aria-label="إغلاق" onClick={onCancel}><Icon name="x" /></button>
        <h2 className="cropper-title">ضبط الصورة</h2>
        <p className="cropper-hint">اسحب الصورة لتحريكها، وكبّر أو صغّر بالشريط.</p>
        <div
          className={'crop-frame' + (spec.round ? ' round' : '')}
          id="crop-frame"
          dir="ltr"
          style={{ width: fw, height: fh }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          {img
            ? <img src={img.src} alt="" draggable="false" style={{ width: dw, height: dh, transform: `translate(${pos.x}px, ${pos.y}px)` }} />
            : <div className="spinner" />}
          {!spec.round && <div className="crop-guides" aria-hidden="true"><i /><i /><i /><i /></div>}
        </div>
        <div className="crop-zoom">
          <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="تصغير" onClick={() => zoomTo(zoom - 0.25)}>−</button>
          <input type="range" id="crop-zoom" min="1" max={MAX_ZOOM} step="0.01" value={zoom} aria-label="التكبير"
            onChange={(e) => zoomTo(Number(e.target.value))} />
          <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="تكبير" onClick={() => zoomTo(zoom + 0.25)}>+</button>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-gold" id="crop-save" disabled={!img || busy} onClick={save}>
            <Icon name="check" />{busy ? 'جارٍ الحفظ…' : 'اعتماد الصورة'}
          </button>
          <button type="button" className="btn" onClick={() => { if (img) { setZoom(1); setPos(clamp({ x: (fw - img.naturalWidth * base) / 2, y: (fh - img.naturalHeight * base) / 2 }, base)); } }}>
            <Icon name="rotate-ccw" />إعادة
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}
