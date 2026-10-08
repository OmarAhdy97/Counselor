import { addDays } from './dates'

export const STATUSES = ['متداول', 'محجوز للحكم', 'محجوز للتقرير', 'متابعة', 'شطب', 'حفظ', 'محكوم فيه', 'إحالة', 'تحت الرفع']

/** Statuses where the case still has hearings to attend. */
export const OPEN_STATUSES = new Set(['متداول', 'محجوز للحكم', ''])

export const OUTCOMES = ['صالح', 'ضد', 'شطب', 'اختصاص نوعي', 'إحالة', 'حفظ']

export const DECISION_SUGGESTIONS = [
  'ورد التقرير',
  'للإعلان',
  'للمستندات',
  'للاطلاع',
  'للاطلاع والمستندات',
  'للمذكرات',
  'للسابق',
  'لضم ملف',
  'للتقرير',
  'للصلح',
  'لحضور الخبير',
  'للصق والنشر',
]

export const CASE_TYPE_SUGGESTIONS = [
  'اشكال في التنفيذ',
  'تظلم من قرار حيازة',
  'تظلم من قرار نيابة',
  'تظلم من قرار تمكين',
  'عدم اعتداد بحجز',
  'وقف إجراءات حجز اداري',
  'الغاء حجز اداري',
  'استرداد منقولات',
  'استرداد حيازة',
  'اعلان قائمة شروط البيع',
  'مطالبة',
  'ندب خبير',
  'تهريب',
]

/**
 * Suggested appeal period in days. This is an estimate the counselor can override:
 * جنح = 10 أيام، مستعجل/تنفيذ وقتي = 15 يوماً، غير ذلك = 40 يوماً.
 */
export function suggestedAppealDays(c) {
  const court = c.court || ''
  const type = c.case_type || ''
  if (court.includes('جنح')) return 10
  if (court.includes('مستعجل') || /اشكال|إشكال|وقتي/.test(type)) return 15
  return 40
}

export function suggestedAppealDeadline(c, rulingDate) {
  return rulingDate ? addDays(rulingDate, suggestedAppealDays(c)) : null
}

/** Renewal from شطب must happen within 60 days (م 82 مرافعات); follow up a bit earlier. */
export const STRUCK_OFF_FOLLOWUP_DAYS = 55

export function caseTitle(c) {
  if (!c.case_number) return 'تحت الرفع — بدون رقم'
  return c.case_year ? `${c.case_number} لسنة ${c.case_year}` : c.case_number
}

export const APPEAL_DECISIONS = ['طعن', 'عدم طعن']

export const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

export function circuitLabel(circuit) {
  if (!circuit) return ''
  const day = circuit.weekday !== null && circuit.weekday !== undefined ? ` — ${WEEKDAYS[circuit.weekday]}` : ''
  return `${circuit.name}${day}${circuit.period ? ` ${circuit.period}` : ''}`
}

export function statusTone(status) {
  switch (status) {
    case 'متداول': return 'blue'
    case 'محجوز للحكم': return 'violet'
    case 'محجوز للتقرير': return 'violet'
    case 'تحت الرفع': return 'amber'
    case 'متابعة': return 'amber'
    case 'شطب': return 'red'
    case 'محكوم فيه': return 'indigo'
    case 'حفظ': return 'slate'
    default: return status ? 'slate' : 'muted'
  }
}

export function outcomeTone(outcome) {
  switch (outcome) {
    case 'صالح': return 'indigo'
    case 'ضد': return 'red'
    case 'شطب': return 'amber'
    default: return outcome ? 'slate' : 'muted'
  }
}

/** Normalise court names typed with double spaces etc. */
export function cleanText(v) {
  if (v === null || v === undefined) return ''
  return String(v).replace(/\s+/g, ' ').trim()
}

/** Dot colour for a status chip (matches the badge tones). */
export function statusDot(status) {
  const t = statusTone(status)
  return t === 'muted' ? 'var(--muted)' : `var(--${t})`
}
