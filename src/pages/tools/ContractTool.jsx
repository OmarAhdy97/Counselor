import { useEffect, useState } from 'react'
import { Printer, Copy, RotateCcw } from 'lucide-react'
import { Field } from '../../components/ui'
import { usePrint } from '../../components/print'
import { useToast } from '../../context/ToastContext'
import { CONTRACT_TEMPLATES, SIGNATURES } from '../../lib/contracts'
import Select from '../../components/Select'

export default function ContractTool() {
  const toast = useToast()
  const [id, setId] = useState(CONTRACT_TEMPLATES[0].id)
  const [values, setValues] = useState({})
  const [text, setText] = useState('')
  const [print, PrintArea] = usePrint()
  const tpl = CONTRACT_TEMPLATES.find((t) => t.id === id)

  const generate = () => setText(tpl.body(values))
  useEffect(generate, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }))

  return (
    <div className="stack">
      <p className="inline-note">
        هذه نماذج استرشادية تُراجَع قانونياً وتُعدَّل بحسب الواقعة قبل الاعتماد؛ ليست استشارة قانونية.
        املأ البيانات ثم اضغط «تحديث النص»، وعدّل النص يدوياً كما تشاء قبل الطباعة.
      </p>
      <div className="tool-grid letter-grid">
        <div className="card pad">
          <h2 className="card-title">بيانات العقد</h2>
          <div className="stack full">
            <Field label="نوع العقد">
              {(fid) => (
                <Select id={fid} value={id} onChange={(e) => { setId(e.target.value); setValues({}) }}>
                  {CONTRACT_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </Select>
              )}
            </Field>
            <div className="grid-2">
              {tpl.fields.map((f) => (
                <div key={f.key} className={f.wide ? 'field-full' : ''}>
                  <Field label={f.label}>
                    {(fid) => (
                      <input
                        id={fid}
                        type={f.type || 'text'}
                        dir={f.ltr ? 'ltr' : undefined}
                        placeholder={f.placeholder}
                        value={values[f.key] || ''}
                        onChange={set(f.key)}
                      />
                    )}
                  </Field>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-primary" onClick={generate}>تحديث النص من البيانات</button>
          </div>
        </div>

        <div className="card pad">
          <div className="card-title-row">
            <h2 className="card-title">{tpl.title}</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={generate}><RotateCcw size={14} /> من القالب</button>
          </div>
          <Field label="نص العقد (قابل للتعديل)" hint="«……» = بيان لم يُدخل بعد">
            {(fid) => <textarea id={fid} rows={22} value={text} onChange={(e) => setText(e.target.value)} />}
          </Field>
          <div className="row-actions">
            <button type="button" className="btn btn-primary" onClick={print}><Printer size={16} /> طباعة</button>
            <button type="button" className="btn btn-soft" onClick={() => navigator.clipboard.writeText(text).then(() => toast('تم النسخ'))}>
              <Copy size={16} /> نسخ النص
            </button>
          </div>
        </div>
      </div>

      <PrintArea>
        <div className="doc-print">
          <h1 className="doc-title">{tpl.title_text()}</h1>
          <div className="pre contract-body">{text}</div>
          <div className="sign-row">
            {SIGNATURES[tpl.id].map((s) => (
              <div key={s}><p>{s}</p><p className="sign-line">……………………</p></div>
            ))}
          </div>
        </div>
      </PrintArea>
    </div>
  )
}
