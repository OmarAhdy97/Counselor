import { useMemo, useState } from 'react'
import { Scale } from 'lucide-react'
import { useData } from '../context/DataContext'
import CaseTable from '../components/CaseTable'
import { Empty, PageHead, Segmented } from '../components/ui'
import { today } from '../lib/dates'

export default function RulingsPage() {
  const { cases } = useData()
  const [tab, setTab] = useState('all')
  const t = today()

  const ruled = useMemo(
    () =>
      cases
        .filter((c) => c.ruling_outcome || c.ruling_text || c.ruling_date)
        .sort((a, b) => ((a.ruling_date || '') < (b.ruling_date || '') ? 1 : -1)),
    [cases]
  )

  const tabs = {
    all: ruled,
    for: ruled.filter((c) => c.ruling_outcome === 'صالح'),
    against: ruled.filter((c) => c.ruling_outcome === 'ضد'),
    open: ruled.filter((c) => c.appeal_deadline && c.appeal_deadline >= t).sort((a, b) => (a.appeal_deadline < b.appeal_deadline ? -1 : 1)),
    undecided: ruled.filter((c) => c.ruling_outcome === 'ضد' && !c.appeal_decision),
    other: ruled.filter((c) => c.ruling_outcome !== 'صالح' && c.ruling_outcome !== 'ضد'),
  }
  const rate = tabs.for.length + tabs.against.length
    ? Math.round((tabs.for.length / (tabs.for.length + tabs.against.length)) * 100)
    : null

  return (
    <div className="page">
      <PageHead
        title="الأحكام"
        subtitle={rate !== null ? `${tabs.for.length} صالح و${tabs.against.length} ضد — نسبة الأحكام الصالحة ${rate}%` : null}
      />
      <div className="toolbar">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'all', label: 'الكل', count: tabs.all.length },
            { value: 'for', label: 'صالح', count: tabs.for.length },
            { value: 'against', label: 'ضد', count: tabs.against.length },
            { value: 'open', label: 'ميعاد طعن قائم', count: tabs.open.length },
            { value: 'undecided', label: 'ضد بلا قرار طعن', count: tabs.undecided.length },
            { value: 'other', label: 'أخرى', count: tabs.other.length },
          ]}
        />
      </div>
      <p className="muted small">مواعيد الطعن محسوبة تقديرياً (جنح 10 أيام، مستعجل وتنفيذ وقتي 15 يوماً، غير ذلك 40 يوماً) ويمكن تعديلها من الدعوى.</p>
      <div className="card">
        {tabs[tab].length === 0 ? (
          <Empty icon={Scale} title="لا توجد أحكام هنا" />
        ) : (
          <CaseTable rows={tabs[tab]} columns={['court', 'parties', 'outcome', 'ruling', 'deadline', 'appeal', 'notes']} showRecord={false} />
        )}
      </div>
    </div>
  )
}
