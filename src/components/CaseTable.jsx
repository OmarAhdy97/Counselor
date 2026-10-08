import { Gavel } from 'lucide-react'
import { StatusChip, OutcomeBadge, DateCell, Badge } from './ui'
import { useUI } from '../context/UIContext'
import { useData } from '../context/DataContext'
import { caseTitle } from '../lib/constants'
import { fmt } from '../lib/dates'

/**
 * Shared case list, drawn as cards (one row per case) like the Aldiwan cases page: number and type,
 * status chip, court, parties, then the facts the page asked for. Cards fold to a single column on
 * phones. A plain table is rendered too but only shown when printing (the court roll sheet).
 *
 * columns: court, parties, type, next, decision, held, status, outcome, ruling, deadline, appeal, followup, notes
 */
export default function CaseTable({ rows, columns, showRecord = true, numbered = false, selected, onSelect, sessionOf }) {
  const { openCase, recordSession } = useUI()
  const { circuitsById } = useData()
  const has = (k) => columns.includes(k)
  const selectable = !!onSelect
  const allOn = selectable && rows.length > 0 && rows.every((c) => selected.has(c.id))
  const toggleAll = () => onSelect(rows.map((c) => c.id), !allOn)

  const facts = (c) => {
    const held = sessionOf?.(c)
    return [
      has('next') && ['الجلسة القادمة', <DateCell value={c.next_session} />],
      has('decision') && ['آخر قرار', c.last_decision || '—'],
      has('held') && ['القرار', <>{held?.decision || <span className="muted">لم يُسجَّل</span>}{held?.next_date && <span className="muted"> ← {fmt(held.next_date)}</span>}</>],
      has('ruling') && ['تاريخ الحكم', <DateCell value={c.ruling_date} overdueTone={false} />],
      has('deadline') && ['ميعاد الطعن', <DateCell value={c.appeal_deadline} />],
      has('appeal') && ['قرار الطعن', c.appeal_decision ? <Badge tone={c.appeal_decision === 'طعن' ? 'violet' : 'slate'}>{c.appeal_decision}</Badge> : '—'],
      has('followup') && ['المتابعة', <DateCell value={c.followup_date} />],
    ].filter(Boolean)
  }

  return (
    <div className="case-list">
      {selectable && rows.length > 0 && (
        <label className="row-list-head no-print">
          <input type="checkbox" checked={allOn} onChange={toggleAll} />
          <span>تحديد الكل ({rows.length})</span>
        </label>
      )}

      <div className="row-list screen-only">
        {rows.map((c, i) => {
          const f = facts(c)
          const circuit = circuitsById.get(c.circuit_id)
          return (
            <article key={c.id} className={`list-row ${selectable && selected.has(c.id) ? 'is-selected' : ''}`}>
              <div className="list-row-main">
                {(selectable || numbered) && (
                  <div className="row-lead">
                    {selectable && (
                      <input
                        type="checkbox"
                        className="row-check"
                        checked={selected.has(c.id)}
                        onChange={(e) => onSelect([c.id], e.target.checked)}
                        aria-label={`تحديد ${caseTitle(c)}`}
                      />
                    )}
                    {numbered && <span className="roll-no">{i + 1}</span>}
                  </div>
                )}

                <div
                  className="list-row-body is-clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => openCase(c.id)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openCase(c.id))}
                >
                  <div className="list-row-top">
                    <span className="row-title row-title-link">
                      <span className="row-key">{caseTitle(c)}</span>
                      <span className="row-title-text" title={c.case_type || ''}>{c.case_type || 'دعوى'}</span>
                    </span>
                    {has('status') && <StatusChip status={c.status} />}
                    {has('outcome') && <OutcomeBadge outcome={c.ruling_outcome} status={c.status} />}
                  </div>
                  <p className="list-row-sub">{[c.court, circuit?.name].filter(Boolean).join(' · ')}</p>
                  {has('parties') && (
                    <p className="row-parties">
                      <span className="row-party"><small>المدعي</small>{c.plaintiff || '—'}</span>
                      {c.defendant && (<><span className="row-vs">ضد</span><span className="row-party"><small>المدعى عليه</small>{c.defendant}</span></>)}
                    </p>
                  )}
                  {has('notes') && c.notes && <p className="list-row-text">{c.notes}</p>}
                </div>

                {f.length > 0 && (
                  <dl className="list-row-facts">
                    {f.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
                  </dl>
                )}

                {showRecord && (
                  <div className="list-row-actions no-print">
                    <button type="button" className="btn btn-soft btn-sm" onClick={() => recordSession(c)}>
                      <Gavel size={14} /> قرار الجلسة
                    </button>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>

      <table className="cases print-table">
        <thead>
          <tr>
            {numbered && <th className="num-col">م</th>}
            <th>الدعوى</th>
            <th>المحكمة</th>
            {has('parties') && <th>الخصوم</th>}
            <th>نوع الدعوى</th>
            {has('decision') && <th>آخر قرار</th>}
            {has('held') && <th>القرار في هذه الجلسة</th>}
            {has('next') && <th>الجلسة القادمة</th>}
            {has('status') && <th>الحالة</th>}
            {has('notes') && <th>المطلوب</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={c.id}>
              {numbered && <td className="num-col">{i + 1}</td>}
              <td><strong>{caseTitle(c)}</strong></td>
              <td>{c.court}{c.circuit_id ? ` — ${circuitsById.get(c.circuit_id)?.name || ''}` : ''}</td>
              {has('parties') && <td>{c.plaintiff || '—'}{c.defendant ? ` ضد ${c.defendant}` : ''}</td>}
              <td>{c.case_type || '—'}</td>
              {has('decision') && <td>{c.last_decision || '—'}</td>}
              {has('held') && <td>{sessionOf?.(c)?.decision || '—'}{sessionOf?.(c)?.next_date ? ` ← ${fmt(sessionOf(c).next_date)}` : ''}</td>}
              {has('next') && <td>{c.next_session ? fmt(c.next_session) : '—'}</td>}
              {has('status') && <td>{c.status || '—'}</td>}
              {has('notes') && <td>{c.notes || '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
