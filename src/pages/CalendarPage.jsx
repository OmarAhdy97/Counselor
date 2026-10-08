import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck2, Check, ChevronLeft, ChevronRight, ExternalLink, Gavel, Plus, RefreshCw } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useCalendar } from '../context/CalendarContext'
import { useToast } from '../context/ToastContext'
import { useUI } from '../context/UIContext'
import { friendlyError } from '../lib/errors'
import DateInput from '../components/DateInput'
import { Badge, Empty, PageHead } from '../components/ui'
import { OPEN_STATUSES, caseTitle } from '../lib/constants'
import { fmt, fmtLong, parseISO, toISO, today } from '../lib/dates'
import { useAuth } from '../context/AuthContext'
import { desiredEvents, eventTemplateUrl, googleDayUrl as dayUrl } from '../lib/googleCalendar'
import { CalendarPlus } from 'lucide-react'

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const WEEKDAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']

const TYPES = {
  session: { label: 'جلسة', tone: 'blue', field: 'next_session' },
  ruling: { label: 'نطق بالحكم', tone: 'violet', field: 'next_session' },
  followup: { label: 'متابعة', tone: 'amber', field: 'followup_date' },
  deadline: { label: 'ميعاد طعن', tone: 'red', field: 'appeal_deadline' },
  held: { label: 'جلسة انعقدت', tone: 'slate', field: null },
}

/**
 * Month calendar of everything the counselor has to do, with the chosen day's agenda beside it.
 * Dates can be moved right from the agenda; changes are saved and flow to Google Calendar on sync.
 */
export default function CalendarPage() {
  const { cases, sessions, updateCase } = useData()
  const cal = useCalendar()
  const { user } = useAuth()
  const toast = useToast()
  const { openCase, recordSession, newCase } = useUI()
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState(today())

  // Opening the calendar refreshes Google Calendar in the background when the connection is live.
  useEffect(() => {
    if (!cases.length) return
    cal.syncQuiet()
  }, [cases.length > 0, cal.enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  const events = useMemo(() => {
    const byDate = new Map()
    const push = (date, ev) => {
      if (!date) return
      if (!byDate.has(date)) byDate.set(date, [])
      byDate.get(date).push(ev)
    }
    const byId = new Map(cases.map((c) => [c.id, c]))
    for (const c of cases) {
      if (c.archived_at) continue
      push(c.next_session, { key: `s${c.id}`, type: c.status === 'محجوز للحكم' ? 'ruling' : 'session', c })
      push(c.followup_date, { key: `f${c.id}`, type: 'followup', c })
      push(c.appeal_deadline, { key: `a${c.id}`, type: 'deadline', c })
    }
    for (const s of sessions) {
      const c = byId.get(s.case_id)
      if (c && !c.archived_at) push(s.session_date, { key: `h${s.id}`, type: 'held', c, s })
    }
    return byDate
  }, [cases, sessions])

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const lead = (new Date(year, month, 1).getDay() + 1) % 7 // Saturday first
  const total = new Date(year, month + 1, 0).getDate()
  const cells = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => toISO(new Date(year, month, i + 1)))]

  const shift = (n) => setCursor(new Date(year, month + n, 1))
  const goToday = () => {
    setCursor(new Date())
    setSelected(today())
  }

  const dayEvents = (events.get(selected) || []).slice().sort((a, b) => Object.keys(TYPES).indexOf(a.type) - Object.keys(TYPES).indexOf(b.type))
  const t = today()

  const move = async (ev, value) => {
    const field = TYPES[ev.type].field
    if (!field || !value || value === ev.c[field]) return
    try {
      await updateCase(ev.c.id, { [field]: value })
      toast(`تم نقل الموعد إلى ${fmt(value)}`)
      setSelected(value)
      setCursor(parseISO(value))
    } catch (err) {
      toast(friendlyError(err), 'error')
    }
  }

  const done = async (ev) => {
    try {
      await updateCase(ev.c.id, { followup_date: null })
      toast('تمت المتابعة')
    } catch (err) {
      toast(friendlyError(err), 'error')
    }
  }

  const googleDayUrl = dayUrl(selected, user?.email)
  // Same event the sync writes to Google, for the one-off "add this to Google Calendar" link.
  const googleEventLink = (ev) => {
    const kind = { session: 's', ruling: 's', followup: 'f', deadline: 'a' }[ev.type]
    const want = kind && desiredEvents([ev.c], 360)
    const g = want && [...want.entries()].find(([id]) => id.startsWith(kind))?.[1]
    return g ? eventTemplateUrl({ ...g, start: { date: selected }, end: { date: selected } }) : null
  }

  // Sync, then take the counselor to that day in Google Calendar (tab opened first so popups aren't blocked).
  const openInGoogle = async () => {
    const tab = window.open('', '_blank')
    const ok = await cal.syncNow()
    if (ok) toast('تمت المزامنة، جارٍ فتح اليوم في تقويم جوجل')
    else toast('لم تكتمل المزامنة، سيُفتح التقويم بما هو موجود فيه', 'error')
    if (tab) tab.location.href = googleDayUrl
    else window.location.href = googleDayUrl
  }

  return (
    <div className="page">
      <PageHead
        title="التقويم"
        subtitle="الجلسات والمتابعات ومواعيد الطعن، اختر يوماً لترى تفاصيله وتعدّل مواعيده"
        actions={
          cal.available && (
            <button type="button" className="btn btn-soft" onClick={cal.syncNow} disabled={cal.status === 'syncing'}>
              <RefreshCw size={16} className={cal.status === 'syncing' ? 'spin' : ''} />
              {cal.enabled ? 'مزامنة مع تقويم جوجل' : 'ربط تقويم جوجل'}
            </button>
          )
        }
      />

      {cal.available && (
        <p className={`inline-note ${cal.status === 'error' ? 'is-error' : ''}`}>
          {cal.status === 'syncing' ? 'جارٍ المزامنة مع تقويم جوجل…'
            : cal.status === 'ok' ? `تمت المزامنة مع تقويم جوجل${cal.lastSync ? ` الساعة ${cal.lastSync.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}` : ''}.`
            : cal.status === 'error' ? `تعذرت المزامنة: ${cal.error}`
            : cal.enabled ? 'انتهت صلاحية الربط مع جوجل؛ اضغط «مزامنة» لتجديده وإرسال التنبيهات.'
            : 'اربط تقويم جوجل لتصلك جلساتك ومتابعاتك كتنبيهات على هاتفك.'}
        </p>
      )}

      <div className="cal-layout">
        <section className="card cal-card">
          <div className="cal-controls">
            <h2 className="cal-title">{MONTHS[month]} {year}</h2>
            <div className="cal-nav">
              <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="الشهر السابق"><ChevronRight size={18} /></button>
              <button type="button" className="btn btn-soft btn-sm" onClick={goToday}>اليوم</button>
              <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label="الشهر التالي"><ChevronLeft size={18} /></button>
            </div>
          </div>

          <div className="cal-weekdays">
            {WEEKDAYS.map((w, i) => <span key={w} className={i === 6 ? 'is-weekend' : ''}>{w}</span>)}
          </div>
          <div className="cal-cells">
            {cells.map((iso, i) => {
              if (!iso) return <span key={`b${i}`} className="cal-cell is-blank" />
              const list = events.get(iso) || []
              const upcoming = list.filter((e) => e.type !== 'held')
              const kinds = [...new Set(upcoming.map((e) => TYPES[e.type].tone))]
              return (
                <button
                  key={iso}
                  type="button"
                  className={`cal-cell ${iso === selected ? 'is-selected' : ''} ${iso === t ? 'is-today' : ''} ${parseISO(iso).getDay() === 5 ? 'is-weekend' : ''}`}
                  onClick={() => setSelected(iso)}
                  aria-label={`${fmtLong(iso)}${list.length ? `، ${list.length} موعد` : ''}`}
                  aria-pressed={iso === selected}
                >
                  <span className="cal-num">{Number(iso.slice(8))}</span>
                  {upcoming.length > 0 && (
                    <span className="cal-marks">
                      {kinds.slice(0, 3).map((k) => <i key={k} className={`dot tone-${k}`} />)}
                      <b>{upcoming.length}</b>
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="cal-legend">
            {['session', 'ruling', 'followup', 'deadline'].map((k) => (
              <span key={k}><i className={`dot tone-${TYPES[k].tone}`} /> {TYPES[k].label}</span>
            ))}
          </div>
        </section>

        <section className="card cal-agenda">
          <div className="card-head">
            <h2>{fmtLong(selected)}</h2>
            <span className="muted small">{dayEvents.length ? `${dayEvents.length} موعد` : 'لا مواعيد'}</span>
          </div>

          <div className="cal-agenda-body">
            {dayEvents.length === 0 ? (
              <Empty icon={CalendarCheck2} title="يوم خالٍ" text="لا توجد جلسات أو متابعات في هذا اليوم." />
            ) : (
              dayEvents.map((ev) => {
                const meta = TYPES[ev.type]
                const open = OPEN_STATUSES.has(ev.c.status || '')
                return (
                  <article key={ev.key} className={`cal-event tone-${meta.tone}`}>
                    <div className="cal-event-top">
                      <button type="button" className="cal-event-title" onClick={() => openCase(ev.c.id)}>
                        <strong>{caseTitle(ev.c)}</strong>
                        <span className="muted small">{ev.c.court}</span>
                      </button>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>
                    <p className="cal-event-sub">
                      {[ev.c.plaintiff, ev.c.defendant && `ضد ${ev.c.defendant}`].filter(Boolean).join(' ') || ev.c.case_type || '—'}
                    </p>
                    {ev.type === 'held' && <p className="cal-event-line">{ev.s.decision || 'بدون قرار مسجل'}{ev.s.next_date ? ` ← ${fmt(ev.s.next_date)}` : ''}</p>}
                    {ev.type === 'followup' && ev.c.notes && <p className="cal-event-line">{ev.c.notes}</p>}
                    {(ev.type === 'session' || ev.type === 'ruling') && ev.c.last_decision && <p className="cal-event-line">آخر قرار: {ev.c.last_decision}</p>}

                    <div className="cal-event-actions">
                      {meta.field && (
                        <label className="cal-move">
                          <span className="muted small">نقل إلى</span>
                          <DateInput value={ev.c[meta.field] || ''} required onChange={(e) => move(ev, e.target.value)} className="form-input cal-move-input" />
                        </label>
                      )}
                      {(ev.type === 'session' || ev.type === 'ruling') && open && selected <= t && (
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => recordSession(ev.c)}><Gavel size={14} /> قرار الجلسة</button>
                      )}
                      {ev.type === 'followup' && (
                        <button type="button" className="btn btn-soft btn-sm" onClick={() => done(ev)}><Check size={14} /> تمت</button>
                      )}
                      {googleEventLink(ev) && (
                        <a className="btn btn-ghost btn-sm" href={googleEventLink(ev)} target="_blank" rel="noreferrer noopener">
                          <CalendarPlus size={14} /> في جوجل
                        </a>
                      )}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openCase(ev.c.id)}>فتح الدعوى</button>
                    </div>
                  </article>
                )
              })
            )}
          </div>

          <div className="cal-agenda-foot">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => newCase({ next_session: selected })}>
              <Plus size={14} /> دعوى بجلسة في هذا اليوم
            </button>
            {cal.available && (
              <button type="button" className="btn btn-soft btn-sm" onClick={openInGoogle} disabled={cal.status === 'syncing'}>
                <ExternalLink size={14} /> {cal.enabled ? 'مزامنة وفتح اليوم في جوجل' : 'ربط جوجل وفتح اليوم'}
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
