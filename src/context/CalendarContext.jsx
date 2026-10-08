import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { useData } from './DataContext'
import { useToast } from './ToastContext'
import { today } from '../lib/dates'
import {
  GOOGLE_CLIENT_ID, desiredEvents, ensureCalendar, eventTemplateUrl, eventUrl, forgetToken, getToken, googleDayUrl, hasLiveToken, primaryKind, syncCalendar,
} from '../lib/googleCalendar'

const CalendarContext = createContext(null)

/**
 * Keeps the counselor's Google Calendar in step with their cases. Once connected, any change to
 * the cases syncs a few seconds later while a Google token is live (it lasts about an hour);
 * after that the sidebar shows a one-click "sync" that renews it.
 */
export function CalendarProvider({ children }) {
  const { user, profile, updateProfile } = useAuth()
  const { cases, loading } = useData()
  const toast = useToast()
  const [state, setState] = useState({ status: 'idle', lastSync: null, error: null, changed: 0 })
  const running = useRef(false)
  const enabled = !!profile?.calendar_sync

  const run = useCallback(
    async ({ interactive }) => {
      if (running.current) return false
      running.current = true
      setState((s) => ({ ...s, status: 'syncing', error: null }))
      try {
        const tok = await getToken({ interactive, hint: user?.email })
        if (!tok) {
          setState((s) => ({ ...s, status: 'needs-auth' }))
          return false
        }
        const calId = await ensureCalendar(profile?.google_calendar_id)
        if (calId !== profile?.google_calendar_id || !profile?.calendar_sync) {
          await updateProfile({ google_calendar_id: calId, calendar_sync: true })
        }
        const r = await syncCalendar(calId, cases.filter((c) => !c.archived_at), profile?.reminder_minutes ?? 360)
        setState({ status: 'ok', lastSync: new Date(), error: null, changed: r.changed, total: r.total })
        return calId
      } catch (err) {
        setState((s) => ({ ...s, status: 'error', error: err.message }))
        return false
      } finally {
        running.current = false
      }
    },
    [cases, profile, updateProfile, user]
  )

  // Auto-sync after changes (debounced), only when a token is already live.
  useEffect(() => {
    if (!enabled || loading) return
    if (!hasLiveToken()) {
      setState((s) => (s.status === 'idle' ? { ...s, status: 'needs-auth' } : s))
      return
    }
    const t = setTimeout(() => run({ interactive: false }), 4000)
    return () => clearTimeout(t)
  }, [cases, enabled, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const value = {
    available: !!GOOGLE_CLIENT_ID,
    enabled,
    ...state,
    syncNow: () => run({ interactive: true }),
    /**
     * Sync, then open Google Calendar on the exact event of a case (`{ c }`), or on a day (`{ date }`)
     * when it holds several. The tab is opened first so the popup blocker lets it through.
     */
    openInGoogle: async ({ c, date, kind: wanted }) => {
      const tab = window.open('', '_blank')
      const go = (url) => (tab ? (tab.location.href = url) : (window.location.href = url))
      const kind = c && (wanted || primaryKind(c))
      const fallback = () => {
        if (c && kind) {
          const ev = [...desiredEvents([c], profile?.reminder_minutes ?? 360).entries()].find(([id]) => id.startsWith(kind))?.[1]
          if (ev) return eventTemplateUrl(ev)
        }
        return googleDayUrl(date || c?.next_session || today(), user?.email)
      }
      if (!GOOGLE_CLIENT_ID) return go(fallback())
      const ok = await run({ interactive: true })
      const calId = (typeof ok === 'string' && ok) || profile?.google_calendar_id
      if (ok && c && kind && calId) {
        toast('تمت المزامنة، جارٍ فتح الموعد في تقويم جوجل')
        return go(eventUrl(kind, c.id, calId, user?.email))
      }
      toast(ok ? 'تمت المزامنة، جارٍ فتح اليوم في تقويم جوجل' : 'لم تكتمل المزامنة، سيُفتح نموذج إضافة الموعد بالبيانات', ok ? undefined : 'error')
      return go(ok ? googleDayUrl(date || c?.next_session || today(), user?.email) : fallback())
    },
    /** Syncs right away only if the Google token is still live (no popup). */
    syncQuiet: () => (enabled && hasLiveToken() ? run({ interactive: false }) : Promise.resolve(false)),
    disconnect: async () => {
      forgetToken()
      await updateProfile({ calendar_sync: false })
      setState({ status: 'idle', lastSync: null, error: null, changed: 0 })
    },
  }

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>
}

export const useCalendar = () => useContext(CalendarContext)
