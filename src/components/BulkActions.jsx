import { useEffect, useMemo, useState } from 'react'
import { Archive, CalendarClock, Landmark, X } from 'lucide-react'
import { Modal, Field, Segmented, DataList } from './ui'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { friendlyError } from '../lib/errors'
import { DECISION_SUGGESTIONS, STRUCK_OFF_FOLLOWUP_DAYS, caseTitle } from '../lib/constants'
import { addDays, fmt, fmtLong, suggestDates, today } from '../lib/dates'

const KINDS = [
  { value: 'adjourn', label: 'تأجيل' },
  { value: 'reserve', label: 'حجز للحكم' },
  { value: 'report', label: 'حجز للتقرير' },
  { value: 'struck', label: 'شطب' },
]

/** One decision for many cases: the counselor's "ترحيل مجمّع". */
function BulkSessionModal({ open, rows, onClose, onDone }) {
  const { recordBulk, circuitsById } = useData()
  const toast = useToast()
  const [kind, setKind] = useState('adjourn')
  const [f, setF] = useState({ session_date: today(), decision: '', next_date: '' })
  const [busy, setBusy] = useState(false)

  // Default hearing date: the one they all share, if they share one.
  useEffect(() => {
    if (!open) return
    const dates = [...new Set(rows.map((c) => c.next_session).filter(Boolean))]
    const shared = dates.length === 1 && dates[0] <= today() ? dates[0] : today()
    setKind('adjourn')
    setF({ session_date: shared, decision: '', next_date: '' })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const weekdays = [...new Set(rows.map((c) => circuitsById.get(c.circuit_id)?.weekday ?? null))]
  const weekday = weekdays.length === 1 ? weekdays[0] : null
  const chips = suggestDates(f.session_date, weekday)
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    const d = f.decision.trim()
    const map = {
      adjourn: { decision: d, status: 'متداول', last: d },
      reserve: { decision: d || 'حجز للحكم', status: 'محجوز للحكم', last: d || 'محجوز للحكم' },
      report: { decision: d || 'حجز للتقرير', status: 'محجوز للتقرير', last: d || 'محجوز للتقرير' },
      struck: { decision: 'شطب', status: 'شطب', last: 'شطب' },
    }[kind]
    const next = kind === 'struck' ? null : f.next_date || null
    const items = rows.map((c) => ({
      caseId: c.id,
      session: { session_date: f.session_date, decision: map.decision, next_date: next },
      fields: {
        next_session: next,
        last_decision: map.last,
        status: map.status,
        ...(kind === 'struck' ? { followup_date: addDays(f.session_date, STRUCK_OFF_FOLLOWUP_DAYS) } : {}),
      },
    }))
    setBusy(true)
    try {
      const n = await recordBulk(items)
      toast(next ? `تم ترحيل ${n} دعوى إلى ${fmt(next)}` : `تم تسجيل القرار لـ ${n} دعوى`)
      onDone()
      onClose()
    } catch (err) {
      toast(friendlyError(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`ترحيل مجمّع — ${rows.length} دعوى`}
      subtitle="نفس القرار ونفس الجلسة القادمة لكل القضايا المحددة، ويُسجَّل لكل منها في سجل جلساتها"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>إلغاء</button>
          <button type="submit" form="bulk-form" className="btn btn-primary" disabled={busy}>
            {busy ? 'جارٍ التسجيل…' : `تسجيل لـ ${rows.length} دعوى`}
          </button>
        </>
      }
    >
      <form id="bulk-form" className="stack" onSubmit={submit}>
        <DataList id="dl-bulk-dec" items={DECISION_SUGGESTIONS} />
        <Field label="تاريخ الجلسة التي انعقدت">
          {(id) => <input id={id} type="date" value={f.session_date} onChange={set('session_date')} required max={today()} />}
        </Field>
        <Segmented value={kind} onChange={setKind} options={KINDS} />
        {kind !== 'struck' && (
          <div className="grid-2">
            <Field label={kind === 'adjourn' ? 'سبب التأجيل' : 'تفاصيل (اختياري)'}>
              {(id) => <input id={id} list="dl-bulk-dec" value={f.decision} onChange={set('decision')} required={kind === 'adjourn'} placeholder="ترحيل إداري، سداد أمانة الخبير…" />}
            </Field>
            <Field label={kind === 'reserve' ? 'جلسة النطق بالحكم' : 'الجلسة القادمة'} hint={f.next_date ? fmtLong(f.next_date) : null}>
              {(id) => (
                <>
                  <input id={id} type="date" value={f.next_date} onChange={set('next_date')} required={kind !== 'report'} min={f.session_date} />
                  <div className="chips">
                    {chips.map((d, i) => (
                      <button key={d} type="button" className={`chip ${f.next_date === d ? 'active' : ''}`} onClick={() => setF((p) => ({ ...p, next_date: d }))}>
                        {weekday !== null ? fmt(d) : `+${i + 1} أسبوع`}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </Field>
          </div>
        )}
        <details className="more">
          <summary>القضايا المحددة ({rows.length})</summary>
          <ul className="small">
            {rows.map((c) => <li key={c.id}>{caseTitle(c)} — {c.court}</li>)}
          </ul>
        </details>
      </form>
    </Modal>
  )
}

function AssignCircuitModal({ open, rows, onClose, onDone }) {
  const { circuits, updateCase } = useData()
  const toast = useToast()
  const [circuitId, setCircuitId] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      for (let i = 0; i < rows.length; i += 5) {
        await Promise.all(rows.slice(i, i + 5).map((c) => updateCase(c.id, { circuit_id: circuitId || null })))
      }
      toast(`تم ربط ${rows.length} دعوى بالدائرة`)
      onDone()
      onClose()
    } catch (err) {
      toast(friendlyError(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`ربط ${rows.length} دعوى بدائرة`}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>إلغاء</button>
          <button type="submit" form="assign-form" className="btn btn-primary" disabled={busy}>حفظ</button>
        </>
      }
    >
      <form id="assign-form" onSubmit={submit}>
        {circuits.length === 0 ? (
          <p className="inline-note">لا توجد دوائر بعد. أضفها من صفحة «الدوائر» أولاً.</p>
        ) : (
          <Field label="الدائرة">
            {(id) => (
              <select id={id} value={circuitId} onChange={(e) => setCircuitId(e.target.value)} required>
                <option value="">اختر…</option>
                {circuits.map((c) => <option key={c.id} value={c.id}>{c.court} — {c.name}</option>)}
              </select>
            )}
          </Field>
        )}
      </form>
    </Modal>
  )
}

/** Sticky bar shown while cases are selected. */
export default function BulkBar({ rows, onClear }) {
  const { archiveCase } = useData()
  const toast = useToast()
  const [modal, setModal] = useState(null)
  const count = rows.length
  const anyArchived = useMemo(() => rows.some((c) => c.archived_at), [rows])
  if (!count && !modal) return null

  const archive = async () => {
    if (!window.confirm(`نقل ${count} دعوى إلى الأرشيف؟ يمكن إلغاء الحفظ لاحقاً.`)) return
    try {
      for (const c of rows) await archiveCase(c.id)
      toast(`تم حفظ ${count} دعوى في الأرشيف`)
      onClear()
    } catch (err) {
      toast(friendlyError(err), 'error')
    }
  }

  return (
    <>
      {count > 0 && (
        <div className="bulk-bar no-print" role="toolbar" aria-label="إجراءات جماعية">
          <strong>{count} محددة</strong>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal('session')}>
            <CalendarClock size={15} /> ترحيل مجمّع
          </button>
          <button type="button" className="btn btn-soft btn-sm" onClick={() => setModal('circuit')}>
            <Landmark size={15} /> ربط بدائرة
          </button>
          {!anyArchived && (
            <button type="button" className="btn btn-soft btn-sm" onClick={archive}>
              <Archive size={15} /> أرشفة
            </button>
          )}
          <button type="button" className="icon-btn" onClick={onClear} aria-label="إلغاء التحديد"><X size={16} /></button>
        </div>
      )}
      <BulkSessionModal open={modal === 'session'} rows={rows} onClose={() => setModal(null)} onDone={onClear} />
      <AssignCircuitModal open={modal === 'circuit'} rows={rows} onClose={() => setModal(null)} onDone={onClear} />
    </>
  )
}
