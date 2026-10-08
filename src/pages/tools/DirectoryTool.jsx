import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookUser, MapPin, Pencil, Phone, Plus, Search, Trash2, Download } from 'lucide-react'
import { Empty, Field, Modal, Segmented, DataList } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { fold } from '../../lib/laws'
import Select from '../../components/Select'

const KINDS = ['محكمة', 'محضرين', 'جهة', 'أخرى']
const KIND_LABEL = { محكمة: 'المحاكم', محضرين: 'أقلام المحضرين', جهة: 'الجهات', أخرى: 'أخرى' }
const EMPTY = { kind: 'محكمة', name: '', parent: '', address: '', phone: '', notes: '' }

/** The counselor's own directory of courts, bailiff offices and the bodies he represents. */
export default function DirectoryTool() {
  const { cases } = useData()
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [kind, setKind] = useState('محكمة')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('agenda_directory').select('*').order('created_at')
    if (error) toast(friendlyError(error), 'error')
    else setRows(data)
  }, [toast])
  useEffect(() => { load() }, [load])

  const list = useMemo(() => {
    const terms = fold(q).split(/\s+/).filter(Boolean)
    return (rows || [])
      .filter((r) => r.kind === kind)
      .filter((r) => terms.every((t) => fold(`${r.name} ${r.parent} ${r.address} ${r.phone} ${r.notes}`).includes(t)))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  }, [rows, kind, q])

  const counts = useMemo(() => Object.fromEntries(KINDS.map((k) => [k, (rows || []).filter((r) => r.kind === k).length])), [rows])
  const courtNames = useMemo(() => (rows || []).filter((r) => r.kind === 'محكمة').map((r) => r.name), [rows])

  const open = (row) => {
    setEditing(row || 'new')
    setForm(row ? { ...EMPTY, ...row, parent: row.parent || '', address: row.address || '', phone: row.phone || '', notes: row.notes || '' } : { ...EMPTY, kind })
  }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    const payload = {
      kind: form.kind,
      name: form.name.trim(),
      parent: form.parent.trim() || null,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
    }
    const q = editing === 'new' ? supabase.from('agenda_directory').insert(payload) : supabase.from('agenda_directory').update(payload).eq('id', editing.id)
    const { error } = await q
    setBusy(false)
    if (error) return toast(/duplicate|unique/i.test(error.message) ? 'هذا الاسم مسجل بالفعل في نفس النوع.' : friendlyError(error), 'error')
    toast('تم الحفظ')
    setEditing(null)
    setKind(payload.kind)
    load()
  }

  const remove = async (r) => {
    if (!window.confirm(`حذف «${r.name}» من الدليل؟`)) return
    const { error } = await supabase.from('agenda_directory').delete().eq('id', r.id)
    if (error) return toast(friendlyError(error), 'error')
    setRows((prev) => prev.filter((x) => x.id !== r.id))
  }

  // Courts already used in his cases become directory entries (names only; he adds the details).
  const importCourts = async () => {
    const have = new Set(courtNames)
    const fresh = [...new Set(cases.map((c) => c.court))].filter((n) => n && !have.has(n))
    if (!fresh.length) return toast('كل محاكم قضاياك موجودة في الدليل بالفعل')
    const { error } = await supabase.from('agenda_directory').insert(fresh.map((name) => ({ kind: 'محكمة', name })))
    if (error) return toast(friendlyError(error), 'error')
    toast(`أُضيفت ${fresh.length} محكمة من قضاياك`)
    load()
  }

  if (rows === null) return <div className="loading">جارٍ التحميل…</div>

  return (
    <div className="stack">
      <div className="card pad">
        <div className="card-title-row full">
          <h2 className="card-title"><BookUser size={18} /> الدليل</h2>
          <div className="row-actions">
            {kind === 'محكمة' && cases.length > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={importCourts}><Download size={14} /> من محاكم قضاياك</button>
            )}
            <button type="button" className="btn btn-primary btn-sm" onClick={() => open(null)}><Plus size={14} /> إضافة</button>
          </div>
        </div>
        <p className="muted small">دليلك الخاص: لا يحتوي بيانات جاهزة، أضف ما تحتاجه من عناوين وأرقام بعد التأكد منها.</p>
        <div className="toolbar full">
          <Segmented value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k], count: counts[k] }))} />
          <label className="search flex-1">
            <Search size={16} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو العنوان أو الهاتف…" />
          </label>
        </div>
      </div>

      <div className="card">
        {list.length === 0 ? (
          <Empty icon={BookUser} title={rows.length ? 'لا توجد نتائج' : 'الدليل فارغ'} text={rows.length ? null : 'أضف المحاكم وأقلام المحضرين والجهات التي تتعامل معها لتجدها سريعاً.'} />
        ) : (
          <ul className="dir-list">
            {list.map((r) => (
              <li key={r.id}>
                <div className="dir-main">
                  <strong>{r.name}</strong>
                  {r.parent && <span className="muted small"> — {r.parent}</span>}
                  {r.address && (
                    <p className="small"><MapPin size={13} /> {r.address}{' '}
                      <a className="link" href={`https://www.google.com/maps/search/${encodeURIComponent(`${r.name} ${r.address}`)}`} target="_blank" rel="noreferrer noopener">الخريطة</a>
                    </p>
                  )}
                  {r.phone && <p className="small"><Phone size={13} /> <a href={`tel:${r.phone.replace(/[^\d+]/g, '')}`} dir="ltr">{r.phone}</a></p>}
                  {r.notes && <p className="small muted pre">{r.notes}</p>}
                </div>
                <div className="doc-actions">
                  <button type="button" className="icon-btn" onClick={() => open(r)} aria-label="تعديل"><Pencil size={15} /></button>
                  <button type="button" className="icon-btn danger" onClick={() => remove(r)} aria-label="حذف"><Trash2 size={15} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'إضافة للدليل' : 'تعديل'}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>إلغاء</button>
            <button type="submit" form="dir-form" className="btn btn-primary" disabled={busy}>حفظ</button>
          </>
        }
      >
        <form id="dir-form" className="stack" onSubmit={save}>
          <DataList id="dl-dir-courts" items={courtNames} />
          <div className="grid-2">
            <Field label="النوع">
              {(id) => <Select id={id} value={form.kind} onChange={set('kind')}>{KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</Select>}
            </Field>
            <Field label="الاسم *">{(id) => <input id={id} value={form.name} onChange={set('name')} required autoFocus />}</Field>
            <Field label={form.kind === 'محضرين' ? 'المحكمة التابع لها' : 'تابع لـ (اختياري)'}>
              {(id) => <input id={id} list="dl-dir-courts" value={form.parent} onChange={set('parent')} />}
            </Field>
            <Field label="الهاتف">{(id) => <input id={id} dir="ltr" inputMode="tel" value={form.phone} onChange={set('phone')} />}</Field>
          </div>
          <Field label="العنوان">{(id) => <input id={id} value={form.address} onChange={set('address')} />}</Field>
          <Field label="ملاحظات">{(id) => <textarea id={id} rows={3} value={form.notes} onChange={set('notes')} placeholder="مواعيد العمل، اسم المسؤول…" />}</Field>
        </form>
      </Modal>
    </div>
  )
}
