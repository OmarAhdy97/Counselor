import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { caseTitle } from '../lib/constants'

const fold = (s) => String(s ?? '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase()

/** Searchable case chooser used by the tools to prefill documents from a case. */
export default function CasePicker({ value, onChange, label = 'الدعوى (اختياري — لملء البيانات تلقائياً)' }) {
  const { cases } = useData()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const selected = cases.find((c) => c.id === value)

  const results = useMemo(() => {
    const terms = fold(q).split(/\s+/).filter(Boolean)
    if (!terms.length) return []
    return cases
      .filter((c) => {
        const hay = fold(`${c.case_number} ${c.case_year} ${c.case_number}/${c.case_year} ${c.court} ${c.plaintiff} ${c.defendant}`)
        return terms.every((t) => hay.includes(t))
      })
      .slice(0, 8)
  }, [cases, q])

  return (
    <div className="field case-picker">
      <label>{label}</label>
      {selected ? (
        <div className="picked">
          <span><strong>{caseTitle(selected)}</strong> — {selected.court}{selected.plaintiff ? ` — ${selected.plaintiff}` : ''}</span>
          <button type="button" className="link" onClick={() => onChange(null)}>تغيير</button>
        </div>
      ) : (
        <div className="picker-wrap">
          <input
            type="search"
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="رقم/سنة أو اسم خصم أو محكمة…"
          />
          {open && results.length > 0 && (
            <ul className="picker-list" role="listbox">
              {results.map((c) => (
                <li key={c.id}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(c.id); setQ(''); setOpen(false) }}>
                    <strong>{caseTitle(c)}</strong> <span className="muted small">{c.court} — {c.plaintiff}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
