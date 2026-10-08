// All dates travel as 'YYYY-MM-DD' strings (local calendar day), matching Postgres `date`.

const pad = (n) => String(n).padStart(2, '0')

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function today() {
  return toISO(new Date())
}

export function parseISO(s) {
  if (!s) return null
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso, days) {
  const d = parseISO(iso)
  d.setDate(d.getDate() + days)
  return toISO(d)
}

export function daysBetween(fromIso, toIso) {
  return Math.round((parseISO(toIso) - parseISO(fromIso)) / 86400000)
}

/** Start of the week (Saturday, as courts work Sat–Thu). */
export function weekStart(iso) {
  const d = parseISO(iso)
  const back = (d.getDay() + 1) % 7
  d.setDate(d.getDate() - back)
  return toISO(d)
}

const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

export function dayName(iso) {
  return iso ? DAY_NAMES[parseISO(iso).getDay()] : ''
}

/** 2026-07-09 -> 9/7/2026 (the way the counselor writes it) */
export function fmt(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${Number(d)}/${Number(m)}/${y}`
}

export function fmtLong(iso) {
  return iso ? `${dayName(iso)} ${fmt(iso)}` : ''
}

/** Human distance: اليوم / غداً / بعد 3 أيام / منذ يومين */
export function relative(iso, ref = today()) {
  if (!iso) return ''
  const n = daysBetween(ref, iso)
  if (n === 0) return 'اليوم'
  if (n === 1) return 'غداً'
  if (n === -1) return 'أمس'
  const abs = Math.abs(n)
  const unit = abs === 2 ? 'يومين' : abs <= 10 ? `${abs} أيام` : `${abs} يوماً`
  return n > 0 ? `بعد ${unit}` : `منذ ${unit}`
}

/** Accepts 9/7/2026, 09-07-2026, 2026-07-09, Date, or an Excel serial. */
export function looseToISO(v) {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date && !isNaN(v)) return toISO(v)
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // Excel serial (1900 system)
    const d = new Date(Math.round((v - 25569) * 86400000))
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`
  return null
}

/**
 * Candidate adjournment dates: the circuit's sitting day 1–6 weeks after `fromIso`,
 * or plain +1..+6 weeks when the circuit has no fixed day.
 */
export function suggestDates(fromIso, weekday, count = 6) {
  const out = []
  if (weekday === null || weekday === undefined) {
    for (let w = 1; w <= count; w++) out.push(addDays(fromIso, w * 7))
    return out
  }
  let d = addDays(fromIso, 1)
  while (parseISO(d).getDay() !== weekday) d = addDays(d, 1)
  for (let w = 0; w < count; w++) out.push(addDays(d, w * 7))
  return out
}
