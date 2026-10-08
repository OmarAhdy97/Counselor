import { useMemo, useState } from 'react'
import { BellRing, Check, CalendarPlus } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useUI } from '../context/UIContext'
import { useToast } from '../context/ToastContext'
import { friendlyError } from '../lib/errors'
import { Empty, PageHead, Segmented, DateCell, StatusBadge } from '../components/ui'
import { caseTitle } from '../lib/constants'
import { addDays, today, fmt } from '../lib/dates'

function FollowupItem({ c }) {
  const { updateCase } = useData()
  const { openCase } = useUI()
  const toast = useToast()
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)

  const save = async (fields, msg) => {
    setBusy(true)
    try {
      await updateCase(c.id, fields)
      toast(msg)
    } catch (err) {
      toast(friendlyError(err), 'error')
    } finally {
      setBusy(false)
      setPicking(false)
    }
  }

  return (
    <li className="fu-item">
      <button type="button" className="fu-main" onClick={() => openCase(c.id)}>
        <div className="fu-top">
          <strong>{caseTitle(c)}</strong>
          <span className="muted small">{c.court}</span>
          <StatusBadge status={c.status} />
        </div>
        <p className="fu-note">{c.notes || <span className="muted">بدون ملاحظة — افتح الدعوى لكتابة المطلوب</span>}</p>
        <span className="muted small">{c.plaintiff}{c.defendant ? ` ضد ${c.defendant}` : ''}</span>
      </button>
      <div className="fu-side">
        <DateCell value={c.followup_date} />
        {picking ? (
          <input
            type="date"
            autoFocus
            min={today()}
            onChange={(e) => e.target.value && save({ followup_date: e.target.value }, `تم ترحيل المتابعة إلى ${fmt(e.target.value)}`)}
            onBlur={() => setPicking(false)}
            aria-label="تاريخ المتابعة الجديد"
          />
        ) : (
          <div className="fu-actions">
            <button type="button" className="btn btn-soft btn-sm" disabled={busy} onClick={() => save({ followup_date: null }, 'تمت المتابعة')}>
              <Check size={14} /> تمت
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setPicking(true)}>
              <CalendarPlus size={14} /> ترحيل
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

export default function FollowupsPage() {
  const { cases } = useData()
  const t = today()
  const [tab, setTab] = useState('due')

  const groups = useMemo(() => {
    const live = cases.filter((c) => !c.archived_at)
    const withDate = live
      .filter((c) => c.followup_date)
      .sort((a, b) => (a.followup_date < b.followup_date ? -1 : 1))
    return {
      due: withDate.filter((c) => c.followup_date <= t),
      week: withDate.filter((c) => c.followup_date > t && c.followup_date <= addDays(t, 7)),
      later: withDate.filter((c) => c.followup_date > addDays(t, 7)),
      undated: live.filter((c) => !c.followup_date && c.notes),
    }
  }, [cases, t])

  const list = groups[tab]

  return (
    <div className="page">
      <PageHead title="المتابعات" subtitle="ما يجب عمله في كل ملف: شهادات، خطابات للجهات، مذكرات…" />
      <div className="toolbar">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'due', label: 'مستحقة ومتأخرة', count: groups.due.length },
            { value: 'week', label: 'خلال أسبوع', count: groups.week.length },
            { value: 'later', label: 'لاحقاً', count: groups.later.length },
            { value: 'undated', label: 'ملاحظات بلا تاريخ', count: groups.undated.length },
          ]}
        />
      </div>
      <div className="card">
        {list.length === 0 ? (
          <Empty icon={BellRing} title="لا شيء هنا" text={tab === 'due' ? 'لا توجد متابعات مستحقة اليوم.' : null} />
        ) : (
          <ul className="fu-list">
            {list.map((c) => <FollowupItem key={c.id} c={c} />)}
          </ul>
        )}
      </div>
    </div>
  )
}
