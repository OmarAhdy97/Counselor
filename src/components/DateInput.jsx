import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
// The Egyptian week starts on Saturday.
const WEEKDAYS = ['سبت', 'أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'];

const pad = (n) => String(n).padStart(2, '0');
const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseIso = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const label = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

/*
 * A date field with an Arabic month calendar. Same contract as <input type="date">:
 * value is "YYYY-MM-DD" (or ''), onChange receives { target: { value } }.
 */
export default function DateInput({ value, onChange, className = 'form-input', required, disabled, min, max, id, name, placeholder = 'اختر التاريخ', title }) {
  const selected = parseIso(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => selected || new Date());
  const [rect, setRect] = useState(null);
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  const minD = parseIso(min);
  const maxD = parseIso(max);

  useEffect(() => {
    if (!open) return;
    setView(parseIso(value) || new Date());
    triggerRef.current?.scrollIntoView({ block: 'nearest' });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const place = useCallback(() => { if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect()); }, []);
  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const days = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const lead = (first.getDay() + 1) % 7; // Saturday = 0
    const total = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(new Date(view.getFullYear(), view.getMonth(), d));
    return cells;
  }, [view]);

  const todayIso = toIso(new Date());
  const isOff = (d) => (minD && d < minD) || (maxD && d > maxD);
  const commit = (v) => {
    onChange?.({ target: { value: v, name } });
    setOpen(false);
    triggerRef.current?.focus();
  };
  const shift = (months) => setView((v) => new Date(v.getFullYear(), v.getMonth() + months, 1));

  let pop = null;
  if (open && rect) {
    const W = 296;
    const H = 372;
    const below = window.innerHeight - rect.bottom;
    const up = below < H && rect.top > below;
    const left = Math.min(Math.max(8, rect.right - W), window.innerWidth - W - 8);
    const top = Math.min(Math.max(8, up ? rect.top - H - 6 : rect.bottom + 6), Math.max(8, window.innerHeight - H - 8));
    pop = createPortal(
      <div
        ref={popRef}
        className="date-pop"
        dir="rtl"
        role="dialog"
        aria-label="اختيار التاريخ"
        style={{ position: 'fixed', left, top, width: W }}
      >
        <div className="date-pop-head">
          <button type="button" className="date-nav" onClick={() => shift(-1)} aria-label="الشهر السابق"><ChevronRight size={16} /></button>
          <div className="date-pop-title">
            <span>{MONTHS[view.getMonth()]}</span>
            <button type="button" className="date-year" onClick={() => shift(-12)} aria-label="السنة السابقة">‹</button>
            <b>{view.getFullYear()}</b>
            <button type="button" className="date-year" onClick={() => shift(12)} aria-label="السنة التالية">›</button>
          </div>
          <button type="button" className="date-nav" onClick={() => shift(1)} aria-label="الشهر التالي"><ChevronLeft size={16} /></button>
        </div>
        <div className="date-grid date-weekdays">
          {WEEKDAYS.map((w, i) => <span key={w} className={i === 6 ? 'is-weekend' : ''}>{w}</span>)}
        </div>
        <div className="date-grid">
          {days.map((d, i) => {
            if (!d) return <span key={`e${i}`} />;
            const iso = toIso(d);
            const off = isOff(d);
            return (
              <button
                key={iso}
                type="button"
                disabled={off}
                className={`date-day ${iso === value ? 'is-selected' : ''} ${iso === todayIso ? 'is-today' : ''} ${d.getDay() === 5 ? 'is-weekend' : ''}`}
                onClick={() => commit(iso)}
                aria-pressed={iso === value}
                aria-label={label(d)}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
        <div className="date-pop-foot">
          <button type="button" className="date-link" onClick={() => commit(todayIso)}>اليوم</button>
          {!required && value && <button type="button" className="date-link is-muted" onClick={() => commit('')}>مسح</button>}
        </div>
      </div>,
      document.body
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        title={title}
        disabled={disabled}
        className={`${className} date-trigger ${open ? 'is-open' : ''} ${selected ? '' : 'is-placeholder'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <CalendarDays size={16} className="date-trigger-icon" aria-hidden="true" />
        <span className="date-trigger-value">{selected ? label(selected) : placeholder}</span>
        {selected && !required && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            className="date-clear"
            aria-label="مسح التاريخ"
            onClick={(e) => { e.stopPropagation(); onChange?.({ target: { value: '', name } }); }}
          >
            <X size={13} />
          </span>
        )}
      </button>
      {required && (
        <input tabIndex={-1} aria-hidden="true" className="select-required-proxy" value={value || ''} required onChange={() => {}} onFocus={() => triggerRef.current?.focus()} />
      )}
      {pop}
    </>
  );
}
