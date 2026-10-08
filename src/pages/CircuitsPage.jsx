import { useMemo, useState } from 'react'
import { Landmark, Pencil, Plus, Trash2 } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { friendlyError } from '../lib/errors'
import { Empty, Field, Modal, PageHead, DataList } from '../components/ui'
import { WEEKDAYS } from '../lib/constants'
import Select from '../components/Select'

const EMPTY = { court: '', name: '', weekday: '', period: 'صباحي', appeal_weekday: '', notes: '' }

function CircuitForm({ open, circuit, onClose }) {
  const { lists, saveCircuit } = useData()
  const toast = useToast()
  const [f, setF] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setF(circuit ? { ...EMPTY, ...circuit, weekday: circuit.weekday ?? '', appeal_weekday: circuit.appeal_weekday ?? '', notes: circuit.notes || '' } : EMPTY)
  }
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await saveCircuit(f)
      toast('تم حفظ الدائرة')
      onClose()
    } catch (err) {
      toast(/duplicate|unique/i.test(err.message) ? 'هذه الدائرة مسجلة بالفعل في نفس المحكمة.' : friendlyError(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={circuit ? 'تعديل الدائرة' : 'إضافة دائرة'}
      subtitle="يوم الانعقاد يُستخدم لاقتراح مواعيد التأجيل تلقائياً"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>إلغاء</button>
          <button type="submit" form="circuit-form" className="btn btn-primary" disabled={busy}>حفظ</button>
        </>
      }
    >
      <form id="circuit-form" className="stack" onSubmit={submit}>
        <DataList id="dl-cir-courts" items={lists.courts} />
        <div className="grid-2">
          <Field label="المحكمة *">
            {(id) => <input id={id} list="dl-cir-courts" value={f.court} onChange={set('court')} required autoFocus />}
          </Field>
          <Field label="اسم / رقم الدائرة *">
            {(id) => <input id={id} value={f.name} onChange={set('name')} required placeholder="الدائرة 3 مدني" />}
          </Field>
          <Field label="يوم الانعقاد">
            {(id) => (
              <Select id={id} value={f.weekday} onChange={set('weekday')}>
                <option value="">غير ثابت</option>
                {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </Select>
            )}
          </Field>
          <Field label="الفترة">
            {(id) => (
              <Select id={id} value={f.period || ''} onChange={set('period')}>
                <option value="صباحي">صباحي</option>
                <option value="مسائي">مسائي</option>
              </Select>
            )}
          </Field>
          <Field label="يوم جلسات الاستئناف (إن وجد)">
            {(id) => (
              <Select id={id} value={f.appeal_weekday} onChange={set('appeal_weekday')}>
                <option value="">—</option>
                {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </Select>
            )}
          </Field>
          <Field label="ملاحظات">
            {(id) => <input id={id} value={f.notes} onChange={set('notes')} placeholder="رقم القاعة، اسم رئيس الدائرة…" />}
          </Field>
        </div>
      </form>
    </Modal>
  )
}

export default function CircuitsPage() {
  const { circuits, cases, deleteCircuit } = useData()
  const toast = useToast()
  const [editing, setEditing] = useState(null) // null | 'new' | circuit

  const counts = useMemo(() => {
    const m = new Map()
    for (const c of cases) if (c.circuit_id && !c.archived_at) m.set(c.circuit_id, (m.get(c.circuit_id) || 0) + 1)
    return m
  }, [cases])

  const grouped = useMemo(() => {
    const m = new Map()
    for (const c of [...circuits].sort((a, b) => a.name.localeCompare(b.name, 'ar'))) {
      if (!m.has(c.court)) m.set(c.court, [])
      m.get(c.court).push(c)
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b, 'ar'))
  }, [circuits])

  const remove = async (c) => {
    if (!window.confirm(`حذف «${c.name}»؟ القضايا المرتبطة بها لن تُحذف، فقط ستصبح بلا دائرة.`)) return
    try {
      await deleteCircuit(c.id)
    } catch (err) {
      toast(friendlyError(err), 'error')
    }
  }

  return (
    <div className="page">
      <PageHead
        title="الدوائر"
        subtitle="سجّل دوائرك وأيام انعقادها؛ عند التأجيل يقترح البرنامج الجلسة القادمة في يوم الدائرة."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            <Plus size={16} /> إضافة دائرة
          </button>
        }
      />

      {circuits.length === 0 ? (
        <div className="card">
          <Empty
            icon={Landmark}
            title="لا توجد دوائر بعد"
            text="أضف الدوائر التي تحضر أمامها، ثم اربط كل قضية بدائرتها من شاشة تعديل القضية أو بالتحديد الجماعي."
          />
        </div>
      ) : (
        grouped.map(([court, list]) => (
          <section key={court} className="card">
            <div className="card-head"><h2>{court} <span className="count">{list.length}</span></h2></div>
            <div className="table-wrap">
              <table className="cases plain">
                <thead>
                  <tr><th>الدائرة</th><th>يوم الانعقاد</th><th>الفترة</th><th>الاستئناف</th><th>القضايا</th><th>ملاحظات</th><th aria-label="إجراءات" /></tr>
                </thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id} onClick={() => setEditing(c)}>
                      <td className="case-cell" data-label="الدائرة"><strong>{c.name}</strong></td>
                      <td data-label="يوم الانعقاد">{c.weekday !== null ? WEEKDAYS[c.weekday] : '—'}</td>
                      <td data-label="الفترة">{c.period || '—'}</td>
                      <td data-label="الاستئناف">{c.appeal_weekday !== null ? WEEKDAYS[c.appeal_weekday] : '—'}</td>
                      <td data-label="القضايا">{counts.get(c.id) || 0}</td>
                      <td data-label="ملاحظات" className="small">{c.notes || '—'}</td>
                      <td className="action-cell">
                        <div className="row-actions">
                          <button type="button" className="icon-btn" aria-label="تعديل" onClick={(e) => { e.stopPropagation(); setEditing(c) }}><Pencil size={15} /></button>
                          <button type="button" className="icon-btn" aria-label="حذف" onClick={(e) => { e.stopPropagation(); remove(c) }}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      <CircuitForm open={!!editing} circuit={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
    </div>
  )
}
