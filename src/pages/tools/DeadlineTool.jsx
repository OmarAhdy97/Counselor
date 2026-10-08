import { useMemo, useState } from 'react'
import { Field } from '../../components/ui'
import { ALL_RULES, DEADLINE_RULES, computeDeadline, distanceDays } from '../../lib/deadlines'
import { fmtLong, today, relative } from '../../lib/dates'
import Select from '../../components/Select'
import DateInput from '../../components/DateInput'

export default function DeadlineTool() {
  const [ruleId, setRuleId] = useState('appeal')
  const [start, setStart] = useState(today())
  const [custom, setCustom] = useState(30)
  const [km, setKm] = useState('')
  const [holidays, setHolidays] = useState('')

  const rule = ALL_RULES.find((r) => r.id === ruleId)
  const holidayList = useMemo(
    () => holidays.split(/[\s,،]+/).map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s)),
    [holidays]
  )
  const res = computeDeadline({
    start,
    days: rule ? rule.days : Number(custom),
    months: rule?.months,
    km,
    holidays: holidayList,
  })

  return (
    <div className="tool-grid">
      <div className="card pad">
        <h2 className="card-title">حاسبة المواعيد الإجرائية</h2>
        <div className="stack full">
          <Field label="نوع الإجراء">
            {(id) => (
              <Select id={id} value={ruleId} onChange={(e) => setRuleId(e.target.value)}>
                {DEADLINE_RULES.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.items.map((r) => (
                      <option key={r.id} value={r.id}>{r.label} — {r.months ? `${r.months} أشهر` : `${r.days} يوماً`}</option>
                    ))}
                  </optgroup>
                ))}
                <option value="custom">ميعاد آخر (أدخل عدد الأيام)</option>
              </Select>
            )}
          </Field>
          {!rule && (
            <Field label="عدد أيام الميعاد">
              {(id) => <input id={id} type="number" min="1" max="3650" value={custom} onChange={(e) => setCustom(e.target.value)} />}
            </Field>
          )}
          <Field label="تاريخ بدء الميعاد" hint={rule?.from}>
            {(id) => <DateInput id={id} value={start} onChange={(e) => setStart(e.target.value)} />}
          </Field>
          <Field label="ميعاد مسافة (بالكيلومتر، اختياري)" hint={km ? `يُضاف ${distanceDays(km)} يوم (م 16 مرافعات: يوم لكل 50 كم، بحد أقصى 4 أيام)` : 'المسافة بين موطن المطلوب إعلانه والمحكمة'}>
            {(id) => <input id={id} type="number" min="0" value={km} onChange={(e) => setKm(e.target.value)} />}
          </Field>
          <Field label="عطلات رسمية أخرى (اختياري)" hint="تواريخ بصيغة 2026-10-06 مفصولة بمسافة؛ الجمعة تُحسب تلقائياً">
            {(id) => <input id={id} dir="ltr" value={holidays} onChange={(e) => setHolidays(e.target.value)} placeholder="2026-10-06 2026-11-01" />}
          </Field>
        </div>
      </div>

      <div className="card pad result-card">
        {res ? (
          <>
            <p className="muted small">آخر يوم في الميعاد</p>
            <p className="result-big">{fmtLong(res.end)}</p>
            <p className="muted">{relative(res.end)} — {res.total} يوماً من تاريخ البدء</p>
            {res.extra > 0 && <p className="small">شامل ميعاد مسافة {res.extra} يوم.</p>}
            {res.moved.length > 0 && <p className="small">امتد الميعاد لأن آخر يوم صادف عطلة ({res.moved.map(fmtLong).join('، ')}) — م 18 مرافعات.</p>}
            {rule && <p className="small"><strong>{rule.label}</strong> — {rule.ref}</p>}
            <p className="inline-note small">
              لا يُحسب يوم الحدوث (م 15 مرافعات). المواعيد هنا هي القاعدة العامة فقط وقد تختلف بقوانين خاصة أو
              بتعديلات لاحقة — راجع النص الساري قبل الاعتماد عليها.
            </p>
          </>
        ) : (
          <p className="muted">أدخل تاريخ البدء</p>
        )}
      </div>
    </div>
  )
}
