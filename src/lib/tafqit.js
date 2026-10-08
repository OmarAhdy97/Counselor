// تفقيط: converts an amount in Egyptian pounds to formal Arabic words for memos and documents,
// e.g. 3525.5 -> "فقط ثلاثة آلاف وخمسمائة وخمسة وعشرون جنيهاً مصرياً وخمسون قرشاً لا غير".

const ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة']
const TEENS = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر']
const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون']
const HUNDREDS = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة']

// [singular, dual, plural (3–10), accusative singular (11–99)]
const SCALES = [
  null,
  ['ألف', 'ألفان', 'آلاف', 'ألفاً'],
  ['مليون', 'مليونان', 'ملايين', 'مليوناً'],
  ['مليار', 'ملياران', 'مليارات', 'ملياراً'],
]

/** 0–999 in words (masculine). */
function below1000(n) {
  const h = Math.floor(n / 100)
  const r = n % 100
  const parts = []
  if (h) parts.push(HUNDREDS[h])
  if (r) {
    if (r <= 10) parts.push(ONES[r])
    else if (r < 20) parts.push(TEENS[r - 10])
    else {
      const o = r % 10
      parts.push(o ? `${ONES[o]} و${TENS[Math.floor(r / 10)]}` : TENS[Math.floor(r / 10)])
    }
  }
  return parts.join(' و')
}

/** Picks the counted-noun form Arabic grammar requires after the number n. */
export function countedForm(n, [singular, dual, plural, accusative]) {
  const r = n % 100
  if (n === 1) return { words: '', noun: singular, one: true }
  if (n === 2) return { words: '', noun: dual }
  if (r >= 3 && r <= 10) return { words: integerWords(n), noun: plural }
  if (r >= 11 && r <= 99) return { words: integerWords(n), noun: accusative }
  return { words: integerWords(n), noun: singular }
}

/** Whole numbers up to 999,999,999,999 in words. */
export function integerWords(n) {
  if (!Number.isFinite(n) || n < 0) throw new Error('رقم غير صالح')
  n = Math.floor(n)
  if (n === 0) return 'صفر'
  if (n > 999_999_999_999) throw new Error('المبلغ أكبر من الحد المسموح')
  const groups = []
  let scale = 0
  while (n > 0) {
    const g = n % 1000
    if (g) {
      if (scale === 0) groups.unshift(below1000(g))
      else {
        const [one, two, plural] = SCALES[scale]
        const r = g % 100
        let text
        if (g === 1) text = one
        else if (g === 2) text = two
        else if (r >= 3 && r <= 10) text = `${below1000(g)} ${plural}`
        // Inside tafqit the scale is followed by more words or the currency, so «ألف» not «ألفاً».
        else if (r >= 11 && r <= 99) text = `${below1000(g)} ${one}`
        else text = `${below1000(g)} ${one}`
        groups.unshift(text)
      }
    }
    n = Math.floor(n / 1000)
    scale++
  }
  return groups.join(' و')
}

const POUND = ['جنيه مصري', 'جنيهان مصريان', 'جنيهات مصرية', 'جنيهاً مصرياً']
const PIASTER = ['قرش', 'قرشان', 'قروش', 'قرشاً']

function phrase(n, forms) {
  const { words, noun, one } = countedForm(n, forms)
  if (one) return `${noun} واحد`
  if (!words) return noun
  // A dual right before the currency takes the construct form: «ألفا جنيه»، «مائتا جنيه».
  return `${words.replace(/(ألفان|مليونان|ملياران|مائتان)$/, (m) => m.slice(0, -1))} ${noun}`
}

/** Full tafqit sentence for an amount in pounds (up to two decimals = piasters). */
export function tafqit(amount, { wrap = true } = {}) {
  const value = Math.round(Number(amount) * 100)
  if (!Number.isFinite(value) || value < 0) throw new Error('أدخل مبلغاً صحيحاً')
  const pounds = Math.floor(value / 100)
  const piasters = value % 100
  const parts = []
  if (pounds) parts.push(phrase(pounds, POUND))
  if (piasters) parts.push(phrase(piasters, PIASTER))
  if (!parts.length) parts.push('صفر جنيه')
  const text = parts.join(' و')
  return wrap ? `فقط ${text} لا غير` : text
}

/** "1,234,567.50" with Arabic thousands separators kept as Western digits (as courts write them). */
export function formatAmount(amount) {
  return Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
