import { useState } from 'react'
import { Copy } from 'lucide-react'
import { Field } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { formatAmount, tafqit } from '../../lib/tafqit'

export default function TafqitTool() {
  const toast = useToast()
  const [amount, setAmount] = useState('')
  let text = ''
  let error = ''
  if (amount !== '') {
    try {
      text = tafqit(amount)
    } catch (e) {
      error = e.message
    }
  }
  const copy = (t) => navigator.clipboard.writeText(t).then(() => toast('تم النسخ'))

  return (
    <div className="tool-grid">
      <div className="card pad">
        <h2 className="card-title">تحويل المبلغ إلى حروف (تفقيط)</h2>
        <div className="stack full">
          <Field label="المبلغ بالجنيه" hint="القروش بعد العلامة العشرية: 1250.50">
            {(id) => <input id={id} type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />}
          </Field>
        </div>
      </div>
      <div className="card pad result-card">
        {error ? <p className="inline-alert">{error}</p> : text ? (
          <>
            <p className="muted small">{formatAmount(amount)} جنيه</p>
            <p className="result-text">{text}</p>
            <div className="row-actions">
              <button type="button" className="btn btn-soft btn-sm" onClick={() => copy(text)}><Copy size={14} /> نسخ</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(`${formatAmount(amount)} جنيه (${text})`)}>نسخ مع الرقم</button>
            </div>
          </>
        ) : <p className="muted">اكتب المبلغ ليظهر بالحروف</p>}
      </div>
    </div>
  )
}
