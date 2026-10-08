import { useEffect, useState } from 'react'
import { Modal, Field, Segmented, DataList } from './ui'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { friendlyError } from '../lib/errors'
import {
  OUTCOMES, DECISION_SUGGESTIONS, STRUCK_OFF_FOLLOWUP_DAYS,
  suggestedAppealDeadline, suggestedAppealDays, caseTitle,
} from '../lib/constants'
import { addDays, fmt, fmtLong, today, suggestDates, dayName } from '../lib/dates'

const KINDS = [
  { value: 'adjourn', label: 'تأجيل' },
  { value: 'reserve', label: 'حجز للحكم' },
  { value: 'report', label: 'حجز للتقرير' },
  { value: 'ruling', label: 'حكم' },
  { value: 'struck', label: 'شطب' },
  { value: 'other', label: 'قرار آخر' },
]

/**
 * "تسجيل قرار الجلسة": the daily action. Logs the hearing in the history and moves the case
 * to its next state (new date, reserved for judgment, judged, or struck off) in one step.
 */
export default function SessionModal({ open, caseItem, onClose }) {
  const { recordSession, circuitsById } = useData()
  const toast = useToast()
  const [kind, setKind] = useState('adjourn')
  const [f, setF] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !caseItem) return
    setKind(caseItem.status === 'محجوز للحكم' ? 'ruling' : 'adjourn')
    setF({
      session_date: caseItem.next_session && caseItem.next_session <= today() ? caseItem.next_session : today(),
      decision: '',
      next_date: '',
      outcome: '',
      ruling_number: '',
      ruling_text: '',
      appeal_deadline: '',
      followup_date: caseItem.followup_date || '',
      notes: caseItem.notes || '',
      status: caseItem.status || '',
    })
  }, [open, caseItem])

  // Sensible defaults when switching the kind of decision.
  useEffect(() => {
    if (!open || !caseItem || !f.session_date) return
    if (kind === 'struck') {
      setF((p) => ({
        ...p,
        followup_date: addDays(p.session_date, STRUCK_OFF_FOLLOWUP_DAYS),
        notes: p.notes || 'متابعة لعمل شهادة بعدم التجديد من الشطب وإخطار الجهة',
      }))
    }
    if (kind === 'ruling') {
      setF((p) => ({ ...p, appeal_deadline: suggestedAppealDeadline(caseItem, p.session_date) }))
    }
  }, [kind, f.session_date]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!caseItem) return null
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))
  const circuit = circuitsById.get(caseItem.circuit_id)
  const chips = f.session_date ? suggestDates(f.session_date, circuit?.weekday) : []
  // A plain function (not a component) so the date input keeps focus between renders.
  const nextDate = (label, required = false) => (
    <Field label={label} hint={f.next_date ? fmtLong(f.next_date) : circuit?.weekday != null ? `الدائرة تنعقد يوم ${dayName(chips[0])}` : null}>
      {(id) => (
        <>
          <input id={id} type="date" value={f.next_date} onChange={set('next_date')} required={required} min={f.session_date} />
          <div className="chips">
            {chips.map((d, i) => (
              <button key={d} type="button" className={`chip ${f.next_date === d ? 'active' : ''}`} onClick={() => setF((p) => ({ ...p, next_date: d }))}>
                {circuit?.weekday != null ? `${fmt(d)}` : `+${i + 1} أسبوع`}
              </button>
            ))}
          </div>
        </>
      )}
    </Field>
  )

  const submit = async (e) => {
    e.preventDefault()
    const base = { notes: f.notes, followup_date: f.followup_date }
    let session
    let fields
    switch (kind) {
      case 'adjourn':
        session = { session_date: f.session_date, decision: f.decision, next_date: f.next_date }
        fields = { ...base, next_session: f.next_date, last_decision: f.decision, status: 'متداول' }
        break
      case 'reserve':
        session = { session_date: f.session_date, decision: f.decision || 'حجز للحكم', next_date: f.next_date }
        fields = { ...base, next_session: f.next_date, last_decision: f.decision || 'محجوز للحكم', status: 'محجوز للحكم' }
        break
      case 'report':
        session = { session_date: f.session_date, decision: f.decision || 'حجز للتقرير', next_date: f.next_date }
        fields = { ...base, next_session: f.next_date, last_decision: f.decision || 'محجوز للتقرير', status: 'محجوز للتقرير' }
        break
      case 'ruling':
        session = { session_date: f.session_date, decision: `صدر الحكم${f.outcome ? ` (${f.outcome})` : ''}`, next_date: null }
        fields = {
          ...base,
          next_session: null,
          last_decision: 'صدر الحكم',
          status: 'محكوم فيه',
          ruling_date: f.session_date,
          ruling_outcome: f.outcome,
          ruling_number: f.ruling_number,
          ruling_text: f.ruling_text,
          appeal_deadline: f.appeal_deadline,
        }
        break
      case 'struck':
        session = { session_date: f.session_date, decision: 'شطب', next_date: null }
        fields = { ...base, next_session: null, last_decision: 'شطب', status: 'شطب' }
        break
      default:
        session = { session_date: f.session_date, decision: f.decision, next_date: f.next_date }
        fields = { ...base, next_session: f.next_date, last_decision: f.decision, status: f.status }
    }

    setSaving(true)
    try {
      await recordSession(caseItem.id, session, fields)
      toast(f.next_date && kind !== 'ruling' ? `تم التسجيل — الجلسة القادمة ${fmt(f.next_date)}` : 'تم تسجيل قرار الجلسة')
      onClose()
    } catch (err) {
      toast(friendlyError(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="تسجيل قرار الجلسة"
      subtitle={`${caseItem.court} — ${caseTitle(caseItem)}${caseItem.plaintiff ? ` — ${caseItem.plaintiff}` : ''}`}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>إلغاء</button>
          <button type="submit" form="session-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'جارٍ الحفظ…' : 'تسجيل'}
          </button>
        </>
      }
    >
      <form id="session-form" onSubmit={submit} className="stack">
        <DataList id="dl-dec" items={DECISION_SUGGESTIONS} />
        <Field label="تاريخ الجلسة التي انعقدت">
          {(id) => <input id={id} type="date" value={f.session_date || ''} onChange={set('session_date')} required max={today()} />}
        </Field>

        <Segmented value={kind} onChange={setKind} options={KINDS} />

        {kind === 'adjourn' && (
          <div className="grid-2">
            <Field label="سبب التأجيل">
              {(id) => <input id={id} list="dl-dec" value={f.decision} onChange={set('decision')} required autoFocus placeholder="للإعلان، للمستندات…" />}
            </Field>
            {nextDate('الجلسة القادمة', true)}
          </div>
        )}

        {kind === 'reserve' && (
          <div className="grid-2">
            {nextDate('جلسة النطق بالحكم', true)}
            <Field label="تفاصيل (اختياري)">
              {(id) => <input id={id} value={f.decision} onChange={set('decision')} placeholder="مع التصريح بمذكرات في أسبوعين" />}
            </Field>
          </div>
        )}

        {kind === 'report' && (
          <div className="grid-2">
            {nextDate('جلسة نظر التقرير (إن حُدِّدت)')}
            <Field label="تفاصيل (اختياري)">
              {(id) => <input id={id} value={f.decision} onChange={set('decision')} placeholder="ندب خبير، سداد الأمانة…" />}
            </Field>
          </div>
        )}

        {kind === 'ruling' && (
          <>
            <div className="grid-3">
              <Field label="رقم قيد الحكم">
                {(id) => <input id={id} value={f.ruling_number} onChange={set('ruling_number')} />}
              </Field>
              <Field label="الحكم صالح أو ضد">
                {(id) => (
                  <select id={id} value={f.outcome} onChange={set('outcome')} required>
                    <option value="">اختر…</option>
                    {OUTCOMES.map((o) => <option key={o}>{o}</option>)}
                  </select>
                )}
              </Field>
              <Field label="آخر ميعاد للطعن" hint={`تقديري: ${suggestedAppealDays(caseItem)} يوماً من تاريخ الحكم — راجعه`}>
                {(id) => <input id={id} type="date" value={f.appeal_deadline || ''} onChange={set('appeal_deadline')} />}
              </Field>
            </div>
            <Field label="منطوق الحكم">
              {(id) => <textarea id={id} rows={4} value={f.ruling_text} onChange={set('ruling_text')} placeholder="حكمت المحكمة…" />}
            </Field>
          </>
        )}

        {kind === 'struck' && (
          <p className="inline-note">
            ستُغلق الجلسات وتُضاف متابعة بعد {STRUCK_OFF_FOLLOWUP_DAYS} يوماً (قبل انقضاء ميعاد الستين يوماً للتجديد). يمكنك تعديلها بالأسفل.
          </p>
        )}

        {kind === 'other' && (
          <div className="grid-3">
            <Field label="القرار">
              {(id) => <input id={id} list="dl-dec" value={f.decision} onChange={set('decision')} required autoFocus placeholder="وقف تعليقي، إحالة…" />}
            </Field>
            {nextDate('الجلسة القادمة (إن وجدت)')}
            <Field label="حالة الدعوى">
              {(id) => <input id={id} value={f.status} onChange={set('status')} />}
            </Field>
          </div>
        )}

        <details className="more" open={kind === 'struck' || kind === 'ruling'}>
          <summary>المتابعة والملاحظات</summary>
          <div className="grid-2">
            <Field label="تاريخ المتابعة">
              {(id) => <input id={id} type="date" value={f.followup_date || ''} onChange={set('followup_date')} />}
            </Field>
            <Field label="ملاحظات هامة">
              {(id) => <textarea id={id} rows={2} value={f.notes || ''} onChange={set('notes')} />}
            </Field>
          </div>
        </details>
      </form>
    </Modal>
  )
}
