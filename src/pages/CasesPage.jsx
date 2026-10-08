import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, FolderOpen, Download, X } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useUI } from '../context/UIContext'
import CaseTable from '../components/CaseTable'
import { Empty, PageHead, Segmented } from '../components/ui'
import BulkBar from '../components/BulkActions'
import { OUTCOMES } from '../lib/constants'
import { exportAgendaWorkbook } from '../lib/excel'
import { today } from '../lib/dates'
import Select from '../components/Select'

const SORTS = {
  next: { label: 'الجلسة القادمة', fn: (a, b) => (a.next_session || '9999') < (b.next_session || '9999') ? -1 : 1 },
  recent: { label: 'آخر تعديل', fn: (a, b) => (a.updated_at < b.updated_at ? 1 : -1) },
  number: { label: 'السنة والرقم', fn: (a, b) => b.case_year - a.case_year || Number(a.case_number) - Number(b.case_number) },
  court: { label: 'المحكمة', fn: (a, b) => a.court.localeCompare(b.court, 'ar') },
}

// Arabic-insensitive search: ignores hamza forms, ى/ي, ة/ه and diacritics.
const TABS = {
  active: { label: 'المتداولة', test: (c) => !c.archived_at && !['محجوز للتقرير', 'تحت الرفع', 'شطب'].includes(c.status) },
  report: { label: 'الشعبة (للتقرير)', test: (c) => !c.archived_at && c.status === 'محجوز للتقرير' },
  unfiled: { label: 'تحت الرفع', test: (c) => !c.archived_at && c.status === 'تحت الرفع' },
  struck: { label: 'المشطوبة', test: (c) => !c.archived_at && c.status === 'شطب' },
  archive: { label: 'الأرشيف', test: (c) => !!c.archived_at },
}

const fold = (s) =>
  String(s ?? '')
    .replace(/[ً-ْ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()

export default function CasesPage() {
  const { cases, lists, lastSessionByCase } = useData()
  const { newCase, query, setQuery } = useUI()
  const [court, setCourt] = useState('')
  const [status, setStatus] = useState('')
  const [year, setYear] = useState('')
  const [outcome, setOutcome] = useState('')
  const [sort, setSort] = useState('next')
  const [limit, setLimit] = useState(100)
  const [tab, setTab] = useState('active')
  const [selected, setSelected] = useState(() => new Set())

  useEffect(() => setLimit(100), [query, court, status, year, outcome, tab])
  useEffect(() => setSelected(new Set()), [tab])

  const onSelect = (ids, on) =>
    setSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)))
      return next
    })

  const matched = useMemo(() => {
    // "152/2024" or "152 لسنة 2024" searches number + year precisely.
    const m = query.match(/^\s*(\d+)\s*(?:\/|لسنة|لسنه|\s)\s*(\d{4})\s*$/)
    const terms = fold(query).split(/\s+/).filter(Boolean)
    return cases
      .filter((c) => {
        if (court && c.court !== court) return false
        if (status && (c.status || '') !== (status === '—' ? '' : status)) return false
        if (year && String(c.case_year) !== year) return false
        if (outcome && c.ruling_outcome !== outcome) return false
        if (m) return c.case_number === m[1] && String(c.case_year) === m[2]
        if (!terms.length) return true
        const hay = fold(
          [c.case_number, c.case_year, c.court, c.plaintiff, c.defendant, c.case_type, c.notes, c.memos, c.copy_numbers, c.last_decision].join(' ')
        )
        return terms.every((t) => hay.includes(t))
      })
      .sort(SORTS[sort].fn)
  }, [cases, query, court, status, year, outcome, sort])

  const tabCounts = useMemo(() => {
    const out = {}
    for (const [k, t] of Object.entries(TABS)) out[k] = matched.filter(t.test).length
    return out
  }, [matched])
  const filtered = useMemo(() => matched.filter(TABS[tab].test), [matched, tab])
  const selectedRows = useMemo(() => cases.filter((c) => selected.has(c.id)), [cases, selected])

  const anyFilter = query || court || status || year || outcome
  const clear = () => {
    setQuery('')
    setCourt('')
    setStatus('')
    setYear('')
    setOutcome('')
  }

  return (
    <div className="page">
      <PageHead
        title="القضايا"
        subtitle={`${filtered.length} دعوى في «${TABS[tab].label}»${anyFilter ? ' مطابقة للبحث' : ''}`}
        actions={
          <>
            <button
              type="button"
              className="btn btn-soft"
              disabled={!filtered.length}
              onClick={() => exportAgendaWorkbook(filtered, lastSessionByCase, `القضايا ${today()}.xlsx`)}
            >
              <Download size={16} /> تصدير المعروض
            </button>
            {tab === 'unfiled' ? (
              <button type="button" className="btn btn-primary" onClick={() => newCase({ status: 'تحت الرفع', case_year: '' })}>
                <Plus size={16} /> ملف تحت الرفع
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => newCase()}>
                <Plus size={16} /> دعوى جديدة
              </button>
            )}
          </>
        }
      />

      <div className="toolbar">
        <Segmented
          value={tab}
          onChange={setTab}
          options={Object.entries(TABS).map(([value, t]) => ({ value, label: t.label, count: tabCounts[value] }))}
        />
      </div>

      <div className="filters">
        <label className="search">
          <Search size={16} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث برقم الدعوى (152/2024)، اسم خصم، محكمة، ملاحظة…"
          />
        </label>
        <Select value={court} onChange={(e) => setCourt(e.target.value)} aria-label="المحكمة">
          <option value="">كل المحاكم</option>
          {lists.courts.map((x) => <option key={x}>{x}</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="الحالة">
          <option value="">كل الحالات</option>
          {lists.statuses.map((x) => <option key={x}>{x}</option>)}
          <option value="—">بدون حالة</option>
        </Select>
        <Select value={year} onChange={(e) => setYear(e.target.value)} aria-label="السنة">
          <option value="">كل السنوات</option>
          {lists.years.map((x) => <option key={x}>{x}</option>)}
        </Select>
        <Select value={outcome} onChange={(e) => setOutcome(e.target.value)} aria-label="الحكم">
          <option value="">كل الأحكام</option>
          {OUTCOMES.map((x) => <option key={x}>{x}</option>)}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="الترتيب">
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>ترتيب: {v.label}</option>)}
        </Select>
        {anyFilter && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>
            <X size={14} /> مسح
          </button>
        )}
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <Empty
            icon={FolderOpen}
            title={cases.length ? (anyFilter ? 'لا توجد نتائج' : 'لا توجد قضايا هنا') : 'لا توجد قضايا بعد'}
            text={
              !cases.length ? 'ابدأ بقيد دعوى، أو استورد شيت الإكسيل من صفحة «الإكسيل».'
                : anyFilter ? 'غيّر كلمات البحث أو امسح الفلاتر، أو جرّب تبويباً آخر.'
                : tab === 'report' ? 'القضايا التي تُحجز للتقرير (ندب خبير) تظهر هنا حتى يرد التقرير.'
                : tab === 'unfiled' ? 'الملفات التي لم تُقيَّد بعد. أضف ملفاً وسجّل رقمه بعد القيد.'
                : null
            }
          />
        ) : (
          <>
            <CaseTable
              rows={filtered.slice(0, limit)}
              columns={tab === 'archive' ? ['court', 'parties', 'status', 'outcome', 'notes'] : ['court', 'parties', 'next', 'decision', 'status', 'outcome']}
              selected={selected}
              onSelect={onSelect}
              showRecord={tab !== 'archive'}
            />
            {filtered.length > limit && (
              <div className="more-row">
                <button type="button" className="btn btn-ghost" onClick={() => setLimit((l) => l + 200)}>
                  عرض المزيد ({filtered.length - limit} متبقية)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <BulkBar rows={selectedRows} onClear={() => setSelected(new Set())} />
    </div>
  )
}
