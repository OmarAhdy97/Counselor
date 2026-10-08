import { OPEN_STATUSES, caseTitle } from './constants'
import { addDays, relative, today } from './dates'

/**
 * What needs the counselor's attention, computed from his own cases (so it works for every user,
 * with or without Google). Each item has a stable id per day so "seen" state resets naturally.
 */
export const KIND_META = {
  deadline: { label: 'مواعيد طعن قريبة', tone: 'red', rank: 0 },
  today: { label: 'جلسات اليوم', tone: 'blue', rank: 1 },
  missing: { label: 'جلسات فاتت بلا قرار', tone: 'amber', rank: 2 },
  followup: { label: 'متابعات مستحقة', tone: 'violet', rank: 3 },
  tomorrow: { label: 'جلسات الغد', tone: 'indigo', rank: 4 },
}

export function buildNotifications(cases) {
  const t = today()
  const tomorrow = addDays(t, 1)
  const soon = addDays(t, 7)
  const items = []
  const add = (kind, c, title, sub, date) =>
    items.push({ id: `${kind}-${c.id}-${t}`, kind, caseId: c.id, title, sub, date })

  for (const c of cases) {
    if (c.archived_at) continue
    const head = `${caseTitle(c)} — ${c.court}`
    const parties = [c.plaintiff, c.defendant && `ضد ${c.defendant}`].filter(Boolean).join(' ')

    if (c.next_session === t) add('today', c, head, parties || c.case_type || '', c.next_session)
    else if (c.next_session === tomorrow) add('tomorrow', c, head, parties || c.case_type || '', c.next_session)
    else if (c.next_session && c.next_session < t && OPEN_STATUSES.has(c.status || '')) {
      add('missing', c, head, `كانت ${relative(c.next_session)} — سجّل القرار`, c.next_session)
    }

    if (c.followup_date && c.followup_date <= t) {
      add('followup', c, head, c.notes ? c.notes.slice(0, 90) : `متابعة ${relative(c.followup_date)}`, c.followup_date)
    }
    if (c.appeal_deadline && c.appeal_deadline >= t && c.appeal_deadline <= soon && c.appeal_decision !== 'عدم طعن') {
      add('deadline', c, head, `آخر ميعاد للطعن ${relative(c.appeal_deadline)}`, c.appeal_deadline)
    }
  }

  return items.sort((a, b) => KIND_META[a.kind].rank - KIND_META[b.kind].rank || (a.date < b.date ? -1 : 1))
}

export function countByKind(items) {
  const out = {}
  for (const i of items) out[i.kind] = (out[i.kind] || 0) + 1
  return out
}

/** One-line summary for a phone notification, e.g. "2 جلسة اليوم، 3 متابعات مستحقة". */
export function summaryLine(items, { evening = false } = {}) {
  const n = countByKind(items)
  const parts = []
  if (evening) {
    if (n.tomorrow) parts.push(`${n.tomorrow} جلسة غداً`)
  } else {
    if (n.deadline) parts.push(`${n.deadline} ميعاد طعن قريب`)
    if (n.today) parts.push(`${n.today} جلسة اليوم`)
    if (n.missing) parts.push(`${n.missing} جلسة بلا قرار`)
    if (n.followup) parts.push(`${n.followup} متابعة مستحقة`)
  }
  return parts.join('، ')
}

/* ---------------- browser / phone notifications ---------------- */

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window

export async function registerWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

export async function askPermission() {
  if (!notificationsSupported()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

export async function showNotification(title, body, { tag, url = '/#today' } = {}) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false
  const options = { body, tag, dir: 'rtl', lang: 'ar', icon: '/icon-192.png', badge: '/icon-192.png', data: { url } }
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null
    if (reg) await reg.showNotification(title, options)
    else new Notification(title, options)
    return true
  } catch {
    return false
  }
}

const key = (userId, name) => `agenda:${userId}:${name}`
export const readFlag = (userId, name) => {
  try {
    return localStorage.getItem(key(userId, name))
  } catch {
    return null
  }
}
export const writeFlag = (userId, name, value) => {
  try {
    if (value === null) localStorage.removeItem(key(userId, name))
    else localStorage.setItem(key(userId, name), value)
  } catch { /* private mode */ }
}
