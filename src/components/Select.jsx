import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

// Text of an <option>'s children, which may mix strings, numbers and expressions.
function textOf(node) {
  if (node == null || node === false || node === true) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node.props) return textOf(node.props.children);
  return '';
}

function readOptions(children, group = '') {
  const out = [];
  React.Children.forEach(children, (child) => {
    if (!child) return;
    if (child.type === React.Fragment) {
      out.push(...readOptions(child.props.children, group));
      return;
    }
    if (child.type === 'optgroup') {
      out.push(...readOptions(child.props.children, child.props.label || ''));
      return;
    }
    if (child.type === 'option') {
      const label = textOf(child.props.children);
      const value = child.props.value !== undefined ? String(child.props.value) : label;
      out.push({ value, label, group, disabled: !!child.props.disabled });
    }
  });
  return out;
}

const SEARCH_FROM = 8;

/*
 * A drop-in for <select> with the same props (value, onChange, children <option>s,
 * className, disabled, required, id). onChange receives { target: { value } } so
 * existing handlers that read e.target.value keep working. The list opens in a
 * portal so dialogs with scrolling bodies never clip it.
 */
export default function Select({ value, onChange, children, className = '', disabled, required, id, name, style, title, 'aria-label': ariaLabel }) {
  const options = useMemo(() => readOptions(children), [children]);
  const current = String(value ?? '');
  const selected = options.find((o) => o.value === current);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const [rect, setRect] = useState(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);
  const listId = useId();

  const searchable = options.length >= SEARCH_FROM;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const place = useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    setActive(Math.max(0, visible.findIndex((o) => o.value === current)));
    if (searchable) setTimeout(() => searchRef.current?.focus(), 0);
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target) || listRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (opt) => {
    if (!opt || opt.disabled) return;
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
    if (opt.value !== current) onChange?.({ target: { value: opt.value, name } });
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); triggerRef.current?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(visible.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(visible[active]); }
    else if (e.key === 'Tab') setOpen(false);
  };

  let pop = null;
  if (open && rect) {
    const below = window.innerHeight - rect.bottom;
    const up = below < 280 && rect.top > below;
    const popStyle = {
      position: 'fixed',
      left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.min(Math.max(rect.width, 220), window.innerWidth - 16) - 8)),
      width: Math.min(Math.max(rect.width, 220), window.innerWidth - 16),
      ...(up ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
      maxHeight: Math.min(320, (up ? rect.top : below) - 16),
    };
    pop = createPortal(
      <div ref={listRef} className={`select-pop ${up ? 'is-up' : ''}`} style={popStyle} dir="rtl" onKeyDown={onKeyDown}>
        {searchable && (
          <div className="select-search">
            <Search size={14} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              placeholder="بحث…"
              aria-controls={listId}
            />
          </div>
        )}
        <ul id={listId} role="listbox" className="select-list">
          {visible.length === 0 && <li className="select-empty">لا توجد نتائج</li>}
          {visible.map((o, i) => (
            <React.Fragment key={`${o.value}_${i}`}>
            {o.group && (i === 0 || visible[i - 1].group !== o.group) && <li className="select-group" role="presentation">{o.group}</li>}
            <li
              data-index={i}
              role="option"
              aria-selected={o.value === current}
              aria-disabled={o.disabled || undefined}
              className={`select-option ${i === active ? 'is-active' : ''} ${o.value === current ? 'is-selected' : ''} ${o.disabled ? 'is-disabled' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
            >
              <span>{o.label}</span>
              {o.value === current && <Check size={15} />}
            </li>
            </React.Fragment>
          ))}
        </ul>
      </div>,
      document.body
    );
  }

  const isPlaceholder = !selected || selected.value === '';
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        title={title}
        style={style}
        className={`${className || 'form-select'} select-trigger ${open ? 'is-open' : ''} ${isPlaceholder ? 'is-placeholder' : ''}`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span className="select-value">{selected ? selected.label : (options[0]?.label || '')}</span>
        <ChevronDown size={16} className="select-chevron" aria-hidden="true" />
      </button>
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          className="select-required-proxy"
          value={current}
          required
          onChange={() => {}}
          onFocus={() => triggerRef.current?.focus()}
        />
      )}
      {pop}
    </>
  );
}
