import { useMemo } from 'react'
import { CalendarCheck, AlertTriangle, BellRing, Hourglass, Sun } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import CaseTable from '../components/CaseTable'
import { Empty } from '../components/ui'
import { OPEN_STATUSES } from '../lib/constants'
import { addDays, fmtLong, today } from '../lib/dates'

function Section({ title, count, action, children }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>{title} {count !== undefined && <span className="count">{count}</span>}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function TodayPage() {
  const { cases: all } = useData()
  const cases = useMemo(() => all.filter((c) => !c.archived_at), [all])
  const { displayName } = useAuth()
  const { navigate } = useUI()
  const t = today()
  const in7 = addDays(t, 7)
  const in15 = addDays(t, 15)

  const d = useMemo(() => {
    const byDate = (k) => (a, b) => (a[k] < b[k] ? -1 : 1)
    return {
      todays: cases.filter((c) => c.next_session === t).sort((a, b) => a.court.localeCompare(b.court, 'ar')),
      week: cases.filter((c) => c.next_session > t && c.next_session <= in7),
      missing: cases
        .filter((c) => c.next_session && c.next_session < t && OPEN_STATUSES.has(c.status || ''))
        .sort(byDate('next_session')),
      followups: cases.filter((c) => c.followup_date && c.followup_date <= t).sort(byDate('followup_date')),
      deadlines: cases
        .filter((c) => c.appeal_deadline && c.appeal_deadline >= t && c.appeal_deadline <= in15)
        .sort(byDate('appeal_deadline')),
    }
  }, [cases, t, in7, in15])

  const tiles = [
    { icon: Sun, label: 'جلسات اليوم', value: d.todays.length, go: 'roll' },
    { icon: CalendarCheck, label: 'جلسات الأيام السبعة القادمة', value: d.week.length, go: 'roll' },
    { icon: AlertTriangle, label: 'جلسات فاتت بلا قرار', value: d.missing.length, tone: d.missing.length ? 'warn' : '' },
    { icon: BellRing, label: 'متابعات مستحقة', value: d.followups.length, go: 'followups', tone: d.followups.length ? 'warn' : '' },
  ]

  return (
    <div className="page">
      <div className="hello">
        <p className="muted">{fmtLong(t)}</p>
        <h1>صباح الخير، {displayName}</h1>
      </div>

      <div className="tiles">
        {tiles.map((x) => (
          <button
            key={x.label}
            type="button"
            className={`tile ${x.tone ? `tile-${x.tone}` : ''}`}
            onClick={() => (x.go ? navigate(x.go) : document.getElementById('missing')?.scrollIntoView({ behavior: 'smooth' }))}
          >
            <x.icon size={18} />
            <span className="tile-value">{x.value}</span>
            <span className="tile-label">{x.label}</span>
          </button>
        ))}
      </div>

      <Section title="جلسات اليوم" count={d.todays.length}
        action={<button type="button" className="link" onClick={() => navigate('roll')}>فتح الرول</button>}>
        {d.todays.length ? (
          <CaseTable rows={d.todays} columns={['court', 'parties', 'type', 'decision']} />
        ) : (
          <Empty icon={Sun} title="لا توجد جلسات اليوم" />
        )}
      </Section>

      {d.missing.length > 0 && (
        <div id="missing">
          <Section title="جلسات فاتت ولم يُسجَّل قرارها" count={d.missing.length}>
            <p className="muted small pad-x">سجّل ما تم في كل جلسة لتنتقل الدعوى لجلستها التالية.</p>
            <CaseTable rows={d.missing} columns={['court', 'parties', 'next', 'decision']} />
          </Section>
        </div>
      )}

      <div className="two-col">
        <Section title="متابعات مستحقة" count={d.followups.length}
          action={<button type="button" className="link" onClick={() => navigate('followups')}>كل المتابعات</button>}>
          {d.followups.length ? (
            <CaseTable rows={d.followups.slice(0, 8)} columns={['followup', 'notes']} showRecord={false} />
          ) : (
            <Empty icon={BellRing} title="لا توجد متابعات مستحقة" />
          )}
        </Section>

        <Section title="مواعيد طعن خلال 15 يوماً" count={d.deadlines.length}
          action={<button type="button" className="link" onClick={() => navigate('rulings')}>الأحكام</button>}>
          {d.deadlines.length ? (
            <CaseTable rows={d.deadlines} columns={['outcome', 'deadline']} showRecord={false} />
          ) : (
            <Empty icon={Hourglass} title="لا توجد مواعيد طعن قريبة" />
          )}
        </Section>
      </div>
    </div>
  )
}
