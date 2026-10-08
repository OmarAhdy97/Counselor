import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FolderOpen, Mail, Archive, ArchiveRestore, Gavel, Paperclip, Pencil, Printer, Trash2, Upload, X, CalendarClock, FileText } from 'lucide-react'
import { Drawer, StatusBadge, OutcomeBadge, DateCell, Badge } from './ui'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useUI } from '../context/UIContext'
import { friendlyError } from '../lib/errors'
import { caseTitle, circuitLabel } from '../lib/constants'
import { fmt, fmtLong, today } from '../lib/dates'

const ATTACHMENT_KINDS = ['مذكرة دفاع', 'رأي', 'صورة الحكم', 'حافظة مستندات', 'صحيفة', 'أخرى']

function Row({ label, children }) {
  if (children === null || children === undefined || children === '' || children === false) return null
  return (
    <div className="kv">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

const fileSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} م.ب` : `${Math.max(1, Math.round(n / 1024))} ك.ب`)

/** Printable report: everything about the case from registration to the last action. */
function CaseReport({ c, history, circuit, attachments, author }) {
  return (
    <div className="print-report" dir="rtl">
      <header>
        <h1>تقرير الدعوى {caseTitle(c)}</h1>
        <p>{c.court}{circuit ? ` — ${circuitLabel(circuit)}` : ''}</p>
        <p className="meta">أُعدّ بتاريخ {fmtLong(today())}{author ? ` — ${author}` : ''}</p>
      </header>
      <table className="report-kv">
        <tbody>
          <tr><th>المدعي</th><td>{c.plaintiff || '—'}</td><th>المدعى عليه</th><td>{c.defendant || '—'}</td></tr>
          <tr><th>نوع الدعوى</th><td>{c.case_type || '—'}</td><th>الحالة</th><td>{c.status || '—'}{c.archived_at ? ' (محفوظة بالأرشيف)' : ''}</td></tr>
          <tr><th>الجلسة القادمة</th><td>{c.next_session ? fmtLong(c.next_session) : '—'}</td><th>آخر قرار</th><td>{c.last_decision || '—'}</td></tr>
          <tr><th>المتابعة</th><td>{c.followup_date ? fmt(c.followup_date) : '—'}</td><th>المذكرات / النسخ</th><td>{[c.memos, c.copy_numbers].filter(Boolean).join(' — ') || '—'}</td></tr>
          <tr><th>تاريخ القيد بالأجندة</th><td>{fmt(c.created_at?.slice(0, 10))}</td><th>آخر تحديث</th><td>{fmt(c.updated_at?.slice(0, 10))}</td></tr>
        </tbody>
      </table>
      {c.notes && (<><h2>ملاحظات هامة</h2><p className="pre">{c.notes}</p></>)}
      {(c.ruling_text || c.ruling_outcome) && (
        <>
          <h2>الحكم</h2>
          <p>
            {c.ruling_date ? `بجلسة ${fmt(c.ruling_date)}` : ''} {c.ruling_number ? `— رقم القيد ${c.ruling_number}` : ''}
            {c.ruling_outcome ? ` — ${c.ruling_outcome}` : ''}
            {c.appeal_deadline ? ` — آخر ميعاد للطعن (تقديري) ${fmt(c.appeal_deadline)}` : ''}
            {c.appeal_decision ? ` — قرار الطعن: ${c.appeal_decision}` : ''}
          </p>
          {c.ruling_text && <p className="pre">{c.ruling_text}</p>}
          {c.appeal_note && <p>{c.appeal_note}</p>}
        </>
      )}
      <h2>سجل الجلسات ({history.length})</h2>
      {history.length ? (
        <table className="report-table">
          <thead><tr><th>م</th><th>تاريخ الجلسة</th><th>القرار</th><th>الجلسة التالية</th></tr></thead>
          <tbody>
            {[...history].reverse().map((s, i) => (
              <tr key={s.id}><td>{i + 1}</td><td>{fmtLong(s.session_date)}</td><td>{s.decision || '—'}</td><td>{s.next_date ? fmt(s.next_date) : '—'}</td></tr>
            ))}
          </tbody>
        </table>
      ) : <p>لا توجد جلسات مسجلة.</p>}
      {attachments.length > 0 && (
        <>
          <h2>المرفقات</h2>
          <ul>{attachments.map((a) => <li key={a.id}>{a.kind ? `${a.kind}: ` : ''}{a.name} — {fmt(a.created_at.slice(0, 10))}</li>)}</ul>
        </>
      )}
    </div>
  )
}

export default function CaseDetail({ caseId, onClose, onEdit, onRecord }) {
  const {
    cases, sessionsByCase, circuitsById, attachmentsByCase,
    deleteCase, deleteSession, archiveCase, unarchiveCase,
    uploadAttachment, openAttachment, deleteAttachment,
  } = useData()
  const { displayName } = useAuth()
  const { openTool } = useUI()
  const toast = useToast()
  const fileInput = useRef(null)
  const [kind, setKind] = useState(ATTACHMENT_KINDS[0])
  const [uploading, setUploading] = useState(false)
  const [printing, setPrinting] = useState(false)

  const c = cases.find((x) => x.id === caseId)
  if (!c) return null
  const history = sessionsByCase.get(c.id) || []
  const files = attachmentsByCase.get(c.id) || []
  const circuit = circuitsById.get(c.circuit_id)

  const guard = (fn, ok) => async (...args) => {
    try {
      await fn(...args)
      if (ok) toast(ok)
    } catch (err) {
      toast(friendlyError(err), 'error')
    }
  }

  const remove = async () => {
    if (!window.confirm(`حذف الدعوى ${caseTitle(c)} (${c.court}) وكل سجل جلساتها ومرفقاتها نهائياً؟\nللإخفاء فقط استخدم «أرشفة».`)) return
    await guard(async () => {
      for (const a of files) await deleteAttachment(a)
      await deleteCase(c.id)
      onClose()
    }, 'تم حذف الدعوى')()
  }

  const removeSession = async (s) => {
    if (!window.confirm(`حذف جلسة ${fmt(s.session_date)} من السجل؟ (لن تتغير بيانات الدعوى الحالية)`)) return
    await guard(() => deleteSession(s.id))()
  }

  const upload = async (e) => {
    const list = [...(e.target.files || [])]
    e.target.value = ''
    if (!list.length) return
    setUploading(true)
    try {
      for (const f of list) {
        if (f.size > 20 * 1048576) throw new Error(`الملف «${f.name}» أكبر من 20 م.ب`)
        await uploadAttachment(c.id, f, kind)
      }
      toast(list.length > 1 ? `تم رفع ${list.length} ملفات` : 'تم رفع الملف')
    } catch (err) {
      toast(friendlyError(err), 'error')
    } finally {
      setUploading(false)
    }
  }

  const printReport = () => {
    setPrinting(true)
    document.body.classList.add('printing-report')
    const done = () => {
      document.body.classList.remove('printing-report')
      setPrinting(false)
      window.removeEventListener('afterprint', done)
    }
    window.addEventListener('afterprint', done)
    setTimeout(() => window.print(), 50)
  }

  return (
    <Drawer open onClose={onClose} label={`الدعوى ${caseTitle(c)}`}>
      <header className="drawer-head">
        <div>
          <p className="eyebrow">{c.court}{circuit ? ` — ${circuitLabel(circuit)}` : ''}</p>
          <h2>{caseTitle(c)}</h2>
          <div className="badges">
            <StatusBadge status={c.status} />
            <OutcomeBadge outcome={c.ruling_outcome} />
            {c.archived_at && <Badge tone="slate">في الأرشيف</Badge>}
          </div>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق"><X size={18} /></button>
      </header>

      <div className="drawer-actions">
        {!c.archived_at && (
          <button type="button" className="btn btn-primary" onClick={() => onRecord(c)}>
            <Gavel size={16} /> {c.status === 'محجوز للتقرير' ? 'ورد التقرير / قرار' : 'تسجيل قرار الجلسة'}
          </button>
        )}
        <button type="button" className="btn btn-soft" onClick={() => onEdit(c)}>
          <Pencil size={16} /> تعديل
        </button>
        {c.archived_at ? (
          <button type="button" className="btn btn-soft" onClick={guard(() => unarchiveCase(c.id), 'تم إلغاء الحفظ وعادت الدعوى للعمل')}>
            <ArchiveRestore size={16} /> إلغاء الحفظ
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={guard(() => archiveCase(c.id), 'تم حفظ الدعوى في الأرشيف')} title="حفظ الملف في الأرشيف">
            <Archive size={16} /> أرشفة
          </button>
        )}
        <button type="button" className="icon-btn" onClick={printReport} aria-label="طباعة تقرير الدعوى" title="طباعة تقرير الدعوى">
          <Printer size={16} />
        </button>
        <button type="button" className="icon-btn danger" onClick={remove} aria-label="حذف الدعوى" title="حذف نهائي">
          <Trash2 size={16} />
        </button>
      </div>

      <div className="drawer-body">
        <div className="next-box">
          <CalendarClock size={18} />
          {c.next_session ? (
            <div>
              <strong>الجلسة القادمة: {fmtLong(c.next_session)}</strong>
              {c.last_decision && <span className="muted"> — {c.last_decision}</span>}
            </div>
          ) : (
            <div className="muted">لا توجد جلسة قادمة مسجلة{c.last_decision ? ` — آخر قرار: ${c.last_decision}` : ''}</div>
          )}
        </div>

        <div className="quick-docs no-print">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openTool('folder', c.id)}><FolderOpen size={14} /> حافظة مستندات</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openTool('letters', c.id)}><Mail size={14} /> خطاب للجهة</button>
        </div>

        <dl className="kv-list">
          <Row label="المدعي">{c.plaintiff}</Row>
          <Row label="المدعى عليه">{c.defendant}</Row>
          <Row label="نوع الدعوى">{c.case_type}</Row>
          <Row label="المتابعة">{c.followup_date && <DateCell value={c.followup_date} />}</Row>
          <Row label="ملاحظات هامة">{c.notes && <span className="pre">{c.notes}</span>}</Row>
          <Row label="المذكرات">{c.memos}</Row>
          <Row label="رقم النسخ">{c.copy_numbers}</Row>
        </dl>

        {(c.ruling_text || c.ruling_date || c.ruling_outcome) && (
          <section className="ruling-box">
            <h3>
              الحكم {c.ruling_date && <span className="muted">— {fmt(c.ruling_date)}</span>}
              {c.ruling_number && <span className="muted"> — قيد {c.ruling_number}</span>}
            </h3>
            {c.ruling_text && <p className="pre">{c.ruling_text}</p>}
            {c.appeal_deadline && (
              <p className="deadline">آخر ميعاد للطعن (تقديري): <DateCell value={c.appeal_deadline} /></p>
            )}
            <p className="deadline">
              قرار الطعن: {c.appeal_decision ? <Badge tone={c.appeal_decision === 'طعن' ? 'violet' : 'slate'}>{c.appeal_decision}</Badge> : <span className="muted">لم يُحدَّد — من «تعديل»</span>}
              {c.appeal_note && <span className="muted small">{c.appeal_note}</span>}
            </p>
          </section>
        )}

        <section>
          <div className="section-row">
            <h3 className="section-title"><Paperclip size={15} /> المرفقات {files.length > 0 && <span className="count">{files.length}</span>}</h3>
            <div className="upload-row">
              <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="نوع المرفق">
                {ATTACHMENT_KINDS.map((k) => <option key={k}>{k}</option>)}
              </select>
              <input ref={fileInput} type="file" multiple hidden onChange={upload} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic,.xlsx,.txt" />
              <button type="button" className="btn btn-soft btn-sm" onClick={() => fileInput.current.click()} disabled={uploading}>
                <Upload size={14} /> {uploading ? 'جارٍ الرفع…' : 'رفع'}
              </button>
            </div>
          </div>
          {files.length === 0 ? (
            <p className="muted small">ارفع مذكرات الدفاع أو الرأي أو صورة الحكم ليكون للملف أرشيف إلكتروني.</p>
          ) : (
            <ul className="files">
              {files.map((a) => (
                <li key={a.id}>
                  <button type="button" className="file-open" onClick={guard(() => openAttachment(a))}>
                    <FileText size={16} />
                    <span className="file-name">{a.name}</span>
                    <span className="muted small">{a.kind ? `${a.kind} · ` : ''}{a.size ? fileSize(a.size) : ''} · {fmt(a.created_at.slice(0, 10))}</span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="حذف المرفق"
                    onClick={() => window.confirm(`حذف «${a.name}» نهائياً؟`) && guard(() => deleteAttachment(a), 'تم حذف المرفق')()}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="section-title">سجل الجلسات</h3>
          {history.length === 0 ? (
            <p className="muted small">لا توجد جلسات مسجلة بعد. كل قرار تسجله من «تسجيل قرار الجلسة» يظهر هنا.</p>
          ) : (
            <ol className="timeline">
              {history.map((s) => (
                <li key={s.id}>
                  <div className="tl-date">{fmtLong(s.session_date)}</div>
                  <div className="tl-text">
                    {s.decision || <span className="muted">بدون قرار مسجل</span>}
                    {s.next_date && <span className="muted"> ← {fmt(s.next_date)}</span>}
                  </div>
                  <button type="button" className="icon-btn tl-del" onClick={() => removeSession(s)} aria-label="حذف من السجل">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {printing && createPortal(
        <CaseReport c={c} history={history} circuit={circuit} attachments={files} author={displayName} />,
        document.body
      )}
    </Drawer>
  )
}
