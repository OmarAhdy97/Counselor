import { useEffect, useRef, useState } from 'react'
import { Bell, BellOff, CheckCheck } from 'lucide-react'
import { useNotifications } from '../context/NotificationContext'
import { useUI } from '../context/UIContext'
import { KIND_META } from '../lib/notifications'

/** Bell in the top bar: a badge with what is new today, and a panel listing everything that needs attention. */
export default function NotificationBell() {
  const { items, unread, markAllSeen, enabled, permission, enable, supported } = useNotifications()
  const { openCase, navigate } = useUI()
  const [open, setOpen] = useState(false)
  const box = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => !box.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => {
    setOpen((v) => !v)
    if (!open) setTimeout(markAllSeen, 800)
  }

  const groups = Object.keys(KIND_META)
    .map((kind) => ({ kind, meta: KIND_META[kind], list: items.filter((i) => i.kind === kind) }))
    .filter((g) => g.list.length)

  return (
    <div className="bell" ref={box}>
      <button type="button" className="icon-btn bell-btn" onClick={toggle} aria-label={`التنبيهات${unread ? ` (${unread} جديد)` : ''}`} aria-expanded={open}>
        <Bell size={18} />
        {unread > 0 && <span className="bell-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="bell-pop" role="dialog" aria-label="التنبيهات">
          <div className="bell-head">
            <strong>التنبيهات</strong>
            <span className="muted small">{items.length ? `${items.length} تحتاج انتباهك` : 'لا جديد'}</span>
            {items.length > 0 && (
              <button type="button" className="link push" onClick={markAllSeen}><CheckCheck size={14} /> تمت القراءة</button>
            )}
          </div>

          <div className="bell-body">
            {groups.length === 0 ? (
              <p className="empty-line">كل شيء تحت السيطرة — لا جلسات أو متابعات تنتظرك الآن.</p>
            ) : (
              groups.map(({ kind, meta, list }) => (
                <section key={kind}>
                  <h3 className={`bell-group tone-${meta.tone}`}>{meta.label} <span>{list.length}</span></h3>
                  <ul>
                    {list.slice(0, 6).map((i) => (
                      <li key={i.id}>
                        <button type="button" onClick={() => { setOpen(false); openCase(i.caseId) }}>
                          <strong>{i.title}</strong>
                          {i.sub && <span className="muted small">{i.sub}</span>}
                        </button>
                      </li>
                    ))}
                    {list.length > 6 && (
                      <li><button type="button" className="more" onClick={() => { setOpen(false); navigate(kind === 'followup' ? 'followups' : kind === 'deadline' ? 'rulings' : 'roll') }}>
                        و{list.length - 6} أخرى…
                      </button></li>
                    )}
                  </ul>
                </section>
              ))
            )}
          </div>

          {supported && !enabled && permission !== 'denied' && (
            <button type="button" className="bell-foot" onClick={enable}>
              <Bell size={15} /> فعّل تنبيهات الهاتف / المتصفح
            </button>
          )}
          {permission === 'denied' && (
            <p className="bell-foot is-muted"><BellOff size={15} /> التنبيهات محظورة من إعدادات المتصفح لهذا الموقع.</p>
          )}
        </div>
      )}
    </div>
  )
}
