import { useState } from 'react'
import { Copy } from 'lucide-react'
import { Field } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { INTEREST_RATES, legalInterest } from '../../lib/interest'
import { formatAmount, tafqit } from '../../lib/tafqit'
import { fmt, today } from '../../lib/dates'
import Select from '../../components/Select'
import DateInput from '../../components/DateInput'

export default function InterestTool() {
  const toast = useToast()
  const [principal, setPrincipal] = useState('')
  const [rate, setRate] = useState('4')
  const [customRate, setCustomRate] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState(today())
  const [cap, setCap] = useState(true)

  const r = rate === 'custom' ? customRate : rate
  const res = legalInterest({ principal, rate: r, from, to, capAtPrincipal: cap })

  const summary = res
    ? `فوائد قانونية بواقع ${r}% سنوياً على مبلغ ${formatAmount(principal)} جنيه من ${fmt(from)} حتى ${fmt(to)} (${res.days} يوماً) = ${formatAmount(res.interest)} جنيه (${tafqit(res.interest)})، والإجمالي ${formatAmount(res.total)} جنيه.`
    : ''

  return (
    <div className="tool-grid">
      <div className="card pad">
        <h2 className="card-title">حاسبة الفوائد القانونية</h2>
        <div className="stack full">
          <Field label="أصل المبلغ (جنيه)">
            {(id) => <input id={id} type="number" min="0" step="0.01" value={principal} onChange={(e) => setPrincipal(e.target.value)} />}
          </Field>
          <Field label="سعر الفائدة السنوي">
            {(id) => (
              <Select id={id} value={rate} onChange={(e) => setRate(e.target.value)}>
                {INTEREST_RATES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                <option value="custom">سعر آخر (اتفاقي أو محكوم به)</option>
              </Select>
            )}
          </Field>
          {rate === 'custom' && (
            <Field label="السعر %" hint="الفائدة الاتفاقية لا تزيد على 7% (م 227 مدني)">
              {(id) => <input id={id} type="number" min="0" step="0.01" value={customRate} onChange={(e) => setCustomRate(e.target.value)} />}
            </Field>
          )}
          <div className="grid-2">
            <Field label="من تاريخ" hint="عادة تاريخ المطالبة القضائية (م 226 مدني)">
              {(id) => <DateInput id={id} value={from} onChange={(e) => setFrom(e.target.value)} />}
            </Field>
            <Field label="حتى تاريخ">
              {(id) => <DateInput id={id} value={to} min={from} onChange={(e) => setTo(e.target.value)} />}
            </Field>
          </div>
          <label className="check">
            <input type="checkbox" checked={cap} onChange={(e) => setCap(e.target.checked)} />
            ألا تزيد الفوائد على أصل المبلغ (م 232 مدني)
          </label>
        </div>
      </div>

      <div className="card pad result-card">
        {res ? (
          <>
            <p className="muted small">قيمة الفوائد</p>
            <p className="result-big">{formatAmount(res.interest)} جنيه</p>
            <p className="small">{tafqit(res.interest)}</p>
            <ul className="stats-list col small">
              <li>المدة: <strong>{res.days}</strong> يوماً (≈ {res.years} سنة)</li>
              <li>فائدة اليوم: <strong>{formatAmount(res.perDay)}</strong> جنيه</li>
              <li>الأصل + الفوائد: <strong>{formatAmount(res.total)}</strong> جنيه</li>
              {res.capped && <li>تم تحديد الفوائد بقيمة أصل المبلغ.</li>}
            </ul>
            <button type="button" className="btn btn-soft btn-sm" onClick={() => navigator.clipboard.writeText(summary).then(() => toast('تم النسخ'))}>
              <Copy size={14} /> نسخ كفقرة
            </button>
            <p className="inline-note small">فائدة بسيطة على أساس 365 يوماً. راجع سعر الفائدة وبدء سريانها وفق الحكم أو العقد.</p>
          </>
        ) : (
          <p className="muted">أدخل المبلغ والتواريخ</p>
        )}
      </div>
    </div>
  )
}
