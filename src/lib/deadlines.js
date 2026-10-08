import { addDays, parseISO, toISO, daysBetween } from './dates'

/**
 * Common procedural deadlines. Periods are the general rule only; special laws, the new criminal
 * procedure code and later amendments can differ, so the UI always says to check the text in force.
 */
export const DEADLINE_RULES = [
  { group: 'مدني وتجاري (قانون المرافعات)', items: [
    { id: 'appeal', label: 'الاستئناف — الميعاد العام', days: 40, ref: 'م 227 مرافعات', from: 'من تاريخ صدور الحكم أو إعلانه حسب الأحوال' },
    { id: 'appeal-urgent', label: 'الاستئناف — المواد المستعجلة', days: 15, ref: 'م 227 مرافعات', from: 'من تاريخ صدور الحكم أو إعلانه حسب الأحوال' },
    { id: 'cassation', label: 'الطعن بالنقض', days: 60, ref: 'م 252 مرافعات', from: 'من تاريخ صدور الحكم أو إعلانه حسب الأحوال' },
    { id: 'revision', label: 'التماس إعادة النظر', days: 40, ref: 'م 242 مرافعات', from: 'من اليوم الذي يبدأ فيه الميعاد حسب سبب الالتماس' },
    { id: 'payment-order', label: 'التظلم من أمر الأداء', days: 10, ref: 'م 206 مرافعات', from: 'من تاريخ إعلان الأمر' },
    { id: 'renewal', label: 'تجديد الدعوى من الشطب', days: 60, ref: 'م 82 مرافعات', from: 'من تاريخ قرار الشطب' },
    { id: 'summons', label: 'تكليف المدعى عليه بالحضور', months: 3, ref: 'م 70 مرافعات', from: 'من تاريخ تقديم الصحيفة لقلم الكتاب' },
  ] },
  { group: 'جنائي (الإجراءات الجنائية)', items: [
    { id: 'misd-appeal', label: 'استئناف أحكام الجنح والمخالفات', days: 10, ref: 'م 406 إجراءات جنائية', from: 'من تاريخ النطق بالحكم الحضوري أو انقضاء ميعاد المعارضة' },
    { id: 'opposition', label: 'المعارضة في الحكم الغيابي', days: 10, ref: 'م 398 إجراءات جنائية', from: 'من تاريخ إعلان الحكم الغيابي' },
    { id: 'crim-cassation', label: 'النقض الجنائي', days: 60, ref: 'م 34 ق 57 لسنة 1959', from: 'من تاريخ الحكم الحضوري' },
  ] },
  { group: 'إداري (مجلس الدولة)', items: [
    { id: 'annulment', label: 'رفع دعوى الإلغاء', days: 60, ref: 'م 24 ق 47 لسنة 1972', from: 'من تاريخ نشر القرار أو إعلانه أو العلم اليقيني به' },
    { id: 'high-admin', label: 'الطعن أمام المحكمة الإدارية العليا', days: 60, ref: 'م 44 ق 47 لسنة 1972', from: 'من تاريخ صدور الحكم' },
  ] },
]

export const ALL_RULES = DEADLINE_RULES.flatMap((g) => g.items.map((r) => ({ ...r, group: g.group })))

/** م 16 مرافعات: يوم لكل 50 كم، ويوم لكسر يزيد على 30 كم، بحد أقصى 4 أيام. */
export function distanceDays(km) {
  const k = Math.max(0, Number(km) || 0)
  return Math.min(4, Math.floor(k / 50) + (k % 50 > 30 ? 1 : 0))
}

function addMonths(iso, months) {
  const d = parseISO(iso)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return toISO(d)
}

/**
 * The start day is not counted (م 15 مرافعات), so the deadline ends on start + period.
 * If the last day is an official holiday it moves to the next working day (م 18); Fridays are
 * handled automatically and the caller can pass other holidays.
 */
export function computeDeadline({ start, days, months, km = 0, holidays = [] }) {
  if (!start) return null
  let end = months ? addMonths(start, months) : addDays(start, days)
  const extra = distanceDays(km)
  if (extra) end = addDays(end, extra)
  const off = new Set(holidays)
  const moved = []
  while (parseISO(end).getDay() === 5 || off.has(end)) {
    moved.push(end)
    end = addDays(end, 1)
  }
  return { end, extra, moved, total: daysBetween(start, end) }
}
