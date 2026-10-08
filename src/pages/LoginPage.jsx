import { useState } from 'react'
import { Scale } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { friendlyError } from '../lib/errors'
import { Field } from '../components/ui'

export default function LoginPage() {
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const [mode, setMode] = useState('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'in') await signIn(email.trim(), password)
      else {
        const data = await signUp(email.trim(), password, name.trim())
        if (!data.session) setMsg({ tone: 'ok', text: 'تم إنشاء الحساب. افتح رسالة التأكيد في بريدك ثم سجّل الدخول.' })
      }
    } catch (err) {
      setMsg({ tone: 'error', text: friendlyError(err) })
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setMsg(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      setMsg({ tone: 'error', text: friendlyError(err) })
    }
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="brand brand-lg">
          <span className="brand-mark"><Scale size={22} /></span>
          <div>
            <strong>أجندة المستشار</strong>
            <span className="muted small">الجلسات والمتابعات والأحكام</span>
          </div>
        </div>

        <button type="button" className="btn btn-google btn-block" onClick={google}>
          <GoogleMark /> الدخول بحساب جوجل (Gmail)
        </button>
        <div className="or"><span>أو بالبريد وكلمة المرور</span></div>

        {mode === 'up' && (
          <Field label="الاسم كما يظهر في البرنامج">
            {(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} required />}
          </Field>
        )}
        <Field label="البريد الإلكتروني">
          {(id) => <input id={id} type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
        </Field>
        <Field label="كلمة المرور">
          {(id) => (
            <input id={id} type="password" dir="ltr" minLength={mode === 'up' ? 8 : undefined}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              value={password} onChange={(e) => setPassword(e.target.value)} required />
          )}
        </Field>

        {msg && <p className={msg.tone === 'error' ? 'inline-alert' : 'inline-note'}>{msg.text}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? '…' : mode === 'in' ? 'دخول' : 'إنشاء الحساب'}
        </button>
        <button type="button" className="link center" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null) }}>
          {mode === 'in' ? 'ليس لديك حساب؟ إنشاء حساب' : 'لديك حساب؟ تسجيل الدخول'}
        </button>
      </form>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
