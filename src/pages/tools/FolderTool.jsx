import { useEffect, useState } from 'react'
import { Plus, Printer, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { Field } from '../../components/ui'
import CasePicker from '../../components/CasePicker'
import { usePrint } from '../../components/print'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useUI } from '../../context/UIContext'
import { caseTitle } from '../../lib/constants'
import { fmt } from '../../lib/dates'
import { integerWords } from '../../lib/tafqit'
import Select from '../../components/Select'
import DateInput from '../../components/DateInput'

const NEW_ROW = () => ({ id: crypto.randomUUID(), text: '', kind: 'صورة ضوئية', pages: '' })
const KINDS = ['صورة ضوئية', 'صورة رسمية', 'أصل']

/** حافظة مستندات: numbered list of documents submitted at a hearing, ready to print. */
export default function FolderTool() {
  const { tool, setTool } = useUI()
  const caseId = tool.caseId
  const setCaseId = (id) => setTool((t) => ({ ...t, caseId: id }))
  const { cases } = useData()
  const { displayName, profile } = useAuth()
  const [head, setHead] = useState({ court: '', number: '', session: '', from: '', behalf: '', against: '' })
  const [rows, setRows] = useState([NEW_ROW(), NEW_ROW()])
  const [print, PrintArea] = usePrint()

  useEffect(() => {
    const c = cases.find((x) => x.id === caseId)
    if (!c) return
    setHead((h) => ({
      ...h,
      court: c.court || '',
      number: caseTitle(c),
      session: c.next_session || '',
      behalf: h.behalf || c.plaintiff || '',
      against: h.against || c.defendant || '',
    }))
  }, [caseId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setHead((h) => (h.from ? h : { ...h, from: `هيئة قضايا الدولة${profile?.branch ? ` — ${profile.branch}` : ''}` }))
  }, [profile])

  const setH = (k) => (e) => setHead((h) => ({ ...h, [k]: e.target.value }))
  const setRow = (id, k, v) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [k]: v } : r)))
  const move = (i, d) => setRows((rs) => {
    const next = [...rs]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    return next
  })
  const filled = rows.filter((r) => r.text.trim())

  return (
    <div className="stack">
      <div className="card pad">
        <h2 className="card-title">حافظة مستندات</h2>
        <div className="stack full">
          <CasePicker value={caseId} onChange={setCaseId} />
          <div className="grid-3">
            <Field label="المحكمة">{(id) => <input id={id} value={head.court} onChange={setH('court')} />}</Field>
            <Field label="رقم الدعوى">{(id) => <input id={id} value={head.number} onChange={setH('number')} placeholder="152 لسنة 2024" />}</Field>
            <Field label="جلسة">{(id) => <DateInput id={id} value={head.session} onChange={setH('session')} />}</Field>
            <Field label="مقدمة من">{(id) => <input id={id} value={head.from} onChange={setH('from')} />}</Field>
            <Field label="نائبة عن">{(id) => <input id={id} value={head.behalf} onChange={setH('behalf')} placeholder="وزير المالية بصفته" />}</Field>
            <Field label="ضد">{(id) => <input id={id} value={head.against} onChange={setH('against')} />}</Field>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>المستندات <span className="count">{filled.length}</span></h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={print} disabled={!filled.length}>
            <Printer size={14} /> طباعة الحافظة
          </button>
        </div>
        <ol className="doc-rows">
          {rows.map((r, i) => (
            <li key={r.id}>
              <span className="doc-num">{i + 1}</span>
              <input value={r.text} onChange={(e) => setRow(r.id, 'text', e.target.value)} placeholder="بيان المستند، مثال: صورة من محضر الحجز الإداري المؤرخ…" aria-label={`بيان المستند ${i + 1}`} />
              <Select value={r.kind} onChange={(e) => setRow(r.id, 'kind', e.target.value)} aria-label="نوع المستند">
                {KINDS.map((k) => <option key={k}>{k}</option>)}
              </Select>
              <input className="doc-pages" type="number" min="1" value={r.pages} onChange={(e) => setRow(r.id, 'pages', e.target.value)} placeholder="ورقات" aria-label="عدد الورقات" />
              <div className="doc-actions">
                <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="لأعلى"><ArrowUp size={14} /></button>
                <button type="button" className="icon-btn" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label="لأسفل"><ArrowDown size={14} /></button>
                <button type="button" className="icon-btn" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.id !== r.id) : [NEW_ROW()]))} aria-label="حذف"><Trash2 size={14} /></button>
              </div>
            </li>
          ))}
        </ol>
        <div className="more-row">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows((rs) => [...rs, NEW_ROW()])}><Plus size={14} /> إضافة مستند</button>
        </div>
      </div>

      <PrintArea>
        <div className="doc-print">
          <h1 className="doc-title">حافظة مستندات</h1>
          <p className="doc-center">مقدمة من: {head.from || '……'}{head.behalf ? ` — نائبة عن: ${head.behalf}` : ''}</p>
          {head.against && <p className="doc-center">ضد: {head.against}</p>}
          <p className="doc-center">في الدعوى رقم {head.number || '……'} — {head.court || '……'}{head.session ? ` — جلسة ${fmt(head.session)}` : ''}</p>
          <table>
            <thead><tr><th style={{ width: '8%' }}>م</th><th>بيان المستند</th><th style={{ width: '16%' }}>نوعه</th><th style={{ width: '10%' }}>ورقات</th></tr></thead>
            <tbody>
              {filled.map((r, i) => (
                <tr key={r.id}><td>{i + 1}</td><td>{r.text}</td><td>{r.kind}</td><td>{r.pages || '—'}</td></tr>
              ))}
            </tbody>
          </table>
          <p>عدد المستندات: {filled.length} ({integerWords(filled.length)}).</p>
          <div className="doc-sign">
            <p>وكيل الحكومة</p>
            <p>{displayName}</p>
          </div>
        </div>
      </PrintArea>
    </div>
  )
}
