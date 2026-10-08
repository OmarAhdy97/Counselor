import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { caseKey } from '../lib/excel'
import { cleanText } from '../lib/constants'

const DataContext = createContext(null)

const CASE_FIELDS = [
  'court', 'case_number', 'case_year', 'plaintiff', 'defendant', 'case_type', 'status',
  'next_session', 'last_decision', 'ruling_text', 'ruling_date', 'ruling_outcome',
  'appeal_deadline', 'notes', 'copy_numbers', 'memos', 'followup_date',
  'circuit_id', 'archived_at', 'ruling_number', 'appeal_decision', 'appeal_note',
]

/** Keeps only real columns and turns '' into null so dates/ints are valid for Postgres. */
function toRow(fields) {
  const row = {}
  for (const k of CASE_FIELDS) {
    if (!(k in fields)) continue
    let v = fields[k]
    if (typeof v === 'string') v = k === 'ruling_text' ? v.trim() : cleanText(v)
    row[k] = v === '' || v === undefined ? null : v
  }
  if ('case_year' in row && row.case_year !== null) row.case_year = Number(row.case_year)
  return row
}

async function fetchAll(table, order) {
  const pageSize = 1000
  let from = 0
  const out = []
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(order, { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    out.push(...data)
    if (data.length < pageSize) return out
    from += pageSize
  }
}

export function DataProvider({ children }) {
  const { user } = useAuth()
  const [cases, setCases] = useState([])
  const [sessions, setSessions] = useState([])
  const [circuits, setCircuits] = useState([])
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setLoadError(null)
    try {
      const [c, s, cir, att] = await Promise.all([
        fetchAll('agenda_cases', 'created_at'),
        fetchAll('agenda_sessions', 'session_date'),
        fetchAll('agenda_circuits', 'created_at'),
        fetchAll('agenda_attachments', 'created_at'),
      ])
      setCases(c)
      setSessions(s)
      setCircuits(cir)
      setAttachments(att)
    } catch (err) {
      setLoadError(err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) reload()
    else {
      setCases([])
      setSessions([])
      setCircuits([])
      setAttachments([])
    }
  }, [user, reload])

  const sessionsByCase = useMemo(() => {
    const m = new Map()
    for (const s of sessions) {
      if (!m.has(s.case_id)) m.set(s.case_id, [])
      m.get(s.case_id).push(s)
    }
    for (const list of m.values()) list.sort((a, b) => (a.session_date < b.session_date ? 1 : -1))
    return m
  }, [sessions])

  const lastSessionByCase = useMemo(() => {
    const m = new Map()
    for (const [id, list] of sessionsByCase) m.set(id, list[0])
    return m
  }, [sessionsByCase])

  const lists = useMemo(() => {
    const uniq = (key) =>
      [...new Set(cases.map((c) => c[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'))
    return {
      courts: uniq('court'),
      caseTypes: uniq('case_type'),
      parties: [...new Set([...uniq('plaintiff'), ...uniq('defendant')])],
      years: [...new Set(cases.map((c) => c.case_year))].sort((a, b) => b - a),
      statuses: uniq('status'),
    }
  }, [cases])

  const replaceCase = (row) => setCases((prev) => prev.map((c) => (c.id === row.id ? row : c)))

  const createCase = async (fields) => {
    const { data, error } = await supabase.from('agenda_cases').insert(toRow(fields)).select().single()
    if (error) throw error
    setCases((prev) => [...prev, data])
    return data
  }

  const updateCase = async (id, fields) => {
    const { data, error } = await supabase.from('agenda_cases').update(toRow(fields)).eq('id', id).select().single()
    if (error) throw error
    replaceCase(data)
    return data
  }

  const deleteCase = async (id) => {
    const { error } = await supabase.from('agenda_cases').delete().eq('id', id)
    if (error) throw error
    setCases((prev) => prev.filter((c) => c.id !== id))
    setSessions((prev) => prev.filter((s) => s.case_id !== id))
  }

  /** Logs what happened at a hearing and moves the case forward in one step. */
  const recordSession = async (caseId, { session_date, decision, next_date }, caseFields) => {
    const { data: s, error } = await supabase
      .from('agenda_sessions')
      .insert({ case_id: caseId, session_date, decision: cleanText(decision) || null, next_date: next_date || null })
      .select()
      .single()
    if (error) throw error
    setSessions((prev) => [...prev, s])
    return updateCase(caseId, caseFields)
  }

  const deleteSession = async (id) => {
    const { error } = await supabase.from('agenda_sessions').delete().eq('id', id)
    if (error) throw error
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }

  /** Same hearing outcome for many cases at once (ترحيل مجمّع). Logs a session for each. */
  const recordBulk = async (items) => {
    // items: [{ caseId, session: {session_date, decision, next_date}, fields }]
    const rows = items.map(({ caseId, session }) => ({
      case_id: caseId,
      session_date: session.session_date,
      decision: cleanText(session.decision) || null,
      next_date: session.next_date || null,
    }))
    const { data: saved, error } = await supabase.from('agenda_sessions').insert(rows).select()
    if (error) throw error
    setSessions((prev) => [...prev, ...saved])
    const updated = []
    for (let i = 0; i < items.length; i += 5) {
      const chunk = await Promise.all(
        items.slice(i, i + 5).map(({ caseId, fields }) =>
          supabase.from('agenda_cases').update(toRow(fields)).eq('id', caseId).select().single()
        )
      )
      for (const r of chunk) {
        if (r.error) throw r.error
        updated.push(r.data)
      }
    }
    const byId = new Map(updated.map((c) => [c.id, c]))
    setCases((prev) => prev.map((c) => byId.get(c.id) || c))
    return updated.length
  }

  const archiveCase = (id) => updateCase(id, { archived_at: new Date().toISOString() })
  const unarchiveCase = (id) => updateCase(id, { archived_at: null })

  const saveCircuit = async (fields) => {
    const row = {
      court: cleanText(fields.court),
      name: cleanText(fields.name),
      weekday: fields.weekday === '' || fields.weekday === null ? null : Number(fields.weekday),
      period: fields.period || null,
      appeal_weekday: fields.appeal_weekday === '' || fields.appeal_weekday === null ? null : Number(fields.appeal_weekday),
      notes: cleanText(fields.notes) || null,
    }
    const q = fields.id
      ? supabase.from('agenda_circuits').update(row).eq('id', fields.id)
      : supabase.from('agenda_circuits').insert(row)
    const { data, error } = await q.select().single()
    if (error) throw error
    setCircuits((prev) => (fields.id ? prev.map((c) => (c.id === data.id ? data : c)) : [...prev, data]))
    return data
  }

  const deleteCircuit = async (id) => {
    const { error } = await supabase.from('agenda_circuits').delete().eq('id', id)
    if (error) throw error
    setCircuits((prev) => prev.filter((c) => c.id !== id))
    setCases((prev) => prev.map((c) => (c.circuit_id === id ? { ...c, circuit_id: null } : c)))
  }

  const uploadAttachment = async (caseId, file, kind) => {
    // Storage keys must be ASCII, so the Arabic file name lives in the table and the key uses the extension only.
    const ext = (file.name.match(/\.[A-Za-z0-9]{1,8}$/) || [''])[0].toLowerCase()
    const path = `${user.id}/${caseId}/${crypto.randomUUID()}${ext}`
    const up = await supabase.storage.from('case-files').upload(path, file, { contentType: file.type || undefined })
    if (up.error) throw up.error
    const { data, error } = await supabase
      .from('agenda_attachments')
      .insert({ case_id: caseId, kind: kind || null, name: file.name, path, size: file.size, mime: file.type || null })
      .select()
      .single()
    if (error) {
      await supabase.storage.from('case-files').remove([path])
      throw error
    }
    setAttachments((prev) => [...prev, data])
    return data
  }

  const openAttachment = async (a) => {
    const { data, error } = await supabase.storage.from('case-files').createSignedUrl(a.path, 120, { download: a.name })
    if (error) throw error
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  const deleteAttachment = async (a) => {
    const { error } = await supabase.storage.from('case-files').remove([a.path])
    if (error) throw error
    await supabase.from('agenda_attachments').delete().eq('id', a.id)
    setAttachments((prev) => prev.filter((x) => x.id !== a.id))
  }

  /**
   * Imports rows read from the Excel sheet. Matches existing cases by court + number + year;
   * a filled cell overwrites, an empty cell never wipes what is already saved.
   */
  const importCases = async (rows) => {
    const existing = new Map(cases.map((c) => [caseKey(c), c]))
    const merged = new Map()
    let duplicatesInFile = 0

    for (const r of rows) {
      const key = caseKey(r)
      const base = merged.get(key) || existing.get(key) || {}
      if (merged.has(key)) duplicatesInFile++
      const next = { ...base }
      for (const k of CASE_FIELDS) {
        if (r[k] !== null && r[k] !== undefined && r[k] !== '') next[k] = r[k]
      }
      next._previous_session = r.previous_session || base._previous_session
      next._decision_at_previous = r.previous_session ? r.last_decision : base._decision_at_previous
      merged.set(key, next)
    }

    const payload = [...merged.values()].map((m) => ({ ...toRow(m), user_id: user.id }))
    const saved = []
    for (let i = 0; i < payload.length; i += 200) {
      const { data, error } = await supabase
        .from('agenda_cases')
        .upsert(payload.slice(i, i + 200), { onConflict: 'user_id,court,case_number,case_year' })
        .select()
      if (error) throw error
      saved.push(...data)
    }

    // A dated "الجلسة السابقة" becomes a history entry, unless that hearing is already logged.
    const savedByKey = new Map(saved.map((c) => [caseKey(c), c]))
    const newSessions = []
    for (const [key, m] of merged) {
      if (!m._previous_session) continue
      const c = savedByKey.get(key)
      const already = (sessionsByCase.get(c.id) || []).some((s) => s.session_date === m._previous_session)
      if (!already) {
        newSessions.push({
          case_id: c.id,
          session_date: m._previous_session,
          decision: m._decision_at_previous || null,
          next_date: c.next_session,
        })
      }
    }
    if (newSessions.length) {
      const { error } = await supabase.from('agenda_sessions').insert(newSessions)
      if (error) throw error
    }

    const added = saved.filter((c) => !existing.has(caseKey(c))).length
    await reload()
    return { added, updated: saved.length - added, duplicatesInFile, sessions: newSessions.length }
  }

  const circuitsById = useMemo(() => new Map(circuits.map((c) => [c.id, c])), [circuits])
  const attachmentsByCase = useMemo(() => {
    const m = new Map()
    for (const a of attachments) {
      if (!m.has(a.case_id)) m.set(a.case_id, [])
      m.get(a.case_id).push(a)
    }
    return m
  }, [attachments])

  const value = {
    cases,
    sessions,
    attachments,
    circuits,
    circuitsById,
    attachmentsByCase,
    recordBulk,
    archiveCase,
    unarchiveCase,
    saveCircuit,
    deleteCircuit,
    uploadAttachment,
    openAttachment,
    deleteAttachment,
    sessionsByCase,
    lastSessionByCase,
    lists,
    loading,
    loadError,
    reload,
    createCase,
    updateCase,
    deleteCase,
    recordSession,
    deleteSession,
    importCases,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export const useData = () => useContext(DataContext)
