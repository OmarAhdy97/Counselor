import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Library, Plus, Search, Trash2, Upload } from 'lucide-react'
import { Empty, Field, Modal } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { useToast } from '../../context/ToastContext'
import { highlightParts, parseArticles, searchLaws } from '../../lib/laws'
import Select from '../../components/Select'

function Highlighted({ text, query }) {
  return (
    <>
      {highlightParts(text, query).map((p, i) => (p.hit ? <mark key={i}>{p.t}</mark> : <span key={i}>{p.t}</span>))}
    </>
  )
}

/**
 * A personal legislation library: the counselor pastes or uploads the text of a law, it is split
 * into articles, stored in his account, and becomes searchable. No legal text ships with the app.
 */
export default function LawsTool() {
  const toast = useToast()
  const fileRef = useRef(null)
  const [laws, setLaws] = useState(null)
  const [query, setQuery] = useState('')
  const [lawId, setLawId] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title: '', note: '', text: '' })
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('agenda_laws').select('*').order('created_at')
    if (error) toast(friendlyError(error), 'error')
    else setLaws(data)
  }, [toast])
  useEffect(() => { load() }, [load])

  const parsed = useMemo(() => (form.text ? parseArticles(form.text) : []), [form.text])
  const result = useMemo(() => searchLaws(laws || [], query, { lawId }), [laws, query, lawId])
  const readingLaw = (laws || []).find((l) => l.id === reading)

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!/\.txt$/i.test(f.name)) return toast('ارفع ملف نصي (.txt) أو الصق النص مباشرة. لتحويل Word: انسخ المحتوى والصقه هنا.', 'error')
    const text = await f.text()
    setForm((p) => ({ ...p, text, title: p.title || f.name.replace(/\.txt$/i, '') }))
  }

  const save = async (e) => {
    e.preventDefault()
    if (!parsed.length) return toast('لم أتعرف على مواد في النص. تأكد أن كل مادة تبدأ بسطر مثل: مادة (1) أو المادة 1', 'error')
    setBusy(true)
    const { error } = await supabase.from('agenda_laws').insert({
      title: form.title.trim(),
      note: form.note.trim() || null,
      articles: parsed,
      article_count: parsed.length,
    })
    setBusy(false)
    if (error) return toast(/duplicate|unique/i.test(error.message) ? 'يوجد تشريع بنفس العنوان.' : friendlyError(error), 'error')
    toast(`تم حفظ التشريع (${parsed.length} مادة)`)
    setAdding(false)
    setForm({ title: '', note: '', text: '' })
    load()
  }

  const remove = async (l) => {
    if (!window.confirm(`حذف «${l.title}» من مكتبتك؟`)) return
    const { error } = await supabase.from('agenda_laws').delete().eq('id', l.id)
    if (error) return toast(friendlyError(error), 'error')
    setLaws((p) => p.filter((x) => x.id !== l.id))
    if (lawId === l.id) setLawId('')
    if (reading === l.id) setReading('')
  }

  const copyArticle = (l, a) => navigator.clipboard.writeText(`${l.title} — مادة ${a.n}\n${a.text}`).then(() => toast('تم نسخ المادة'))

  if (laws === null) return <div className="loading">جارٍ التحميل…</div>

  return (
    <div className="stack">
      <div className="card pad">
        <div className="card-title-row full">
          <h2 className="card-title"><Library size={18} /> مكتبة التشريعات</h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><Plus size={14} /> إضافة تشريع</button>
        </div>
        <p className="muted small">
          أضف نص القانون من مصدره الرسمي (الوقائع المصرية أو أي نسخة معتمدة)، فيُقسَّم إلى مواد ويصبح البحث فيه بالكلمة أو
          برقم المادة، ويعمل من حسابك في أي وقت. المكتبة خاصة بك.
        </p>
        {laws.length > 0 && (
          <div className="toolbar full">
            <label className="search flex-1">
              <Search size={16} />
              <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setReading('') }} placeholder="ابحث بكلمة (تعويض، حجز) أو برقم المادة (226)…" />
            </label>
            <Select className="form-select roll-filter" value={lawId} onChange={(e) => setLawId(e.target.value)} aria-label="التشريع">
              <option value="">كل التشريعات ({laws.length})</option>
              {laws.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </Select>
          </div>
        )}
      </div>

      {laws.length === 0 ? (
        <div className="card">
          <Empty icon={Library} title="مكتبتك فارغة" text="أضف أول تشريع: الصق نصه أو ارفعه كملف نصي (.txt)." action={<button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>إضافة تشريع</button>} />
        </div>
      ) : query.trim() ? (
        <div className="card">
          <div className="card-head"><h2>النتائج <span className="count">{result.total}</span></h2>{result.total > result.hits.length && <span className="muted small">أول {result.hits.length}</span>}</div>
          {result.hits.length === 0 ? (
            <Empty icon={Search} title="لا توجد مواد مطابقة" text="جرّب كلمة أقصر أو بدون أل التعريف." />
          ) : (
            <ul className="art-list">
              {result.hits.map(({ law, article }, i) => (
                <li key={`${law.id}-${article.n}-${i}`}>
                  <div className="art-head">
                    <strong>مادة {article.n}</strong><span className="muted small">{law.title}</span>
                    <button type="button" className="icon-btn push" onClick={() => copyArticle(law, article)} aria-label="نسخ"><Copy size={14} /></button>
                  </div>
                  <p className="pre art-text"><Highlighted text={article.text} query={query} /></p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="two-col">
          <div className="card">
            <div className="card-head"><h2>تشريعاتك</h2></div>
            <ul className="dir-list">
              {laws.map((l) => (
                <li key={l.id} className={reading === l.id ? 'is-open' : ''}>
                  <button type="button" className="dir-main file-open" onClick={() => setReading(reading === l.id ? '' : l.id)}>
                    <strong>{l.title}</strong>
                    <span className="muted small">{l.article_count} مادة{l.note ? ` — ${l.note}` : ''}</span>
                  </button>
                  <button type="button" className="icon-btn danger" onClick={() => remove(l)} aria-label="حذف"><Trash2 size={15} /></button>
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            {readingLaw ? (
              <>
                <div className="card-head"><h2>{readingLaw.title}</h2></div>
                <ul className="art-list tall">
                  {readingLaw.articles.map((a, i) => (
                    <li key={`${a.n}-${i}`}>
                      <div className="art-head"><strong>مادة {a.n}</strong>
                        <button type="button" className="icon-btn push" onClick={() => copyArticle(readingLaw, a)} aria-label="نسخ"><Copy size={14} /></button>
                      </div>
                      <p className="pre art-text">{a.text}</p>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <Empty icon={Library} title="اختر تشريعاً للقراءة" text="أو ابحث بالأعلى في كل التشريعات معاً." />
            )}
          </div>
        </div>
      )}

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        wide
        title="إضافة تشريع"
        subtitle="الصق نص القانون (كل مادة تبدأ بسطر مثل: مادة (1) أو المادة 1)"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>إلغاء</button>
            <button type="submit" form="law-form" className="btn btn-primary" disabled={busy || !parsed.length}>
              {busy ? 'جارٍ الحفظ…' : parsed.length ? `حفظ (${parsed.length} مادة)` : 'حفظ'}
            </button>
          </>
        }
      >
        <form id="law-form" className="stack" onSubmit={save}>
          <div className="grid-2">
            <Field label="عنوان التشريع *">{(id) => <input id={id} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="القانون المدني — قانون 131 لسنة 1948" />}</Field>
            <Field label="المصدر / ملاحظة">{(id) => <input id={id} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="الوقائع المصرية — شامل التعديلات حتى 2023" />}</Field>
          </div>
          <div className="row-actions">
            <input ref={fileRef} type="file" accept=".txt,text/plain" hidden onChange={onFile} />
            <button type="button" className="btn btn-soft btn-sm" onClick={() => fileRef.current.click()}><Upload size={14} /> رفع ملف نصي (.txt)</button>
            {form.text && <span className="muted small">{parsed.length ? `تم التعرف على ${parsed.length} مادة` : 'لم يُتعرَّف على مواد بعد'}</span>}
          </div>
          <Field label="نص التشريع">
            {(id) => <textarea id={id} rows={14} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder={'مادة (1)\nنص المادة…\n\nمادة (2)\nنص المادة…'} />}
          </Field>
          {parsed.length > 0 && (
            <details className="more">
              <summary>معاينة أول المواد</summary>
              <ul className="small">{parsed.slice(0, 5).map((a, i) => <li key={i}><strong>مادة {a.n}:</strong> {a.text.slice(0, 90)}{a.text.length > 90 ? '…' : ''}</li>)}</ul>
            </details>
          )}
        </form>
      </Modal>
    </div>
  )
}
