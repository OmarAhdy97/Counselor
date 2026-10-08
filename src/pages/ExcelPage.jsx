import { useRef, useState } from 'react'
import { Upload, Download, FileSpreadsheet } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { friendlyError } from '../lib/errors'
import { PageHead } from '../components/ui'
import { readAgendaWorkbook, exportAgendaWorkbook, caseKey, SHEET_COLUMNS } from '../lib/excel'
import { today } from '../lib/dates'

export default function ExcelPage() {
  const { cases, lastSessionByCase, importCases } = useData()
  const toast = useToast()
  const input = useRef(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setResult(null)
    try {
      const parsed = await readAgendaWorkbook(file)
      const existing = new Map(cases.map((c) => [caseKey(c), c]))
      const keys = new Set(parsed.cases.map(caseKey))
      const newCount = [...keys].filter((k) => !existing.has(k)).length
      // An older copy of the sheet would move hearings back in time; count those so it is obvious.
      const older = parsed.cases.filter((r) => {
        const c = existing.get(caseKey(r))
        return c?.next_session && r.next_session && r.next_session < c.next_session
      }).length
      setPreview({ ...parsed, fileName: file.name, newCount, updateCount: keys.size - newCount, older })
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const confirm = async () => {
    setBusy(true)
    try {
      const r = await importCases(preview.cases)
      setResult(r)
      setPreview(null)
      toast('تم الاستيراد')
    } catch (err) {
      toast(friendlyError(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <PageHead title="الإكسيل" subtitle="استيراد شيت الأجندة أو تصدير القضايا بنفس ترتيب أعمدته" />

      <div className="two-col">
        <section className="card pad">
          <h2 className="card-title"><Upload size={18} /> استيراد من إكسيل</h2>
          <p className="muted small">
            ارفع شيت «أجندة العمل». يتعرّف البرنامج على الأعمدة بأسمائها، ويطابق الدعاوى بـ
            المحكمة + الرقم + السنة: الدعوى الجديدة تُضاف، والموجودة تُحدَّث بالخانات الممتلئة فقط
            (الخانة الفارغة في الشيت لا تمسح شيئاً). «الجلسة السابقة» تُضاف لسجل الجلسات.
          </p>
          <input ref={input} type="file" accept=".xlsx,.xls,.xlsm,.csv" onChange={pick} hidden />
          <button type="button" className="btn btn-primary" onClick={() => input.current.click()} disabled={busy}>
            <FileSpreadsheet size={16} /> اختيار ملف
          </button>

          {preview && (
            <div className="import-preview">
              <h3>{preview.fileName} <span className="muted small">— ورقة «{preview.sheetName}»</span></h3>
              <ul className="stats-list">
                <li><strong>{preview.cases.length}</strong> صف مقروء</li>
                <li><strong>{preview.newCount}</strong> دعوى جديدة</li>
                <li><strong>{preview.updateCount}</strong> دعوى موجودة ستُحدَّث</li>
                {preview.warnings.length > 0 && <li><strong>{preview.warnings.length}</strong> صف متخطى</li>}
              </ul>
              {preview.older > 0 && (
                <p className="inline-alert">
                  تنبيه: في {preview.older} دعوى تاريخ الجلسة في الملف أقدم من المسجّل في البرنامج — يبدو أن الملف
                  نسخة قديمة. الاستيراد سيُرجِع هذه الجلسات لتواريخها القديمة.
                </p>
              )}
              {preview.warnings.length > 0 && (
                <details className="more">
                  <summary>الصفوف المتخطاة</summary>
                  <ul className="small">{preview.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                </details>
              )}
              <div className="row-actions">
                <button type="button" className="btn btn-primary" onClick={confirm} disabled={busy || !preview.cases.length}>
                  {busy ? 'جارٍ الاستيراد…' : 'تأكيد الاستيراد'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setPreview(null)} disabled={busy}>إلغاء</button>
              </div>
            </div>
          )}

          {result && (
            <p className="inline-note">
              أُضيفت {result.added} دعوى، وحُدِّثت {result.updated}، وسُجِّلت {result.sessions} جلسة سابقة في السجل
              {result.duplicatesInFile ? `، ودُمج ${result.duplicatesInFile} صف مكرر داخل الملف` : ''}.
            </p>
          )}
        </section>

        <section className="card pad">
          <h2 className="card-title"><Download size={18} /> تصدير</h2>
          <p className="muted small">
            ملف إكسيل من اليمين لليسار بنفس أعمدة الشيت الأصلي ({SHEET_COLUMNS.length} عموداً)، يصلح للطباعة أو
            للإرسال. «الجلسة السابقة» تؤخذ من آخر جلسة في السجل.
          </p>
          <button
            type="button"
            className="btn btn-soft"
            disabled={!cases.length}
            onClick={() => exportAgendaWorkbook(cases, lastSessionByCase, `أجندة العمل ${today()}.xlsx`)}
          >
            <Download size={16} /> تصدير كل القضايا ({cases.length})
          </button>
        </section>
      </div>
    </div>
  )
}
