import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Sun, CalendarDays, FolderOpen, BellRing, Scale, FileSpreadsheet, LogOut, Moon, Search, Plus, RefreshCw, Settings, CalendarCheck2, Landmark, BarChart3, Wrench,
} from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider, useData } from './context/DataContext'
import { ToastProvider } from './context/ToastContext'
import { UIContext } from './context/UIContext'
import { CalendarProvider, useCalendar } from './context/CalendarContext'
import LoginPage from './pages/LoginPage'
import TodayPage from './pages/TodayPage'
import RollPage from './pages/RollPage'
import CasesPage from './pages/CasesPage'
import FollowupsPage from './pages/FollowupsPage'
import RulingsPage from './pages/RulingsPage'
import ExcelPage from './pages/ExcelPage'
import SettingsPage from './pages/SettingsPage'
import CircuitsPage from './pages/CircuitsPage'
import ToolsPage from './pages/ToolsPage'
import StatsPage from './pages/StatsPage'
import CaseForm from './components/CaseForm'
import CaseDetail from './components/CaseDetail'
import SessionModal from './components/SessionModal'
import { friendlyError } from './lib/errors'
import { today } from './lib/dates'

const PAGES = [
  { id: 'today', label: 'اليوم', icon: Sun, el: TodayPage },
  { id: 'roll', label: 'رول الجلسات', icon: CalendarDays, el: RollPage },
  { id: 'cases', label: 'القضايا', icon: FolderOpen, el: CasesPage },
  { id: 'followups', label: 'المتابعات', icon: BellRing, el: FollowupsPage },
  { id: 'rulings', label: 'الأحكام', icon: Scale, el: RulingsPage },
  { id: 'tools', label: 'الأدوات', icon: Wrench, el: ToolsPage },
  { id: 'circuits', label: 'الدوائر', icon: Landmark, el: CircuitsPage, hideOnPhone: true },
  { id: 'stats', label: 'الإحصائيات', icon: BarChart3, el: StatsPage, hideOnPhone: true },
  { id: 'excel', label: 'الإكسيل', icon: FileSpreadsheet, el: ExcelPage, hideOnPhone: true },
  { id: 'settings', label: 'الإعدادات', icon: Settings, el: SettingsPage, hideOnPhone: true },
]

const NAV_GROUPS = [
  { label: 'العمل اليومي', ids: ['today', 'roll', 'followups'] },
  { label: 'الملفات', ids: ['cases', 'rulings', 'circuits'] },
  { label: 'أدوات وتقارير', ids: ['tools', 'stats', 'excel', 'settings'] },
]

const pageFromHash = () => {
  const id = window.location.hash.slice(1)
  return PAGES.some((p) => p.id === id) ? id : 'today'
}

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('theme') || 'light'
    } catch {
      return 'light'
    }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('theme', theme)
    } catch { /* private mode */ }
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}

function Shell() {
  const { user, displayName, signOut } = useAuth()
  const { cases, loading, loadError, reload } = useData()
  const [page, setPage] = useState(pageFromHash)
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState(null)
  const [editing, setEditing] = useState(null) // null | { isNew, preset } | case
  const [recording, setRecording] = useState(null)
  const [tool, setTool] = useState({ id: 'deadlines', caseId: null })
  const [theme, toggleTheme] = useTheme()

  useEffect(() => {
    const onHash = () => {
      setPage(pageFromHash())
      setOpenId(null)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = useCallback((id) => {
    window.location.hash = id
    setPage(id)
    setOpenId(null)
    window.scrollTo(0, 0)
  }, [])

  const ui = useMemo(
    () => ({
      navigate,
      query,
      setQuery,
      openCase: setOpenId,
      editCase: setEditing,
      newCase: (preset) => setEditing({ isNew: true, preset }),
      recordSession: setRecording,
      tool,
      setTool,
      openTool: (id, caseId = null) => {
        setTool({ id, caseId })
        navigate('tools')
      },
    }),
    [navigate, query, tool]
  )

  const badges = useMemo(() => {
    const t = today()
    return {
      roll: cases.filter((c) => !c.archived_at && c.next_session === t).length,
      followups: cases.filter((c) => !c.archived_at && c.followup_date && c.followup_date <= t).length,
    }
  }, [cases])

  const Current = PAGES.find((p) => p.id === page).el

  return (
    <UIContext.Provider value={ui}>
      <div className="app">
        <aside className="sidebar no-print">
          <div className="brand">
            <span className="brand-mark"><Scale size={18} /></span>
            <div>
              <strong>أجندة المستشار</strong>
              <small>الجلسات والمتابعات والأحكام</small>
            </div>
          </div>
          <nav className="nav">
            {NAV_GROUPS.map((g) => (
              <div className="nav-group" key={g.label}>
                <div className="nav-group-label">{g.label}</div>
                {PAGES.filter((p) => g.ids.includes(p.id)).map((p) => (
                  <a
                    key={p.id}
                    href={`#${p.id}`}
                    className={page === p.id ? 'active' : ''}
                    aria-current={page === p.id ? 'page' : undefined}
                  >
                    <p.icon size={18} />
                    <span>{p.label}</span>
                    {badges[p.id] > 0 && <span className="nav-badge">{badges[p.id]}</span>}
                  </a>
                ))}
              </div>
            ))}
          </nav>
          <CalendarPill onOpen={() => navigate('settings')} />
          <div className="sidebar-foot">
            <div className="who">
              <strong>{displayName}</strong>
              <span className="muted small" dir="ltr">{user.email}</span>
            </div>
            <div className="foot-actions">
              <button type="button" className="icon-btn" onClick={toggleTheme} aria-label="تبديل الوضع الليلي">
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button type="button" className="icon-btn" onClick={signOut} aria-label="تسجيل الخروج" title="تسجيل الخروج">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </aside>

        <div className="main">
          <header className="topbar no-print">
            <label className={`search topbar-search ${page === 'cases' ? 'is-hidden' : ''}`}>
              <Search size={16} />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  if (page !== 'cases') navigate('cases')
                }}
                placeholder="بحث سريع: رقم/سنة، خصم، محكمة…"
              />
            </label>
            <button type="button" className={`btn btn-primary ${page === 'cases' ? 'is-hidden' : ''}`} onClick={() => setEditing({ isNew: true })}>
              <Plus size={16} /> <span className="hide-sm">دعوى جديدة</span>
            </button>
            <button type="button" className="icon-btn show-sm" onClick={toggleTheme} aria-label="تبديل الوضع الليلي">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <a href="#settings" className="icon-btn show-sm" aria-label="الإعدادات">
              <Settings size={16} />
            </a>
          </header>

          <main className="content">
            {loadError ? (
              <div className="card pad">
                <p className="inline-alert">تعذر تحميل البيانات: {friendlyError(loadError)}</p>
                <button type="button" className="btn btn-soft" onClick={reload}><RefreshCw size={16} /> إعادة المحاولة</button>
              </div>
            ) : loading ? (
              <div className="loading">جارٍ تحميل القضايا…</div>
            ) : (
              <Current />
            )}
          </main>
        </div>

        <nav className="bottom-nav no-print">
          {PAGES.filter((p) => !p.hideOnPhone).map((p) => (
            <a key={p.id} href={`#${p.id}`} className={page === p.id ? 'active' : ''}>
              <p.icon size={20} />
              <span>{p.label}</span>
              {badges[p.id] > 0 && <span className="nav-dot" />}
            </a>
          ))}
        </nav>
      </div>

      {openId && (
        <CaseDetail
          caseId={openId}
          onClose={() => setOpenId(null)}
          onEdit={(c) => setEditing(c)}
          onRecord={(c) => setRecording(c)}
        />
      )}
      <CaseForm
        open={!!editing}
        caseItem={editing?.isNew ? null : editing}
        preset={editing?.preset}
        onClose={() => setEditing(null)}
        onSaved={(c) => editing?.isNew && setOpenId(c.id)}
      />
      <SessionModal open={!!recording} caseItem={recording} onClose={() => setRecording(null)} />
    </UIContext.Provider>
  )
}

/** Sidebar status of the Google Calendar sync; one click renews the Google session when it lapses. */
function CalendarPill({ onOpen }) {
  const cal = useCalendar()
  if (!cal.available) return null
  if (!cal.enabled) {
    return (
      <button type="button" className="cal-pill" onClick={onOpen}>
        <CalendarCheck2 size={16} /> ربط تقويم جوجل
      </button>
    )
  }
  const label = {
    syncing: 'جارٍ المزامنة…',
    ok: 'التقويم متزامن',
    error: 'تعذرت المزامنة — أعد المحاولة',
    'needs-auth': 'مزامنة تقويم جوجل',
    idle: 'مزامنة تقويم جوجل',
  }[cal.status]
  return (
    <button type="button" className={`cal-pill is-${cal.status}`} onClick={cal.syncNow} disabled={cal.status === 'syncing'}>
      <RefreshCw size={16} className={cal.status === 'syncing' ? 'spin' : ''} /> {label}
    </button>
  )
}

function Gate() {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading full">…</div>
  if (!user) return <LoginPage />
  return (
    <DataProvider>
      <CalendarProvider>
        <Shell />
      </CalendarProvider>
    </DataProvider>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ToastProvider>
  )
}
