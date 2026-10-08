import { useEffect, useId } from 'react'
import { X } from 'lucide-react'
import { statusTone, outcomeTone, statusDot } from '../lib/constants'
import { fmt, relative, today } from '../lib/dates'

// Dialogs can stack (a case opens an edit form): only the top-most closes on Esc, and the page
// stays locked until the last one is gone.
const dialogStack = []
const lockScroll = () => document.body.classList.toggle('no-scroll', dialogStack.length > 0)

export function Modal({ open, title, ariaLabel, subtitle, onClose, children, footer, wide, className = '' }) {
  useEffect(() => {
    if (!open) return undefined
    const token = {}
    dialogStack.push(token)
    lockScroll()
    const onKey = (e) => {
      if (e.key === 'Escape' && dialogStack[dialogStack.length - 1] === token) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      dialogStack.splice(dialogStack.indexOf(token), 1)
      lockScroll()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={`dialog ${wide ? 'dialog-wide' : ''} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || (typeof title === 'string' ? title : undefined)}
      >
        <header className="dialog-head">
          <div className="dialog-titles">
            <h2>{title}</h2>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function Drawer({ open, onClose, children, label }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="overlay overlay-drawer" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </aside>
    </div>
  )
}

export function Badge({ tone = 'slate', children }) {
  return <span className={`badge tone-${tone}`}>{children}</span>
}

/** Status as a dotted chip (the look used on case cards and the case popup). */
export const StatusChip = ({ status }) => (
  <span className="status-chip" style={{ '--dot': statusDot(status) }}>{status || 'بدون حالة'}</span>
)

export const StatusBadge = ({ status }) => <Badge tone={statusTone(status)}>{status || 'بدون حالة'}</Badge>

/** The ruling outcome; hidden when it only repeats the case status (e.g. both say «شطب»). */
export const OutcomeBadge = ({ outcome, status }) =>
  outcome && outcome !== status ? <Badge tone={outcomeTone(outcome)}>{outcome}</Badge> : null

/** A date with its distance from today, coloured when overdue. */
export function DateCell({ value, overdueTone = true }) {
  if (!value) return <span className="muted">—</span>
  const late = overdueTone && value < today()
  const isToday = value === today()
  return (
    <span className={`date-cell ${late ? 'is-late' : ''} ${isToday ? 'is-today' : ''}`}>
      <span className="date-main">{fmt(value)}</span>
      <span className="date-rel">{relative(value)}</span>
    </span>
  )
}

export function Field({ label, hint, children, full }) {
  const id = useId()
  const child = typeof children === 'function' ? children(id) : children
  return (
    <div className={`field ${full ? 'field-full' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {child}
      {hint && <small className="hint">{hint}</small>}
    </div>
  )
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="empty">
      {Icon && <Icon size={28} strokeWidth={1.5} />}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function PageHead({ title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined && <span className="seg-count">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function DataList({ id, items }) {
  return (
    <datalist id={id}>
      {items.map((v) => (
        <option key={v} value={v} />
      ))}
    </datalist>
  )
}
