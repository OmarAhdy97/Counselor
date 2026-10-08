import { caseTitle } from '../lib/constants'
import { fmt, fmtLong, today } from '../lib/dates'

/**
 * The printed court roll (A4 landscape): one table per court/circuit, grouped by day, with an empty
 * «القرار» column to write the decision by hand during the hearing. Past days print what was recorded.
 *
 * days: [{ date, total, groups: [{ label, list: [{ c, held }] }] }]
 */
export default function RollSheet({ days, title, subtitle, author, total }) {
  return (
    <div className="roll-sheet">
      <header className="roll-sheet-head">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <dl>
          <div><dt>عدد الدعاوى</dt><dd>{total}</dd></div>
          {author && <div><dt>المستشار</dt><dd>{author}</dd></div>}
          <div><dt>تاريخ الطباعة</dt><dd>{fmt(today())}</dd></div>
        </dl>
      </header>

      {days.map((d, di) => {
        const past = d.date < today()
        return (
          <section key={d.date} className={`roll-sheet-day ${di > 0 ? 'is-next' : ''}`}>
            {days.length > 1 && <h2 className="roll-sheet-date">{fmtLong(d.date)} <span>({d.total} دعوى)</span></h2>}
            {d.groups.map(({ label, list }) => (
              <div key={label} className="roll-sheet-court">
                <h3>{label} <span>({list.length})</span></h3>
                <table className="roll-table">
                  <thead>
                    <tr>
                      <th className="c-no">م</th>
                      <th className="c-num">رقم الدعوى</th>
                      <th className="c-parties">الخصوم</th>
                      <th className="c-type">نوع الدعوى</th>
                      <th className="c-last">آخر قرار</th>
                      <th className="c-ask">المطلوب / ملاحظات</th>
                      <th className="c-dec">{past ? 'القرار المسجَّل' : 'القرار'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map(({ c, held }, i) => (
                      <tr key={c.id}>
                        <td className="c-no">{i + 1}</td>
                        <td className="c-num"><strong>{caseTitle(c)}</strong></td>
                        <td className="c-parties">
                          {c.plaintiff || '—'}
                          {c.defendant && <><span className="vs"> ضد </span>{c.defendant}</>}
                        </td>
                        <td className="c-type">{c.case_type || '—'}</td>
                        <td className="c-last">{c.last_decision || '—'}</td>
                        <td className="c-ask">{c.notes || ''}</td>
                        <td className="c-dec">
                          {past ? <>{held?.decision || '—'}{held?.next_date ? ` ← ${fmt(held.next_date)}` : ''}</> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
