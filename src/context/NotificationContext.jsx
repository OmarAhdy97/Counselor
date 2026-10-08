import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { useData } from './DataContext'
import {
  askPermission, buildNotifications, notificationsSupported, readFlag, registerWorker,
  showNotification, summaryLine, writeFlag,
} from '../lib/notifications'
import { today } from '../lib/dates'

const NotificationContext = createContext(null)

/**
 * In-app notification centre (bell) plus optional phone/desktop notifications. Both are built
 * from the user's own cases, so they work for every counselor regardless of Google.
 * A daily morning summary and an evening "tomorrow" summary fire while the app is open or
 * installed (the service worker shows them); closed-app alerts come from Google Calendar sync.
 */
export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const { cases, loading } = useData()
  const userId = user?.id
  const items = useMemo(() => buildNotifications(cases), [cases])

  const [seen, setSeen] = useState(() => new Set())
  const [enabled, setEnabled] = useState(false)
  const [permission, setPermission] = useState(notificationsSupported() ? Notification.permission : 'unsupported')

  useEffect(() => {
    if (!userId) return
    try {
      setSeen(new Set(JSON.parse(readFlag(userId, 'seen') || '[]')))
    } catch {
      setSeen(new Set())
    }
    setEnabled(readFlag(userId, 'browser') === '1')
    registerWorker()
  }, [userId])

  const unread = useMemo(() => items.filter((i) => !seen.has(i.id)).length, [items, seen])

  const markAllSeen = useCallback(() => {
    if (!userId) return
    const ids = items.map((i) => i.id)
    setSeen(new Set(ids))
    writeFlag(userId, 'seen', JSON.stringify(ids))
  }, [items, userId])

  const enable = useCallback(async () => {
    const result = await askPermission()
    setPermission(result)
    if (result !== 'granted') return result
    writeFlag(userId, 'browser', '1')
    setEnabled(true)
    await showNotification('تم تفعيل التنبيهات', 'سيصلك ملخص الجلسات والمتابعات كل صباح وملخص جلسات الغد كل مساء.', { tag: 'welcome' })
    return result
  }, [userId])

  const disable = useCallback(() => {
    writeFlag(userId, 'browser', null)
    setEnabled(false)
  }, [userId])

  // Morning (after 07:00) and evening (after 17:00) summaries, once per day each.
  useEffect(() => {
    if (!userId || loading || !enabled || permission !== 'granted') return undefined
    const tick = () => {
      const now = new Date()
      const day = today()
      if (now.getHours() >= 7 && readFlag(userId, 'morning') !== day) {
        writeFlag(userId, 'morning', day)
        const line = summaryLine(items)
        if (line) showNotification('أجندة اليوم', line, { tag: 'morning' })
      }
      if (now.getHours() >= 17 && readFlag(userId, 'evening') !== day) {
        writeFlag(userId, 'evening', day)
        const line = summaryLine(items, { evening: true })
        if (line) showNotification('جلسات الغد', line, { tag: 'evening', url: '/#roll' })
      }
    }
    tick()
    const timer = setInterval(tick, 10 * 60 * 1000)
    return () => clearInterval(timer)
  }, [userId, loading, enabled, permission, items])

  const value = { items, unread, markAllSeen, enabled, permission, enable, disable, supported: notificationsSupported() }
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export const useNotifications = () => useContext(NotificationContext)
