import { useEffect, useState } from 'react'
import { CalendarDays, RefreshCw, Unlink, UserRound, Landmark, BarChart3, FileSpreadsheet, LogOut, ChevronLeft, Scale, Bell, BellOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCalendar } from '../context/CalendarContext'
import { useNotifications } from '../context/NotificationContext'
import { useToast } from '../context/ToastContext'
import { friendlyError } from '../lib/errors'
import { Field, PageHead } from '../components/ui'
import Select from '../components/Select'

const REMINDERS = [
  { value: 360, label: 'الساعة 6 مساءً في اليوم السابق' },
  { value: 900, label: 'الساعة 9 صباحاً في اليوم السابق' },
  { value: 1800, label: 'الساعة 6 مساءً قبلها بيومين' },
  { value: 0, label: 'منتصف ليل يوم الجلسة' },
]

export default function SettingsPage() {
  const { user, profile, updateProfile, signOut } = useAuth()
  const cal = useCalendar()
  const notif = useNotifications()
  const toast = useToast()
  const [form, setForm] = useState({ full_name: '', branch: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name || '', branch: profile.branch || '' })
  }, [profile])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfile({ full_name: form.full_name.trim() || null, branch: form.branch.trim() || null })
      toast('تم الحفظ')
    } catch (err) {
      toast(friendlyError(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  const setReminder = async (e) => {
    try {
      await updateProfile({ reminder_minutes: Number(e.target.value) })
      if (cal.enabled) cal.syncNow()
    } catch (err) {
      toast(friendlyError(err), 'error')
    }
  }

  return (
    <div className="page">
      <PageHead title="الإعدادات" />

      <nav className="card more-links show-sm-block" aria-label="صفحات أخرى">
        {[
          ['#rulings', Scale, 'الأحكام'],
          ['#circuits', Landmark, 'الدوائر'],
          ['#stats', BarChart3, 'الإحصائيات'],
          ['#excel', FileSpreadsheet, 'الإكسيل: استيراد وتصدير'],
        ].map(([href, Icon, label]) => (
          <a key={href} href={href}><Icon size={18} /> <span>{label}</span> <ChevronLeft size={16} className="push" /></a>
        ))}
        <button type="button" onClick={signOut}><LogOut size={18} /> <span>تسجيل الخروج</span></button>
      </nav>

      <div className="two-col">
        <form className="card pad" onSubmit={save}>
          <h2 className="card-title"><UserRound size={18} /> بياناتي</h2>
          <p className="muted small" dir="ltr">{user.email}</p>
          <div className="stack" style={{ width: '100%' }}>
            <Field label="الاسم كما يظهر في البرنامج">
              {(id) => <input id={id} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />}
            </Field>
            <Field label="الفرع">
              {(id) => <input id={id} value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} placeholder="فرع بورسعيد" />}
            </Field>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>حفظ</button>
        </form>

        <section className="card pad">
          <h2 className="card-title"><Bell size={18} /> التنبيهات</h2>
          <p className="muted small">
            الجرس في أعلى الصفحة يعرض لكل مستخدم ما يحتاج انتباهه: جلسات اليوم والغد، جلسات فاتت بلا قرار، متابعات
            مستحقة، ومواعيد طعن خلال أسبوع. ويمكنك تفعيل ملخص صباحي (بعد السابعة) وملخص مسائي بجلسات الغد (بعد الخامسة)
            على هذا الجهاز؛ ولتنبيهات تصلك والتطبيق مغلق استخدم تقويم جوجل بالأسفل.
          </p>
          {!notif.supported ? (
            <p className="inline-alert">هذا المتصفح لا يدعم التنبيهات. جرّب Chrome أو ثبّت البرنامج على الشاشة الرئيسية.</p>
          ) : notif.permission === 'denied' ? (
            <p className="inline-alert">التنبيهات محظورة لهذا الموقع. فعّلها من إعدادات المتصفح (علامة القفل بجوار العنوان) ثم أعد تحميل الصفحة.</p>
          ) : notif.enabled ? (
            <>
              <p className="inline-note">التنبيهات مفعّلة على هذا الجهاز.</p>
              <button type="button" className="btn btn-ghost" onClick={notif.disable}><BellOff size={16} /> إيقاف على هذا الجهاز</button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={notif.enable}><Bell size={16} /> تفعيل تنبيهات هذا الجهاز</button>
          )}
        </section>

        <section className="card pad">
          <h2 className="card-title"><CalendarDays size={18} /> تقويم جوجل والتنبيهات</h2>
          <p className="muted small">
            تُضاف الجلسات والمتابعات ومواعيد الطعن إلى تقويم منفصل اسمه «أجندة المستشار» في حساب جوجل
            الخاص بك، فيصلك تنبيه على الموبايل من تطبيق Google Calendar. أي تعديل في البرنامج يُحدِّث
            التقويم تلقائياً. البرنامج لا يرى ولا يغيّر باقي تقاويمك.
          </p>

          {!cal.available ? (
            <p className="inline-alert">ربط جوجل غير مفعّل بعد على هذا الخادم (ينقص VITE_GOOGLE_CLIENT_ID).</p>
          ) : (
            <>
              <Field label="موعد التنبيه">
                {(id) => (
                  <Select id={id} value={profile?.reminder_minutes ?? 360} onChange={setReminder}>
                    {REMINDERS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </Select>
                )}
              </Field>
              <p className="muted small">ومواعيد الطعن تنبّه أيضاً قبلها بثلاثة أيام.</p>

              {cal.status === 'error' && <p className="inline-alert">{cal.error}</p>}
              {cal.status === 'ok' && (
                <p className="inline-note">
                  تمت المزامنة: {cal.total} موعد في التقويم ({cal.changed} تغيير) — {cal.lastSync.toLocaleTimeString('ar-EG')}
                </p>
              )}

              <div className="row-actions">
                <button type="button" className="btn btn-primary" onClick={cal.syncNow} disabled={cal.status === 'syncing'}>
                  <RefreshCw size={16} className={cal.status === 'syncing' ? 'spin' : ''} />
                  {cal.enabled ? 'مزامنة الآن' : 'ربط تقويم جوجل'}
                </button>
                {cal.enabled && (
                  <button type="button" className="btn btn-ghost" onClick={cal.disconnect}>
                    <Unlink size={16} /> إيقاف المزامنة
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
