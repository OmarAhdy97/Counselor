import { useEffect, useState } from 'react'
import { Printer, Copy, RotateCcw, FileText, FileDown } from 'lucide-react'
import { Field } from '../../components/ui'
import CasePicker from '../../components/CasePicker'
import { usePrint } from '../../components/print'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useUI } from '../../context/UIContext'
import { useToast } from '../../context/ToastContext'
import { LETTER_TEMPLATES, fillTemplate, letterValues } from '../../lib/letters'
import { fmt, today } from '../../lib/dates'
import { exportLetterDocx } from '../../lib/docxExport'
import { friendlyError } from '../../lib/errors'
import Select from '../../components/Select'

/** Letters to the represented bodies, generated from templates and the chosen case, then edited and printed. */
export default function LetterTool() {
  const { tool, setTool } = useUI()
  const caseId = tool.caseId
  const setCaseId = (id) => setTool((t) => ({ ...t, caseId: id }))
  const { cases, lastSessionByCase } = useData()
  const { displayName, profile } = useAuth()
  const toast = useToast()
  const [templateId, setTemplateId] = useState(LETTER_TEMPLATES[0].id)
  const [amount, setAmount] = useState('')
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [ref, setRef] = useState('')
  const [print, PrintArea] = usePrint()
  const [exporting, setExporting] = useState(false)

  const c = cases.find((x) => x.id === caseId)
  const tpl = LETTER_TEMPLATES.find((t) => t.id === templateId)

  const generate = () => {
    const v = letterValues(c, { displayName, branch: profile?.branch, amount, lastSessionDate: c && lastSessionByCase.get(c.id)?.session_date })
    setSubject(fillTemplate(tpl.subject, v))
    setBody(fillTemplate(tpl.body, v))
  }

  const org = `هيئة قضايا الدولة${profile?.branch ? ` — ${profile.branch}` : ''}`
  const toWord = async () => {
    setExporting(true)
    try {
      await exportLetterDocx({ org, date: fmt(today()), ref, to, subject, body, author: displayName, filename: `${tpl.title}${c ? ` ${c.case_number}-${c.case_year}` : ''}` })
      toast('تم تصدير ملف Word')
    } catch (err) {
      toast(friendlyError(err), 'error')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    if (c && !to) setTo(c.plaintiff || '')
  }, [caseId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(generate, [templateId, caseId, amount]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="tool-grid letter-grid">
      <div className="card pad">
        <h2 className="card-title">خطابات ومكاتبات</h2>
        <div className="stack full">
          <Field label="القالب">
            {(id) => (
              <Select id={id} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                {LETTER_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </Select>
            )}
          </Field>
          <CasePicker value={caseId} onChange={setCaseId} label="الدعوى (لملء الخطاب تلقائياً)" />
          {templateId === 'amount' && (
            <Field label="المبلغ المحكوم به (جنيه)">
              {(id) => <input id={id} type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />}
            </Field>
          )}
          <Field label="إلى (الجهة)" hint="يُقترح المدعي في الدعوى؛ عدّله حسب الجهة المخاطبة">
            {(id) => <input id={id} value={to} onChange={(e) => setTo(e.target.value)} placeholder="السيد / رئيس مصلحة الجمارك" />}
          </Field>
          <Field label="رقم الصادر (اختياري)">
            {(id) => <input id={id} value={ref} onChange={(e) => setRef(e.target.value)} />}
          </Field>
        </div>
      </div>

      <div className="card pad">
        <div className="card-title-row">
          <h2 className="card-title">نص الخطاب</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={generate} title="إعادة النص من القالب">
            <RotateCcw size={14} /> من القالب
          </button>
        </div>
        <div className="stack full">
          <Field label="الموضوع">{(id) => <input id={id} value={subject} onChange={(e) => setSubject(e.target.value)} />}</Field>
          <Field label="النص" hint="«……» = بيان ناقص في الدعوى، أكمله قبل الطباعة">
            {(id) => <textarea id={id} rows={12} value={body} onChange={(e) => setBody(e.target.value)} />}
          </Field>
        </div>
        <div className="row-actions">
          <button type="button" className="btn btn-primary" onClick={print}><Printer size={16} /> طباعة</button>
          <button type="button" className="btn btn-soft" onClick={print} title="من نافذة الطباعة اختر «حفظ كـ PDF»"><FileDown size={16} /> حفظ PDF</button>
          <button type="button" className="btn btn-soft" onClick={toWord} disabled={exporting}><FileText size={16} /> {exporting ? 'جارٍ التجهيز…' : 'تصدير Word'}</button>
          <button type="button" className="btn btn-soft" onClick={() => navigator.clipboard.writeText(`${subject}\n\n${body}`).then(() => toast('تم النسخ'))}>
            <Copy size={16} /> نسخ النص
          </button>
        </div>
      </div>

      <PrintArea>
        <div className="doc-print letter-print">
          <div className="letter-meta">
            <span>{org}</span>
            <span>التاريخ: {fmt(today())}{ref ? ` — صادر رقم: ${ref}` : ''}</span>
          </div>
          <p className="letter-to">{to ? `السيد / ${to.replace(/^السيد\s*\/?\s*/, '')}` : 'السيد / ……'}</p>
          <p className="doc-center">تحية طيبة وبعد،،،</p>
          <p className="letter-subject">الموضوع: {subject}</p>
          <div className="pre letter-body">{body}</div>
          <p className="doc-center">وتفضلوا بقبول فائق الاحترام،،،</p>
          <div className="doc-sign">
            <p>المستشار</p>
            <p>{displayName}</p>
          </div>
        </div>
      </PrintArea>
    </div>
  )
}
