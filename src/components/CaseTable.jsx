import { Gavel } from 'lucide-react'
import { StatusBadge, OutcomeBadge, DateCell, Badge } from './ui'
import { useUI } from '../context/UIContext'
import { caseTitle } from '../lib/constants'
import { fmt } from '../lib/dates'
import { useData } from '../context/DataContext'

/**
 * Shared case list. Columns are picked per page; on phones every row folds into a card.
 * Available columns: court, parties, type, next, decision, status, outcome, followup, notes, ruling, deadline
 */
export default function CaseTable({ rows, columns, showRecord = true, numbered = false, selected, onSelect, sessionOf }) {
  const { openCase, recordSession } = useUI()
  const { circuitsById } = useData()
  const has = (k) => columns.includes(k)
  const selectable = !!onSelect
  const allOn = selectable && rows.length > 0 && rows.every((c) => selected.has(c.id))
  const toggleAll = () => onSelect(rows.map((c) => c.id), !allOn)

  return (
    <div className="table-wrap">
      <table className="cases">
        <thead>
          <tr>
            {selectable && (
              <th className="sel-col no-print">
                <input type="checkbox" checked={allOn} onChange={toggleAll} aria-label="تحديد الكل" />
              </th>
            )}
            {numbered && <th className="num-col">م</th>}
            <th>الدعوى</th>
            {has('court') && <th>المحكمة</th>}
            {has('parties') && <th>الخصوم</th>}
            {has('type') && <th>نوع الدعوى</th>}
            {has('decision') && <th>آخر قرار</th>}
            {has('held') && <th>القرار في هذه الجلسة</th>}
            {has('next') && <th>الجلسة القادمة</th>}
            {has('status') && <th>الحالة</th>}
            {has('outcome') && <th>الحكم</th>}
            {has('ruling') && <th>تاريخ الحكم</th>}
            {has('deadline') && <th>ميعاد الطعن</th>}
            {has('appeal') && <th>قرار الطعن</th>}
            {has('followup') && <th>المتابعة</th>}
            {has('notes') && <th>المطلوب</th>}
            {showRecord && <th className="no-print" aria-label="إجراء" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr
              key={c.id}
              className={selectable && selected.has(c.id) ? 'is-selected' : ''}
              onClick={() => openCase(c.id)}
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && openCase(c.id)}
            >
              {selectable && (
                <td className="sel-col no-print" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={(e) => onSelect([c.id], e.target.checked)} aria-label="تحديد" />
                </td>
              )}
              {numbered && <td className="num-col muted">{i + 1}</td>}
              <td className="case-cell" data-label="الدعوى">
                <strong>{caseTitle(c)}</strong>
                {!has('court') && <span className="muted small">{c.court}</span>}
              </td>
              {has('court') && (
                <td data-label="المحكمة">
                  {c.court}
                  {c.circuit_id && <span className="muted small block">{circuitsById.get(c.circuit_id)?.name}</span>}
                </td>
              )}
              {has('parties') && (
                <td data-label="الخصوم" className="parties">
                  <span>{c.plaintiff || '—'}</span>
                  {c.defendant && <span className="muted small">ضد {c.defendant}</span>}
                </td>
              )}
              {has('type') && <td data-label="النوع" className="small">{c.case_type || '—'}</td>}
              {has('decision') && <td data-label="آخر قرار" className="small clamp">{c.last_decision || '—'}</td>}
              {has('held') && (
                <td data-label="القرار" className="small clamp">
                  {sessionOf?.(c)?.decision || <span className="muted">لم يُسجَّل</span>}
                  {sessionOf?.(c)?.next_date && <span className="muted"> ← {fmt(sessionOf(c).next_date)}</span>}
                </td>
              )}
              {has('next') && <td data-label="الجلسة"><DateCell value={c.next_session} /></td>}
              {has('status') && <td data-label="الحالة"><StatusBadge status={c.status} /></td>}
              {has('outcome') && <td data-label="الحكم"><OutcomeBadge outcome={c.ruling_outcome} />{!c.ruling_outcome && <span className="muted">—</span>}</td>}
              {has('ruling') && <td data-label="تاريخ الحكم"><DateCell value={c.ruling_date} overdueTone={false} /></td>}
              {has('deadline') && <td data-label="ميعاد الطعن"><DateCell value={c.appeal_deadline} /></td>}
              {has('appeal') && (
                <td data-label="قرار الطعن">
                  {c.appeal_decision ? <Badge tone={c.appeal_decision === 'طعن' ? 'violet' : 'slate'}>{c.appeal_decision}</Badge> : <span className="muted">—</span>}
                </td>
              )}
              {has('followup') && <td data-label="المتابعة"><DateCell value={c.followup_date} /></td>}
              {has('notes') && <td data-label="المطلوب" className="small clamp">{c.notes || '—'}</td>}
              {showRecord && (
                <td className="no-print action-cell">
                  <button
                    type="button"
                    className="btn btn-soft btn-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      recordSession(c)
                    }}
                  >
                    <Gavel size={14} /> قرار
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
