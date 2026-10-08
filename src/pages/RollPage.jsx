import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, ChevronLeft, Printer, CalendarDays } from 'lucide-react'
import { useData } from '../context/DataContext'
import CaseTable from '../components/CaseTable'
import RollSheet from '../components/RollSheet'
import { usePrint } from '../components/print'
import { useAuth } from '../context/AuthContext'
import BulkBar from '../components/BulkActions'
import { Empty, PageHead, Segmented } from '../components/ui'
import { addDays, fmt, fmtLong, today, weekStart } from '../lib/dates'
import Select from '../components/Select'
import DateInput from '../components/DateInput'

/**
 * The roll for a day or a week. Upcoming days list the cases whose next hearing falls there;
 * past days come from the session history, so they double as the sessions archive
 * ("what was on the roll on 8/9 and what happened").
 */
export default function RollPage() {
  const { cases, sessions, circuits, circuitsById } = useData()
  const { displayName } = useAuth()
  const [print, PrintArea] = usePrint()
  const [mode, setMode] = useState('day')
  const [date, setDate] = useState(today())
  const [circuitFilter, setCircuitFilter] = useState('')
  const [selected, setSelected] = useState(() => new Set())

  const from = mode === 'day' ? date : weekStart(date)
  const to = mode === 'day' ? date : addDays(from, 6)
  useEffect(() => setSelected(new Set()), [from, to, circuitFilter])

  const groups = useMemo(() => {
    const byId = new Map(cases.map((c) => [c.id, c]))
    const entries = new Map() // `${date}|${caseId}` -> { date, c, held }
    for (const s of sessions) {
      if (s.session_date < from || s.session_date > to) continue
      const c = byId.get(s.case_id)
      if (c) entries.set(`${s.session_date}|${c.id}`, { date: s.session_date, c, held: s })
    }
    for (const c of cases) {
      if (c.archived_at || !c.next_session || c.next_session < from || c.next_session > to) continue
      const k = `${c.next_session}|${c.id}`
      if (!entries.has(k)) entries.set(k, { date: c.next_session, c, held: null })
    }

    const passes = (c) =>
      !circuitFilter ||
      (circuitFilter === 'none' ? !c.circuit_id : circuitFilter.startsWith('court:') ? c.court === circuitFilter.slice(6) : c.circuit_id === circuitFilter)

    const byDate = new Map()
    for (const e of entries.values()) {
      if (!passes(e.c)) continue
      const label = e.c.circuit_id ? `${e.c.court} — ${circuitsById.get(e.c.circuit_id)?.name || ''}` : e.c.court
      if (!byDate.has(e.date)) byDate.set(e.date, new Map())
      const g = byDate.get(e.date)
      if (!g.has(label)) g.set(label, [])
      g.get(label).push(e)
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([d, groupsMap]) => ({
        date: d,
        groups: [...groupsMap.entries()]
          .sort(([a], [b]) => a.localeCompare(b, 'ar'))
          .map(([label, list]) => ({
            label,
            list: list.sort((a, b) => (a.c.case_year || 0) - (b.c.case_year || 0) || Number(a.c.case_number) - Number(b.c.case_number)),
          })),
        total: [...groupsMap.values()].reduce((n, l) => n + l.length, 0),
      }))
  }, [cases, sessions, from, to, circuitFilter, circuitsById])

  const total = groups.reduce((n, g) => n + g.total, 0)
  const step = mode === 'day' ? 1 : 7
  const t = today()
  const courts = useMemo(() => [...new Set(cases.map((c) => c.court))].sort((a, b) => a.localeCompare(b, 'ar')), [cases])
  const selectedRows = useMemo(() => cases.filter((c) => selected.has(c.id)), [cases, selected])
  const onSelect = (ids, on) =>
    setSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)))
      return next
    })

  return (
    <div className="page">
      <PageHead
        title="رول الجلسات"
        subtitle={mode === 'day' ? fmtLong(date) : `من ${fmt(from)} إلى ${fmt(to)}`}
        actions={
          <button type="button" className="btn btn-soft" onClick={print} disabled={!total}>
            <Printer size={16} /> طباعة الرول
          </button>
        }
      />

      <div className="toolbar no-print">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[{ value: 'day', label: 'يوم' }, { value: 'week', label: 'أسبوع' }]}
        />
        <div className="date-nav date-nav-row">
          <button type="button" className="icon-btn" onClick={() => setDate(addDays(date, -step))} aria-label="السابق">
            <ChevronRight size={18} />
          </button>
          <DateInput value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="التاريخ" />
          <button type="button" className="icon-btn" onClick={() => setDate(addDays(date, step))} aria-label="التالي">
            <ChevronLeft size={18} />
          </button>
        </div>
        {date !== t && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDate(t)}>اليوم</button>
        )}
        <Select className="form-select roll-filter" value={circuitFilter} onChange={(e) => setCircuitFilter(e.target.value)} aria-label="المحكمة أو الدائرة">
          <option value="">كل المحاكم والدوائر</option>
          {circuits.length > 0 && (
            <optgroup label="الدوائر">
              {circuits.map((c) => <option key={c.id} value={c.id}>{c.court} — {c.name}</option>)}
            </optgroup>
          )}
          <optgroup label="المحاكم">
            {courts.map((c) => <option key={c} value={`court:${c}`}>{c}</option>)}
          </optgroup>
        </Select>
        <span className="muted small push">{total} دعوى</span>
      </div>

      {to < t && <p className="muted small no-print">هذه أيام مضت: يُعرض ما كان على الرول وما تقرر في كل دعوى (أرشيف الجلسات).</p>}

      <PrintArea>
        <RollSheet
          days={groups}
          total={total}
          author={displayName}
          title="رول الجلسات"
          subtitle={mode === 'day' ? fmtLong(date) : `من ${fmtLong(from)} إلى ${fmtLong(to)}`}
        />
      </PrintArea>

      {total === 0 ? (
        <div className="card">
          <Empty icon={CalendarDays} title="لا توجد جلسات في هذه الفترة" text="جرّب يوماً آخر أو اعرض الأسبوع كاملاً." />
        </div>
      ) : (
        groups.map((g) => {
          const past = g.date < t
          const heldMap = new Map(g.groups.flatMap(({ list }) => list.map((e) => [e.c.id, e.held])))
          return (
            <div key={g.date} className="roll-day">
              {mode === 'week' && <h2 className="roll-date">{fmtLong(g.date)} <span className="count">{g.total}</span></h2>}
              {g.groups.map(({ label, list }) => (
                <section key={label} className="card roll-court">
                  <div className="card-head">
                    <h3>{label} <span className="count">{list.length}</span></h3>
                  </div>
                  <CaseTable
                    rows={list.map((e) => e.c)}
                    columns={past ? ['parties', 'type', 'held'] : ['parties', 'type', 'decision', 'notes']}
                    sessionOf={(c) => heldMap.get(c.id)}
                    numbered
                    selected={selected}
                    onSelect={onSelect}
                  />
                </section>
              ))}
            </div>
          )
        })
      )}

      <BulkBar rows={selectedRows} onClear={() => setSelected(new Set())} />
    </div>
  )
}
