import { useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { PageHead, Field } from '../components/ui'
import { fmt, today, toISO } from '../lib/dates'

const PRESETS = [
  { value: 'month', label: 'هذا الشهر' },
  { value: 'last', label: 'الشهر الماضي' },
  { value: 'year', label: 'هذا العام' },
  { value: 'custom', label: 'فترة أخرى' },
]

function presetRange(p) {
  const d = new Date()
  if (p === 'month') return [toISO(new Date(d.getFullYear(), d.getMonth(), 1)), today()]
  if (p === 'last') return [toISO(new Date(d.getFullYear(), d.getMonth() - 1, 1)), toISO(new Date(d.getFullYear(), d.getMonth(), 0))]
  if (p === 'year') return [toISO(new Date(d.getFullYear(), 0, 1)), today()]
  return null
}

const inRange = (iso, from, to) => !!iso && iso.slice(0, 10) >= from && iso.slice(0, 10) <= to

/** Period statistics for the counselor's monthly report: sessions, rulings, memos, new and closed files. */
export default function StatsPage() {
  const { cases, sessions, attachments } = useData()
  const { displayName, profile } = useAuth()
  const [preset, setPreset] = useState('month')
  const [range, setRange] = useState(() => presetRange('month'))
  const [from, to] = range

  const choose = (p) => {
    setPreset(p)
    if (p !== 'custom') setRange(presetRange(p))
  }

  const s = useMemo(() => {
    const byId = new Map(cases.map((c) => [c.id, c]))
    const held = sessions.filter((x) => inRange(x.session_date, from, to))
    const rulings = cases.filter((c) => inRange(c.ruling_date, from, to))
    const count = (list, f) => list.filter(f).length
    const courts = new Map()
    const bump = (court, k) => {
      if (!courts.has(court)) courts.set(court, { sessions: 0, rulings: 0, for: 0, against: 0 })
      courts.get(court)[k]++
    }
    for (const x of held) bump(byId.get(x.case_id)?.court || '—', 'sessions')
    for (const c of rulings) {
      bump(c.court, 'rulings')
      if (c.ruling_outcome === 'صالح') bump(c.court, 'for')
      if (c.ruling_outcome === 'ضد') bump(c.court, 'against')
    }
    const memoFiles = (attachments || []).filter((a) => inRange(a.created_at, from, to))
    const forN = count(rulings, (c) => c.ruling_outcome === 'صالح')
    const againstN = count(rulings, (c) => c.ruling_outcome === 'ضد')
    return {
      sessions: held.length,
      sessionCases: new Set(held.map((x) => x.case_id)).size,
      adjourned: count(held, (x) => x.next_date && !/حجز|شطب|حكم/.test(x.decision || '')),
      reserved: count(held, (x) => /حجز للحكم|محجوز للحكم/.test(x.decision || '')),
      report: count(held, (x) => /تقرير/.test(x.decision || '')),
      struck: count(held, (x) => (x.decision || '').trim() === 'شطب'),
      rulings: rulings.length,
      forN,
      againstN,
      rate: forN + againstN ? Math.round((forN / (forN + againstN)) * 100) : null,
      appealed: count(rulings, (c) => c.appeal_decision === 'طعن'),
      noAppeal: count(rulings, (c) => c.appeal_decision === 'عدم طعن'),
      added: count(cases, (c) => inRange(c.created_at, from, to)),
      archived: count(cases, (c) => inRange(c.archived_at, from, to)),
      memos: count(memoFiles, (a) => a.kind === 'مذكرة دفاع'),
      opinions: count(memoFiles, (a) => a.kind === 'رأي'),
      files: memoFiles.length,
      unfiled: count(cases, (c) => !c.archived_at && c.status === 'تحت الرفع'),
      atReport: count(cases, (c) => !c.archived_at && c.status === 'محجوز للتقرير'),
      active: count(cases, (c) => !c.archived_at),
      courts: [...courts.entries()].sort((a, b) => b[1].sessions - a[1].sessions),
    }
  }, [cases, sessions, attachments, from, to])

  const tiles = [
    ['الجلسات المنعقدة', s.sessions, `في ${s.sessionCases} دعوى`],
    ['التأجيلات', s.adjourned],
    ['حجز للحكم', s.reserved],
    ['حجز للتقرير', s.report],
    ['الشطب', s.struck],
    ['الأحكام الصادرة', s.rulings, s.rate !== null ? `${s.forN} صالح / ${s.againstN} ضد — ${s.rate}% صالح` : null],
    ['قرارات الطعن', s.appealed + s.noAppeal, `طعن ${s.appealed} — عدم طعن ${s.noAppeal}`],
    ['مذكرات الدفاع المرفوعة', s.memos, `و${s.opinions} رأي — ${s.files} مرفق إجمالاً`],
    ['ملفات جديدة', s.added],
    ['ملفات حُفظت', s.archived],
  ]

  return (
    <div className="page">
      <PageHead
        title="الإحصائيات"
        subtitle={`من ${fmt(from)} إلى ${fmt(to)}`}
        actions={<button type="button" className="btn btn-soft" onClick={() => window.print()}><Printer size={16} /> طباعة</button>}
      />

      <div className="toolbar no-print">
        <div className="seg" role="tablist">
          {PRESETS.map((p) => (
            <button key={p.value} type="button" role="tab" aria-selected={preset === p.value} className={preset === p.value ? 'active' : ''} onClick={() => choose(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="range">
            <Field label="من">{(id) => <input id={id} type="date" value={from} max={to} onChange={(e) => e.target.value && setRange([e.target.value, to])} />}</Field>
            <Field label="إلى">{(id) => <input id={id} type="date" value={to} min={from} onChange={(e) => e.target.value && setRange([from, e.target.value])} />}</Field>
          </div>
        )}
      </div>

      <header className="print-only">
        <h1 className="print-title">إحصائية الأعمال من {fmt(from)} إلى {fmt(to)}</h1>
        <p>{displayName}{profile?.branch ? ` — ${profile.branch}` : ''}</p>
      </header>

      <div className="stat-grid">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="stat">
            <span className="stat-value">{value}</span>
            <span className="stat-label">{label}</span>
            {sub && <span className="muted small">{sub}</span>}
          </div>
        ))}
      </div>

      <div className="two-col">
        <section className="card">
          <div className="card-head"><h2>حسب المحكمة</h2></div>
          {s.courts.length === 0 ? (
            <p className="muted small pad-x" style={{ paddingBottom: '1rem' }}>لا توجد جلسات أو أحكام في هذه الفترة.</p>
          ) : (
            <div className="table-wrap">
              <table className="cases plain stats-table">
                <thead><tr><th>المحكمة</th><th>جلسات</th><th>أحكام</th><th>صالح</th><th>ضد</th></tr></thead>
                <tbody>
                  {s.courts.map(([court, v]) => (
                    <tr key={court}><td>{court}</td><td>{v.sessions}</td><td>{v.rulings}</td><td>{v.for}</td><td>{v.against}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="card pad">
          <h2 className="card-title">الموقف الحالي</h2>
          <ul className="stats-list col">
            <li><strong>{s.active}</strong> ملف تحت يدك (غير محفوظ)</li>
            <li><strong>{s.atReport}</strong> دعوى بالشعبة محجوزة للتقرير</li>
            <li><strong>{s.unfiled}</strong> ملف تحت الرفع</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
