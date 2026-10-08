/** Turns Supabase/network errors into a sentence the counselor can act on. */
export function friendlyError(err) {
  const msg = err?.message || String(err)
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'لا يوجد اتصال بالإنترنت أو الخادم لا يستجيب. حاول مرة أخرى.'
  if (/duplicate key|unique/i.test(msg)) return 'هذه الدعوى مسجلة بالفعل (نفس المحكمة والرقم والسنة).'
  if (/Invalid login credentials/i.test(msg)) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
  if (/Email not confirmed/i.test(msg)) return 'لم يتم تأكيد البريد الإلكتروني بعد. افتح رسالة التأكيد في بريدك.'
  if (/JWT|session/i.test(msg)) return 'انتهت الجلسة، سجّل الدخول مرة أخرى.'
  return msg
}
