// Times are UTC ISO 8601 strings; each one is shown in the zone of its own place (architecture 12.6).

const DISPLAY_LOCALE = 'en-US'

function parts(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions) {
  const out: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {}
  const formatter = new Intl.DateTimeFormat(DISPLAY_LOCALE, { timeZone, ...options })
  for (const p of formatter.formatToParts(date)) out[p.type] = p.value
  return out
}

/** "Tue, Nov 3 · 3:40 PM CST", in the given IANA zone. */
export function formatTime(utc: string, timeZone: string): string {
  const p = parts(new Date(utc), timeZone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  })
  return `${p.weekday}, ${p.month} ${p.day} · ${p.hour}:${p.minute} ${p.dayPeriod} ${p.timeZoneName}`
}

/** "CST", "EST", "AKST"; Newfoundland gives "GMT-3:30". */
export function zoneAbbreviation(utc: string, timeZone: string): string {
  return parts(new Date(utc), timeZone, { timeZoneName: 'short' }).timeZoneName ?? timeZone
}

/** Wall time in the zone as "YYYY-MM-DDTHH:mm", the format of a datetime-local field. */
export function nowInZone(timeZone: string, now: Date = new Date()): string {
  const p = parts(now, timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

/**
 * The next quarter hour after `now` as wall time in the zone ("YYYY-MM-DDTHH:mm"), for the
 * departure field's default (design 4.2). The wall time is stepped as plain clock numbers, so a
 * daylight-saving switch inside the next 15 minutes is the only case it can be off.
 */
export function nextQuarterHour(timeZone: string, now: Date = new Date(), stepMin = 15): string {
  const wall = nowInZone(timeZone, now) // "YYYY-MM-DDTHH:mm"
  const asUtc = Date.parse(`${wall}:00Z`)
  const stepMs = stepMin * 60_000
  const next = Math.floor(asUtc / stepMs) * stepMs + stepMs
  return new Date(next).toISOString().slice(0, 16)
}
