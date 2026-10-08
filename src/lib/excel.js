import { cleanText } from './constants'
import { looseToISO, fmt, parseISO } from './dates'

// Column order of the counselor's own sheet (أجندة العمل). Export keeps this exact order.
export const SHEET_COLUMNS = [
  { key: 'court', label: 'المحكمة' },
  { key: 'case_number', label: 'رقم الدعوى' },
  { key: 'case_year', label: 'السنة' },
  { key: 'plaintiff', label: 'المدعى' },
  { key: 'defendant', label: 'المدعى عليه' },
  { key: 'case_type', label: 'نوع الدعوى' },
  { key: 'previous_session', label: 'الجلسة السابقة' },
  { key: 'last_decision', label: 'القرار' },
  { key: 'status', label: 'حالة الدعوى' },
  { key: 'next_session', label: 'تاريخ الجلسة' },
  { key: 'ruling_text', label: 'منطوق الحكم' },
  { key: 'ruling_outcome', label: 'الحكم صالح او ضد' },
  { key: 'notes', label: 'ملاحظات الهامه' },
  { key: 'copy_numbers', label: 'رقم النسخ' },
  { key: 'memos', label: 'المذكرات ورقم النسخ' },
  { key: 'followup_date', label: 'تاريخ المتابعات' },
]

// xlsx (~400 KB) is loaded only when the counselor imports or exports.
const DATE_KEYS = new Set(['previous_session', 'next_session', 'followup_date'])

// Loose Arabic matching so "السنة ", "المدعي", "ملاحظات هامة" all map correctly.
function norm(s) {
  return cleanText(s)
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s/g, '')
}

const HEADER_ALIASES = {
  court: ['المحكمه'],
  case_number: ['رقمالدعوي', 'رقمالقضيه'],
  case_year: ['السنه', 'لسنه'],
  plaintiff: ['المدعي'],
  defendant: ['المدعيعليه'],
  case_type: ['نوعالدعوي', 'الموضوع'],
  previous_session: ['الجلسهالسابقه'],
  last_decision: ['القرار'],
  status: ['حالهالدعوي', 'الحاله'],
  next_session: ['تاريخالجلسه', 'الجلسهالقادمه'],
  ruling_text: ['منطوقالحكم'],
  ruling_outcome: ['الحكمصالحاوضد', 'نتيجهالحكم'],
  notes: ['ملاحظاتالهامه', 'ملاحظات', 'ملاحظاتهامه'],
  copy_numbers: ['رقمالنسخ'],
  memos: ['المذكراتورقمالنسخ', 'المذكرات'],
  followup_date: ['تاريخالمتابعات', 'تاريخالمتابعه'],
}

function mapHeader(row) {
  const map = {}
  row.forEach((cell, idx) => {
    const n = norm(cell)
    if (!n) return
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map[key] === undefined && aliases.includes(n)) {
        map[key] = idx
        break
      }
    }
  })
  return map
}

function cellText(v) {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return fmt(looseToISO(v))
  return cleanText(v)
}

/**
 * Reads the counselor's agenda workbook. Finds the header row on any sheet, maps columns by
 * name, and returns normalised case rows plus warnings for rows it had to skip.
 */
export async function readAgendaWorkbook(file) {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { cellDates: true })

  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null })
    const headerIdx = rows.findIndex((r) => {
      const m = mapHeader(r || [])
      return m.court !== undefined && m.case_number !== undefined
    })
    if (headerIdx === -1) continue

    const map = mapHeader(rows[headerIdx])
    const cases = []
    const warnings = []

    rows.slice(headerIdx + 1).forEach((r, i) => {
      if (!r || r.every((v) => v === null || v === '')) return
      const get = (k) => (map[k] === undefined ? null : r[map[k]])
      const excelRow = headerIdx + i + 2

      const court = cleanText(get('court'))
      const caseNumber = cleanText(get('case_number'))
      const year = parseInt(cleanText(get('case_year')), 10)
      if (!court || !caseNumber || !year) {
        warnings.push(`صف ${excelRow}: ناقص المحكمة أو الرقم أو السنة — تم تخطيه`)
        return
      }

      const prevRaw = get('previous_session')
      cases.push({
        court,
        case_number: caseNumber,
        case_year: year,
        plaintiff: cellText(get('plaintiff')) || null,
        defendant: cellText(get('defendant')) || null,
        case_type: cellText(get('case_type')) || null,
        previous_session: looseToISO(prevRaw),
        last_decision: cellText(get('last_decision')) || null,
        status: cellText(get('status')) || null,
        next_session: looseToISO(get('next_session')),
        ruling_text: (get('ruling_text') ? String(get('ruling_text')).trim() : '') || null,
        ruling_outcome: cellText(get('ruling_outcome')) || null,
        notes: cellText(get('notes')) || null,
        copy_numbers: cellText(get('copy_numbers')) || null,
        memos: cellText(get('memos')) || null,
        followup_date: looseToISO(get('followup_date')),
        _row: excelRow,
      })
    })

    return { sheetName: name, cases, warnings }
  }

  throw new Error('لم أجد صف العناوين (المحكمة / رقم الدعوى) في أي ورقة من الملف.')
}

export const caseKey = (c) => `${cleanText(c.court)}|${cleanText(c.case_number)}|${c.case_year}`

/** Writes cases to .xlsx in the same column order as the counselor's sheet, right-to-left. */
export async function exportAgendaWorkbook(cases, lastSessionByCase, fileName) {
  const XLSX = await import('xlsx')
  const header = SHEET_COLUMNS.map((c) => c.label)
  const body = cases.map((c) =>
    SHEET_COLUMNS.map(({ key }) => {
      const v = key === 'previous_session' ? lastSessionByCase.get(c.id)?.session_date : c[key]
      if (DATE_KEYS.has(key)) return v ? parseISO(v) : null
      if (key === 'case_year') return c.case_year
      if (key === 'case_number') return /^\d+$/.test(c.case_number) ? Number(c.case_number) : c.case_number
      return v ?? null
    })
  )

  const ws = XLSX.utils.aoa_to_sheet([header, ...body], { cellDates: true, dateNF: 'd/m/yyyy' })
  ws['!cols'] = SHEET_COLUMNS.map(({ key }) => ({
    wch: ['ruling_text', 'notes'].includes(key) ? 50 : ['plaintiff', 'defendant', 'case_type'].includes(key) ? 28 : 14,
  }))
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: body.length, c: header.length - 1 } }) }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'جميع الملفات')
  wb.Workbook = { Views: [{ RTL: true }] }
  XLSX.writeFile(wb, fileName)
}
