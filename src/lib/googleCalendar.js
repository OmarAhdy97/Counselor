// Google Calendar sync. Each counselor's sessions, follow-ups and appeal deadlines are written to a
// dedicated calendar ("أجندة المستشار") in their own Google account, with reminders, so the phone's
// Google Calendar notifies them. Access tokens come from Google Identity Services in the browser.

import { addDays, today } from './dates'
import { caseTitle } from './constants'

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const SCOPE = 'https://www.googleapis.com/auth/calendar.app.created'
const API = 'https://www.googleapis.com/calendar/v3'
const CALENDAR_NAME = 'أجندة المستشار'

let gisPromise = null
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  gisPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = resolve
    s.onerror = () => reject(new Error('تعذر تحميل خدمة جوجل. تأكد من الاتصال بالإنترنت.'))
    document.head.appendChild(s)
  })
  return gisPromise
}

let token = null // { value, expiresAt }

/** Gets an access token. `interactive` shows Google's consent popup; otherwise it only reuses a live token. */
export async function getToken({ interactive, hint } = {}) {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value
  if (!interactive) return null
  if (!GOOGLE_CLIENT_ID) throw new Error('لم يتم ضبط VITE_GOOGLE_CLIENT_ID في ملف .env')
  await loadGis()
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      login_hint: hint,
      callback: (r) => {
        if (r.error) return reject(new Error(r.error_description || r.error))
        token = { value: r.access_token, expiresAt: Date.now() + r.expires_in * 1000 }
        resolve(token.value)
      },
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'تم إغلاق نافذة جوجل قبل الموافقة.' : e.message || e.type)),
    })
    client.requestAccessToken({ prompt: '' })
  })
}

export const hasLiveToken = () => !!token && token.expiresAt > Date.now() + 60_000
export const forgetToken = () => {
  if (token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(token.value, () => {})
  token = null
}

async function call(path, { method = 'GET', body, params } = {}) {
  const url = new URL(API + path)
  if (params) Object.entries(params).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, v))
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token.value}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error?.message || `Google Calendar ${res.status}`)
    err.status = res.status
    throw err
  }
  return data
}

/** Returns a calendar id we own, creating the calendar when the stored one is gone. */
export async function ensureCalendar(storedId) {
  if (storedId) {
    try {
      await call(`/calendars/${encodeURIComponent(storedId)}`)
      return storedId
    } catch (err) {
      if (err.status !== 404 && err.status !== 403) throw err
    }
  }
  const cal = await call('/calendars', {
    method: 'POST',
    body: { summary: CALENDAR_NAME, description: 'جلسات ومتابعات ومواعيد طعن — تُحدَّث تلقائياً من برنامج أجندة المستشار', timeZone: 'Africa/Cairo' },
  })
  return cal.id
}

// Google event ids must be base32hex (0-9, a-v). A uuid without dashes qualifies; the prefix tells kinds apart.
const eventId = (kind, caseId) => `${kind}${caseId.replace(/-/g, '')}`

function allDay(date, summary, description, colorId, reminderMinutes) {
  return {
    start: { date },
    end: { date: addDays(date, 1) },
    summary,
    description,
    colorId,
    transparency: 'transparent',
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: reminderMinutes }] },
  }
}

/** Every future event the counselor should see in their calendar, keyed by deterministic id. */
export function desiredEvents(cases, reminderMinutes) {
  const t = today()
  const out = new Map()
  for (const c of cases) {
    const head = `${caseTitle(c)} — ${c.court}`
    const parties = [c.plaintiff, c.defendant && `ضد ${c.defendant}`].filter(Boolean).join(' ')
    if (c.next_session && c.next_session >= t) {
      const reserved = c.status === 'محجوز للحكم'
      out.set(eventId('s', c.id), allDay(
        c.next_session,
        `${reserved ? 'نطق بالحكم' : 'جلسة'}: ${head}`,
        [parties, c.case_type, c.last_decision && `آخر قرار: ${c.last_decision}`, c.notes && `ملاحظات: ${c.notes}`].filter(Boolean).join('\n'),
        reserved ? '3' : '9',
        reminderMinutes
      ))
    }
    if (c.followup_date && c.followup_date >= t) {
      out.set(eventId('f', c.id), allDay(c.followup_date, `متابعة: ${head}`, [c.notes || 'متابعة الملف', parties].filter(Boolean).join('\n'), '5', reminderMinutes))
    }
    if (c.appeal_deadline && c.appeal_deadline >= t) {
      out.set(eventId('a', c.id), allDay(
        c.appeal_deadline,
        `آخر ميعاد طعن: ${head}`,
        [`الحكم: ${c.ruling_outcome || '—'}`, parties, 'الميعاد تقديري — راجعه'].filter(Boolean).join('\n'),
        '11',
        // Appeal deadlines warn three days early as well.
        reminderMinutes
      ))
      out.get(eventId('a', c.id)).reminders.overrides.push({ method: 'popup', minutes: 3 * 1440 })
    }
  }
  return out
}

const fingerprint = (e) => JSON.stringify([e.start.date, e.summary, e.description, e.colorId, e.reminders.overrides])

/**
 * Makes the calendar match `cases`: creates/updates what changed and removes events for hearings
 * that moved or ended. Past events are left alone as a record.
 */
export async function syncCalendar(calendarId, cases, reminderMinutes) {
  const want = desiredEvents(cases, reminderMinutes)
  const have = new Map()
  let pageToken
  do {
    const page = await call(`/calendars/${encodeURIComponent(calendarId)}/events`, {
      params: { timeMin: `${today()}T00:00:00Z`, maxResults: 2500, singleEvents: 'true', pageToken },
    })
    for (const e of page.items || []) have.set(e.id, e)
    pageToken = page.nextPageToken
  } while (pageToken)

  const ops = []
  for (const [id, ev] of want) {
    const cur = have.get(id)
    const body = { ...ev, id, extendedProperties: { private: { fp: fingerprint(ev) } } }
    if (!cur) ops.push(() => upsert(calendarId, id, body))
    else if (cur.extendedProperties?.private?.fp !== body.extendedProperties.private.fp) {
      ops.push(() => call(`/calendars/${encodeURIComponent(calendarId)}/events/${id}`, { method: 'PUT', body }))
    }
  }
  for (const id of have.keys()) {
    if (!want.has(id)) ops.push(() => call(`/calendars/${encodeURIComponent(calendarId)}/events/${id}`, { method: 'DELETE' }).catch((e) => { if (e.status !== 410 && e.status !== 404) throw e }))
  }

  // A few requests at a time keeps us under Google's per-user rate limit.
  for (let i = 0; i < ops.length; i += 5) await Promise.all(ops.slice(i, i + 5).map((op) => op()))
  return { changed: ops.length, total: want.size }
}

async function upsert(calendarId, id, body) {
  try {
    return await call(`/calendars/${encodeURIComponent(calendarId)}/events`, { method: 'POST', body })
  } catch (err) {
    // The id exists but was deleted earlier (Google keeps it): bring it back with PUT.
    if (err.status === 409) return call(`/calendars/${encodeURIComponent(calendarId)}/events/${id}`, { method: 'PUT', body: { ...body, status: 'confirmed' } })
    throw err
  }
}
