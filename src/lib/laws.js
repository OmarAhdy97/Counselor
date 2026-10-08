// Turns pasted/uploaded law text into articles, and searches them with Arabic-insensitive matching.

const INDIC = '٠١٢٣٤٥٦٧٨٩'
const toWestern = (s) => s.replace(/[٠-٩]/g, (d) => String(INDIC.indexOf(d)))

/** Ignores diacritics/tatweel, hamza forms, ى/ي and ة/ه, and Arabic-Indic digits. */
export function fold(s) {
  return toWestern(String(s ?? ''))
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
}

function normalizeNumber(raw) {
  return toWestern(raw)
    .replace(/[ً-ْ]/g, '')
    .replace(/مكرر[اة]*/g, 'مكرر')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// "مادة 12" / "مادة (12)" / "المادة ١٢" / "مادة 12 مكرراً" / "مادة (5 مكرر أ)" at the start of a line.
const HEADING = /^\s*(?:ال)?ماد[ةه]\s*[(\[﴿]?\s*([0-9٠-٩]+(?:\s*(?:مكرر[اًة]*)(?:\s*\(?[أ-ي]\)?)?)?)\s*[)\]﴾]?\s*[:：\-–—.]?\s*(.*)$/

/**
 * Splits text into [{ n, text }]. Text before the first heading is kept as article "تمهيد"
 * only when it is long enough to be a real preamble. Duplicate numbers are kept (laws have
 * amended articles), so the counselor can see both.
 */
export function parseArticles(raw) {
  const lines = String(raw ?? '').replace(/\r/g, '').split('\n')
  const out = []
  let cur = null
  let preamble = []

  for (const line of lines) {
    const m = line.match(HEADING)
    if (m && m[1]) {
      if (cur) out.push(cur)
      cur = { n: normalizeNumber(m[1]), text: m[2].trim() }
    } else if (cur) {
      cur.text += (cur.text ? '\n' : '') + line.trim()
    } else if (line.trim()) {
      preamble.push(line.trim())
    }
  }
  if (cur) out.push(cur)
  for (const a of out) a.text = a.text.replace(/\n{3,}/g, '\n\n').trim()

  const pre = preamble.join('\n')
  if (pre.length > 200 && out.length) out.unshift({ n: 'تمهيد', text: pre })
  return out.filter((a) => a.text)
}

/** Every term must appear in the article (number or text). A bare number also matches the article number exactly. */
export function searchLaws(laws, query, { lawId = '', limit = 60 } = {}) {
  const q = fold(query).trim()
  if (!q) return { hits: [], total: 0 }
  const terms = q.split(/\s+/).filter(Boolean)
  const asNumber = /^\d+$/.test(q) ? q : null
  const hits = []
  let total = 0
  for (const law of laws) {
    if (lawId && law.id !== lawId) continue
    for (const a of law.articles) {
      const hay = fold(a.text)
      const n = fold(a.n)
      const byNumber = asNumber && (n === asNumber || n.startsWith(`${asNumber} `))
      if (byNumber || terms.every((t) => hay.includes(t))) {
        total++
        if (hits.length < limit) hits.push({ law, article: a, byNumber: !!byNumber })
      }
    }
  }
  // Exact article-number matches first.
  hits.sort((x, y) => Number(y.byNumber) - Number(x.byNumber))
  return { hits, total }
}

/** Splits text around the query terms so the UI can highlight them (folding-safe, same length). */
export function highlightParts(text, query) {
  const terms = fold(query).split(/\s+/).filter((t) => t.length > 1 && !/^\d+$/.test(t))
  if (!terms.length) return [{ t: text, hit: false }]
  // fold() keeps string length for everything except Indic digits (1:1) and removed diacritics,
  // so build a mapping from folded index to original index.
  const map = []
  let folded = ''
  for (let i = 0; i < text.length; i++) {
    const f = fold(text[i])
    for (let k = 0; k < f.length; k++) {
      folded += f[k]
      map.push(i)
    }
  }
  const marks = new Array(text.length).fill(false)
  for (const t of terms) {
    let at = folded.indexOf(t)
    while (at !== -1) {
      for (let k = at; k < at + t.length; k++) marks[map[k]] = true
      at = folded.indexOf(t, at + t.length)
    }
  }
  const parts = []
  let start = 0
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || marks[i] !== marks[start]) {
      parts.push({ t: text.slice(start, i), hit: marks[start] })
      start = i
    }
  }
  return parts
}
