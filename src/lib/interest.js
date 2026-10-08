import { daysBetween } from './dates'

export const INTEREST_RATES = [
  { value: 4, label: '4% — المسائل المدنية (م 226 مدني)' },
  { value: 5, label: '5% — المسائل التجارية (م 226 مدني)' },
]

/**
 * Simple statutory interest (no compounding, م 232 مدني) from the judicial claim date to the
 * end date. When `capAtPrincipal` is set the total never exceeds the principal (م 232 مدني).
 */
export function legalInterest({ principal, rate, from, to, capAtPrincipal = true }) {
  const p = Number(principal)
  const r = Number(rate)
  if (!(p > 0) || !(r > 0) || !from || !to || to < from) return null
  const days = daysBetween(from, to)
  const raw = (p * r * days) / (100 * 365)
  const interest = capAtPrincipal ? Math.min(raw, p) : raw
  const round = (x) => Math.round(x * 100) / 100
  return {
    days,
    years: round(days / 365),
    interest: round(interest),
    capped: capAtPrincipal && raw > p,
    perDay: round((p * r) / (100 * 365)),
    total: round(p + interest),
  }
}
