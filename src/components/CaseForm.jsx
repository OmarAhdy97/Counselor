import { useEffect, useMemo, useState } from 'react'
import { Modal, Field, DataList } from './ui'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { friendlyError } from '../lib/errors'
import { caseKey } from '../lib/excel'
import {
  STATUSES, OUTCOMES, APPEAL_DECISIONS, CASE_TYPE_SUGGESTIONS, DECISION_SUGGESTIONS,
  suggestedAppealDeadline, suggestedAppealDays, caseTitle,
} from '../lib/constants'
import Select from './Select'
import DateInput from './DateInput'

const EMPTY = {
  court: '', case_number: '', case_year: new Date().getFullYear(), plaintiff: '', defendant: '',
  case_type: '', status: 'متداول', next_session: '', last_decision: '', ruling_text: '',
  ruling_date: '', ruling_outcome: '', appeal_deadline: '', notes: '', copy_numbers: '',
  memos: '', followup_date: '', circuit_id: '', ruling_number: '', appeal_decision: '', appeal_note: '',
}

export default function CaseForm({ open, caseItem, preset, onClose, onSaved }) {
  const { cases, lists, circuits, createCase, updateCase } = useData()
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (caseItem) {
      const f = { ...EMPTY }
      for (const k of Object.keys(EMPTY)) f[k] = caseItem[k] ?? ''
      setForm(f)
    } else {
      setForm({ ...EMPTY, ...(preset || {}) })
    }
  }, [open, caseItem]) // eslint-disable-line react-hooks/exhaustive-deps

  const unfiled = form.status === 'تحت الرفع'
  const courtCircuits = circuits.filter((c) => !form.court || c.court === form.court)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const duplicate = useMemo(() => {
    if (!form.court || !form.case_number || !form.case_year) return null
    const key = caseKey(form)
    return cases.find((c) => caseKey(c) === key && c.id !== caseItem?.id) || null
  }, [form.court, form.case_number, form.case_year, cases, caseItem])

  const submit = async (e) => {
    e.preventDefault()
    if (duplicate) return
    setSaving(true)
    try {
      const saved = caseItem ? await updateCase(caseItem.id, form) : await createCase(form)
      toast(caseItem ? 'تم حفظ التعديلات' : `تم قيد الدعوى ${caseTitle(saved)}`)
      onSaved?.(saved)
      onClose()
    } catch (err) {
      toast(friendlyError(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  const suggestDeadline = () => {
    const d = suggestedAppealDeadline(form, form.ruling_date)
    if (d) setForm((f) => ({ ...f, appeal_deadline: d }))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={caseItem ? `تعديل الدعوى ${caseTitle(caseItem)}` : 'قيد دعوى جديدة'}
      subtitle={caseItem ? caseItem.court : 'الحقول المعلَّمة بـ * مطلوبة فقط، والباقي يمكن إكماله لاحقاً'}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>إلغاء</button>
          <button type="submit" form="case-form" className="btn btn-primary" disabled={saving || !!duplicate}>
            {saving ? 'جارٍ الحفظ…' : 'حفظ'}
          </button>
        </>
      }
    >
      <form id="case-form" onSubmit={submit}>
        <DataList id="dl-courts" items={lists.courts} />
        <DataList id="dl-types" items={[...new Set([...lists.caseTypes, ...CASE_TYPE_SUGGESTIONS])]} />
        <DataList id="dl-parties" items={lists.parties} />
        <DataList id="dl-decisions" items={DECISION_SUGGESTIONS} />
        <DataList id="dl-status" items={[...new Set([...STATUSES, ...lists.statuses])]} />

        <section className="form-section">
          <h3>بيانات الدعوى</h3>
          <div className="grid-3">
            <Field label="المحكمة *">
              {(id) => <input id={id} list="dl-courts" value={form.court} onChange={set('court')} required autoFocus={!caseItem} />}
            </Field>
            <Field label={unfiled ? 'رقم الدعوى (بعد القيد)' : 'رقم الدعوى *'}>
              {(id) => <input id={id} inputMode="numeric" value={form.case_number} onChange={set('case_number')} required={!unfiled} />}
            </Field>
            <Field label={unfiled ? 'السنة' : 'السنة *'}>
              {(id) => <input id={id} type="number" min="1950" max="2100" value={form.case_year} onChange={set('case_year')} required={!unfiled} />}
            </Field>
          </div>
          {duplicate && (
            <p className="inline-alert">هذه الدعوى مقيدة بالفعل ({duplicate.court} — {caseTitle(duplicate)}).</p>
          )}
          <div className="grid-2">
            <Field label="المدعي">
              {(id) => <input id={id} list="dl-parties" value={form.plaintiff} onChange={set('plaintiff')} />}
            </Field>
            <Field label="المدعى عليه">
              {(id) => <input id={id} list="dl-parties" value={form.defendant} onChange={set('defendant')} />}
            </Field>
            <Field label="نوع الدعوى">
              {(id) => <input id={id} list="dl-types" value={form.case_type} onChange={set('case_type')} />}
            </Field>
            <Field label="حالة الدعوى">
              {(id) => <input id={id} list="dl-status" value={form.status} onChange={set('status')} />}
            </Field>
            <Field label="الدائرة" hint={circuits.length ? null : 'أضف دوائرك من صفحة «الدوائر» لتظهر هنا'}>
              {(id) => (
                <Select id={id} value={form.circuit_id || ''} onChange={set('circuit_id')}>
                  <option value="">—</option>
                  {courtCircuits.map((c) => <option key={c.id} value={c.id}>{c.name}{c.court !== form.court ? ` (${c.court})` : ''}</option>)}
                </Select>
              )}
            </Field>
          </div>
        </section>

        <section className="form-section">
          <h3>الجلسة</h3>
          <div className="grid-2">
            <Field label="تاريخ الجلسة القادمة">
              {(id) => <DateInput id={id} value={form.next_session} onChange={set('next_session')} />}
            </Field>
            <Field label="قرار آخر جلسة" hint="لتسجيل جلسة جديدة استخدم زر «تسجيل قرار الجلسة» ليُحفظ في السجل">
              {(id) => <input id={id} list="dl-decisions" value={form.last_decision} onChange={set('last_decision')} />}
            </Field>
          </div>
        </section>

        <section className="form-section">
          <h3>الحكم</h3>
          <div className="grid-3">
            <Field label="تاريخ الحكم">
              {(id) => <DateInput id={id} value={form.ruling_date} onChange={set('ruling_date')} />}
            </Field>
            <Field label="النتيجة">
              {(id) => (
                <Select id={id} value={form.ruling_outcome} onChange={set('ruling_outcome')}>
                  <option value="">—</option>
                  {OUTCOMES.map((o) => <option key={o}>{o}</option>)}
                  {form.ruling_outcome && !OUTCOMES.includes(form.ruling_outcome) && <option>{form.ruling_outcome}</option>}
                </Select>
              )}
            </Field>
            <Field
              label="آخر ميعاد للطعن"
              hint={form.ruling_date ? (
                <button type="button" className="link" onClick={suggestDeadline}>
                  احسب تقديرياً ({suggestedAppealDays(form)} يوماً من تاريخ الحكم)
                </button>
              ) : 'أدخل تاريخ الحكم أولاً لحسابه'}
            >
              {(id) => <DateInput id={id} value={form.appeal_deadline} onChange={set('appeal_deadline')} />}
            </Field>
          </div>
          <div className="grid-3">
            <Field label="رقم قيد الحكم">
              {(id) => <input id={id} value={form.ruling_number} onChange={set('ruling_number')} />}
            </Field>
            <Field label="قرار الطعن">
              {(id) => (
                <Select id={id} value={form.appeal_decision || ''} onChange={set('appeal_decision')}>
                  <option value="">لم يُحدَّد</option>
                  {APPEAL_DECISIONS.map((o) => <option key={o}>{o}</option>)}
                </Select>
              )}
            </Field>
            <Field label="ملاحظة الطعن">
              {(id) => <input id={id} value={form.appeal_note} onChange={set('appeal_note')} placeholder="رقم الاستئناف، سبب عدم الطعن…" />}
            </Field>
          </div>
          <Field label="منطوق الحكم" full>
            {(id) => <textarea id={id} rows={3} value={form.ruling_text} onChange={set('ruling_text')} />}
          </Field>
        </section>

        <section className="form-section">
          <h3>المتابعة والمذكرات</h3>
          <div className="grid-3">
            <Field label="تاريخ المتابعة">
              {(id) => <DateInput id={id} value={form.followup_date} onChange={set('followup_date')} />}
            </Field>
            <Field label="المذكرات">
              {(id) => <input id={id} value={form.memos} onChange={set('memos')} placeholder="مذكرة دفاع شهر 7" />}
            </Field>
            <Field label="رقم النسخ">
              {(id) => <input id={id} value={form.copy_numbers} onChange={set('copy_numbers')} />}
            </Field>
          </div>
          <Field label="ملاحظات هامة / المطلوب في المتابعة" full>
            {(id) => <textarea id={id} rows={3} value={form.notes} onChange={set('notes')} />}
          </Field>
        </section>
      </form>
    </Modal>
  )
}
