import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Field } from '../../components/ui'
import Select from '../../components/Select'
import { calculateJudicialFees, FEE_CATEGORY_LABELS } from '../../lib/fees'

const UNSPECIFIED_COURTS = [
  ['partial', 'محكمة المواد الجزئية — 5 ج'],
  ['urgent', 'محكمة الأمور المستعجلة — 10 ج'],
  ['first_instance', 'المحكمة الابتدائية (الكلية) — 15 ج'],
  ['bankruptcy', 'الاقتصادية / الكلية (الإفلاس) — 50 ج'],
  ['appeal_partial', 'استئناف أمام الابتدائية — 10 ج'],
  ['appeal_urgent', 'استئناف مستعجل — 15 ج'],
  ['appeal_high', 'الاستئناف العالي — 30 ج'],
]

const money = (n) => `${(Number(n) || 0).toLocaleString('en-US')} ج.م`

/** Judicial fees estimate. The calculation engine is ported from the Aldiwan (wlywly) project. */
export default function FeesTool() {
  const [category, setCategory] = useState('civil_monetary')
  const [amount, setAmount] = useState('50000')
  const [defendants, setDefendants] = useState('1')
  const [courtType, setCourtType] = useState('partial')
  const [urgent, setUrgent] = useState(false)
  const [copied, setCopied] = useState(false)

  const isMonetary = ['civil_monetary', 'payment_order', 'appeal_civil'].includes(category)
  const needsCourtType = category === 'civil_unspecified' || category === 'urgent_action'
  const f = calculateJudicialFees({
    feeCategory: category,
    claimAmount: amount,
    unspecifiedCourtType: courtType,
    defendantsCount: defendants,
    hasUrgentRequest: urgent,
  })

  const rows = [
    [<>الرسم النسبي{f.filingBaseAmount ? <small> (على وعاء {f.filingBaseAmount.toLocaleString('en-US')} ج، مادة 9)</small> : null}</>, f.filingProportionalFee || f.basicFee],
    ['صندوق الخدمات (50%)', f.judicialServicesFee],
    ['صندوق أبنية المحاكم', f.courtBuildings],
    ['أتعاب المحاماة', f.lawyerFees],
    ['دمغة الشهيد', f.martyrStamp],
    f.familyFundStamp ? ['طابع دعم ورعاية الأسرة', f.familyFundStamp] : null,
  ].filter(Boolean)

  const report = () => {
    const lines = [
      'بيان تقديري للرسوم القضائية',
      `- نوع الإجراء: ${FEE_CATEGORY_LABELS[category]}`,
      `- الاختصاص: ${f.jurisdiction}`,
      `- المبلغ المطالب به: ${isMonetary ? money(amount) : 'غير مقدرة القيمة (رسم ثابت)'}`,
    ]
    if (f.isExempt) lines.push(`- الرسوم: معفاة بقوة القانون`, `- السند: ${f.exemptReason}`)
    else {
      lines.push(
        `- إجمالي المدفوع عند القيد: ${money(f.totalAtFiling)}`,
        ...rows.map(([label, v]) => `  • ${typeof label === 'string' ? label : 'الرسم النسبي'}: ${money(v)}`),
        `  • الضرائب (مهن + قيمة مضافة): ${money(f.totalTax)}`,
        `  • مصاريف الإعلان (${defendants} خصم): ${money(f.bailiffFee)}`
      )
      if (f.depositSecurity) lines.push(`  • كفالة الطعن: ${money(f.depositSecurity)}`)
      if (f.totalPostJudgment > 0) lines.push(`- قائمة الرسوم بعد الحكم (أمر التقدير): ${money(f.totalPostJudgment)}`)
      lines.push(`- ملاحظة: ${f.notes}`)
    }
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="tool-grid">
      <div className="card pad">
        <h2 className="card-title">الرسوم القضائية (تقديري)</h2>
        <div className="stack full">
          <Field label="نوع الإجراء">
            {(id) => (
              <Select id={id} value={category} onChange={(e) => setCategory(e.target.value)}>
                {Object.entries(FEE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            )}
          </Field>
          {isMonetary && (
            <Field label="قيمة المطالبة (جنيه)">
              {(id) => <input id={id} className="form-input" type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}
            </Field>
          )}
          {needsCourtType && (
            <Field label="المحكمة / الدرجة">
              {(id) => (
                <Select id={id} value={courtType} onChange={(e) => setCourtType(e.target.value)}>
                  {UNSPECIFIED_COURTS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              )}
            </Field>
          )}
          {category !== 'labor' && (
            <Field label="عدد المدعى عليهم (لمصاريف الإعلان)">
              {(id) => <input id={id} className="form-input" type="number" min="1" inputMode="numeric" value={defendants} onChange={(e) => setDefendants(e.target.value)} />}
            </Field>
          )}
          {isMonetary && (
            <label className="check">
              <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
              مع طلب مستعجل (شق مستعجل)
            </label>
          )}
          <dl className="facts one">
            <div><dt>الاختصاص</dt><dd>{f.jurisdiction}</dd></div>
            <div><dt>السند القانوني</dt><dd>{f.notes || f.exemptReason}</dd></div>
          </dl>
        </div>
      </div>

      <div className="stack">
        <div className={`fee-total ${f.isExempt ? 'is-exempt' : ''}`}>
          <span className="fee-total-label">{f.isExempt ? 'الإعفاء من الرسوم' : 'إجمالي المدفوع عند قيد الدعوى'}</span>
          <div className="fee-total-amount">{f.isExempt ? 'معفاة تماماً' : money(f.totalAtFiling)}</div>
          {f.isExempt && <p>{f.exemptReason}</p>}
        </div>

        {!f.isExempt && (
          <div className="card pad-card">
            <div className="card-title-row">
              <h3 className="card-heading">تفصيل الرسوم والمصروفات</h3>
              <button type="button" className="btn btn-soft btn-sm" onClick={report}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'تم النسخ' : 'نسخ البيان'}
              </button>
            </div>
            <div className="fee-rows">
              {rows.map(([label, value], i) => <div className="fee-row" key={i}><span>{label}</span><b>{money(value)}</b></div>)}
              <div className="fee-row is-sum"><span>إجمالي الرسوم والملحقات</span><b>{money(f.subtotalBeforeTax)}</b></div>
              <div className="fee-row"><span>ضريبة المهن الحرة</span><b>{money(f.professionalTax)}</b></div>
              <div className="fee-row"><span>ضريبة القيمة المضافة</span><b>{money(f.vatTax)}</b></div>
              <div className="fee-row is-sum"><span>إجمالي الضرائب</span><b>{money(f.totalTax)}</b></div>
              <div className="fee-row"><span>مصاريف إعلان الصحيفة ({defendants} خصم)</span><b>{money(f.bailiffFee)}</b></div>
              {f.urgentFee > 0 && <div className="fee-row"><span>الشق المستعجل</span><b>{money(f.urgentFee)}</b></div>}
              {f.depositSecurity > 0 && <div className="fee-row is-sum"><span>كفالة الطعن (تسترد عند قبول الطعن)</span><b>{money(f.depositSecurity)}</b></div>}
            </div>
          </div>
        )}

        {f.totalPostJudgment > 0 && (
          <div className="card pad-card">
            <h3 className="card-heading">قائمة الرسوم بعد الحكم (أمر التقدير)</h3>
            <p className="hint">يصدر بها أمر تقدير من قلم الكتاب بعد الفصل في الدعوى، ويلزم بها الخصم المحكوم عليه بالمصروفات.</p>
            <div className="money-strip two">
              <div><span>نسبي متبقي</span><b>{money(f.remainingProportional)}</b></div>
              <div><span>خدمات متبقي</span><b>{money(f.remainingServices)}</b></div>
            </div>
            <div className="fee-row is-sum"><span>إجمالي أمر التقدير المتوقع</span><b>{money(f.totalPostJudgment)}</b></div>
          </div>
        )}

        {f.fullFeeBrackets && (
          <div className="card pad-card">
            <h3 className="card-heading">شرائح الرسم النسبي (مادة 1)</h3>
            <div className="fee-rows">
              <div className="fee-row"><span>أول 250 جنيهاً (2%)</span><b>{f.fullFeeBrackets.b1.toFixed(2)} ج.م</b></div>
              <div className="fee-row"><span>من 250 إلى 2,000 (3%)</span><b>{f.fullFeeBrackets.b2.toFixed(2)} ج.م</b></div>
              <div className="fee-row"><span>من 2,000 إلى 4,000 (4%)</span><b>{f.fullFeeBrackets.b3.toFixed(2)} ج.م</b></div>
              <div className="fee-row"><span>ما زاد عن 4,000 (5%)</span><b>{f.fullFeeBrackets.b4.toFixed(2)} ج.م</b></div>
              <div className="fee-row is-sum"><span>مجموع الرسم النسبي الكامل</span><b>{money(f.fullProportionalFee)}</b></div>
            </div>
          </div>
        )}

        <p className="inline-note small">
          بيان تقديري للتخطيط (مأخوذ من حاسبة مشروع «الديوان»)، والمعتمد هو تقدير قلم الكتاب. راجع الأرقام قبل الاعتماد عليها.
        </p>
      </div>
    </div>
  )
}
