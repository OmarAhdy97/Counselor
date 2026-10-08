import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Archive, ArchiveRestore, FolderOpen, Gavel, Mail, Paperclip, Pencil, Printer, Trash2, Upload, FileText,
} from 'lucide-react'
import { Modal, StatusChip, OutcomeBadge, DateCell, Badge, Segmented } from './ui'
import Select from './Select'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useUI } from '../context/UIContext'
import { friendlyError } from '../lib/errors'
import { caseTitle, circuitLabel } from '../lib/constants'
import { fmt, fmtLong, today } from '../lib/dates'

const ATTACHMENT_KINDS = ['مذكرة دفاع', 'رأي', 'صورة الحكم', 'حافظة مستندات', 'صحيفة', 'أخرى']
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

/** The case popup: a centred dialog with the facts, the actions, and the session log / files in tabs. */
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
  const [tab, setTab] = useState('log')
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

  const facts = [
    ['المحكمة', [c.court, circuit && circuitLabel(circuit)].filter(Boolean).join(' — ')],
    ['نوع الدعوى', c.case_type],
    ['المدعي', c.plaintiff],
    ['المدعى عليه', c.defendant],
    ['الجلسة القادمة', c.next_session ? fmtLong(c.next_session) : ''],
    ['آخر قرار', c.last_decision],
    ['المتابعة', c.followup_date ? <DateCell value={c.followup_date} /> : ''],
    ['المذكرات', c.memos],
    ['رقم النسخ', c.copy_numbers],
  ].filter(([, v]) => v)

  return (
    <Modal
      open
      onClose={onClose}
      wide
      className="case-dialog"
      ariaLabel={`الدعوى ${caseTitle(c)}`}
      title={
        <span className="case-dialog-title">
          <span>قضية {caseTitle(c)}</span>
          <StatusChip status={c.status} />
          <OutcomeBadge outcome={c.ruling_outcome} status={c.status} />
          {c.archived_at && <Badge tone="slate">في الأرشيف</Badge>}
        </span>
      }
    >
      <div className="case-dialog-body">
        <dl className="facts">
          {facts.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>

        {c.notes && (
          <div className="note-box">
            <strong>ملاحظات هامة</strong>
            <p className="pre">{c.notes}</p>
          </div>
        )}

        {(c.ruling_text || c.ruling_date || c.ruling_number || c.appeal_deadline) && (
          <section className="ruling-box">
            <h3>
              الحكم {c.ruling_date && <span className="muted">— {fmt(c.ruling_date)}</span>}
              {c.ruling_number && <span className="muted"> — قيد {c.ruling_number}</span>}
            </h3>
            {c.ruling_text && <p className="pre">{c.ruling_text}</p>}
            <p className="deadline">
              {c.appeal_deadline && <>آخر ميعاد للطعن (تقديري): <DateCell value={c.appeal_deadline} /></>}
              <span>
                قرار الطعن:{' '}
                {c.appeal_decision
                  ? <Badge tone={c.appeal_decision === 'طعن' ? 'violet' : 'slate'}>{c.appeal_decision}</Badge>
                  : <span className="muted">لم يُحدَّد — من «تعديل»</span>}
              </span>
              {c.appeal_note && <span className="muted small">{c.appeal_note}</span>}
            </p>
          </section>
        )}

        <div className="case-dialog-actions">
          {!c.archived_at && (
            <button type="button" className="btn btn-primary" onClick={() => onRecord(c)}>
              <Gavel size={16} /> {c.status === 'محجوز للتقرير' ? 'ورد التقرير / قرار' : 'تسجيل قرار الجلسة'}
            </button>
          )}
          <button type="button" className="btn btn-soft" onClick={() => onEdit(c)}><Pencil size={16} /> تعديل</button>
          {c.archived_at ? (
            <button type="button" className="btn btn-soft" onClick={guard(() => unarchiveCase(c.id), 'تم إلغاء الحفظ وعادت الدعوى للعمل')}>
              <ArchiveRestore size={16} /> إلغاء الحفظ
            </button>
          ) : (
            <button type="button" className="btn btn-soft" onClick={guard(() => archiveCase(c.id), 'تم حفظ الدعوى في الأرشيف')}>
              <Archive size={16} /> أرشفة
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openTool('folder', c.id)}><FolderOpen size={16} /> حافظة</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openTool('letters', c.id)}><Mail size={16} /> خطاب</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={printReport}><Printer size={16} /> تقرير</button>
          <button type="button" className="btn btn-ghost btn-sm danger" onClick={remove} aria-label="حذف الدعوى"><Trash2 size={16} /></button>
        </div>

        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'log', label: 'سجل الجلسات', count: history.length },
            { value: 'files', label: 'المرفقات', count: files.length },
          ]}
        />

        {tab === 'log' && (
          history.length === 0 ? (
            <p className="empty-line">لا توجد جلسات مسجلة بعد. كل قرار تسجله من «تسجيل قرار الجلسة» يظهر هنا.</p>
          ) : (
            <ol className="tl">
              {history.map((s) => (
                <li key={s.id} className="tl-item">
                  <div className="tl-head">
                    <strong>{s.decision || 'بدون قرار مسجل'}</strong>
                    <span className="tl-badge">{fmtLong(s.session_date)}</span>
                  </div>
                  {s.next_date && <p className="tl-line"><span>الجلسة التالية:</span> {fmtLong(s.next_date)}</p>}
                  <button type="button" className="icon-btn tl-del" onClick={() => removeSession(s)} aria-label="حذف من السجل">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ol>
          )
        )}

        {tab === 'files' && (
          <section>
            <div className="section-row">
              <h3 className="section-title"><Paperclip size={15} /> المرفقات</h3>
              <div className="upload-row">
                <Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="نوع المرفق" className="form-select upload-kind">
                  {ATTACHMENT_KINDS.map((k) => <option key={k}>{k}</option>)}
                </Select>
                <input ref={fileInput} type="file" multiple hidden onChange={upload} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic,.xlsx,.txt" />
                <button type="button" className="btn btn-soft btn-sm" onClick={() => fileInput.current.click()} disabled={uploading}>
                  <Upload size={14} /> {uploading ? 'جارٍ الرفع…' : 'رفع'}
                </button>
              </div>
            </div>
            {files.length === 0 ? (
              <p className="empty-line">ارفع مذكرات الدفاع أو الرأي أو صورة الحكم ليكون للملف أرشيف إلكتروني.</p>
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
        )}
      </div>

      {printing && createPortal(
        <CaseReport c={c} history={history} circuit={circuit} attachments={files} author={displayName} />,
        document.body
      )}
    </Modal>
  )
}
