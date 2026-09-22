import { Lunar, LunarYear, Solar } from 'lunar-javascript'

export type CalendarMode = 'solar' | 'lunar'

export type BirthParts = {
  year: number
  month: number
  day: number
}

const SHANGHAI = 'Asia/Shanghai'

const SHICHEN_HOUR: Record<string, number> = {
  子时: 23,
  丑时: 1,
  寅时: 3,
  卯时: 5,
  辰时: 7,
  巳时: 9,
  午时: 11,
  未时: 13,
  申时: 15,
  酉时: 17,
  戌时: 19,
  亥时: 21,
}

const LUNAR_MONTH = ['', '正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊']

export function lunarMonthLabel(month: number) {
  const name = LUNAR_MONTH[Math.abs(month)] ?? String(Math.abs(month))
  return `${month < 0 ? '闰' : ''}${name}月`
}

export function lunarDayLabel(day: number) {
  const digit = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  if (day <= 10) return `初${day === 10 ? '十' : digit[day]}`
  if (day < 20) return `十${digit[day - 10]}`
  if (day === 20) return '二十'
  if (day < 30) return `廿${digit[day - 20]}`
  return '三十'
}

export function lunarMonths(year: number) {
  return LunarYear.fromYear(year)
    .getMonthsInYear()
    .map((month) => {
      const value = month.getMonth()
      return {
        value,
        days: month.getDayCount(),
        label: lunarMonthLabel(value),
      }
    })
}

export function solarToLunar(parts: BirthParts): BirthParts | null {
  if (!isSolarDate(parts)) return null
  const lunar = Solar.fromYmd(parts.year, parts.month, parts.day).getLunar()
  return { year: lunar.getYear(), month: lunar.getMonth(), day: lunar.getDay() }
}

export function lunarToSolar(parts: BirthParts): BirthParts | null {
  try {
    const solar = Lunar.fromYmd(parts.year, parts.month, parts.day).getSolar()
    const next = { year: solar.getYear(), month: solar.getMonth(), day: solar.getDay() }
    return isSolarDate(next) ? next : null
  } catch {
    return null
  }
}

export function toTimestamp(mode: CalendarMode, parts: BirthParts, shichen: string) {
  const hour = SHICHEN_HOUR[shichen]
  if (hour == null) return null
  const solar = mode === 'lunar' ? lunarToSolar(parts) : isSolarDate(parts) ? parts : null
  if (!solar) return null
  return shanghaiWallTimeToTimestamp(solar.year, solar.month, solar.day, hour)
}

function shanghaiWallTimeToTimestamp(year: number, month: number, day: number, hour: number) {
  const wall = Date.UTC(year, month - 1, day, hour, 0, 0, 0)
  const utc = wall - shanghaiOffsetMs(wall)
  return wall - shanghaiOffsetMs(utc)
}

function shanghaiOffsetMs(utcMs: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SHANGHAI,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utcMs))
  const pick = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((item) => item.type === type)?.value ?? ''
    return value === '24' ? 0 : Number(value)
  }
  const asUtc = Date.UTC(pick('year'), pick('month') - 1, pick('day'), pick('hour'), pick('minute'), pick('second'))
  return asUtc - utcMs
}

export function solarPartsFromTimestamp(timestamp: number): BirthParts | null {
  if (!Number.isFinite(timestamp)) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SHANGHAI,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date(timestamp))
  const pick = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value)
  const year = pick('year')
  const month = pick('month')
  const day = pick('day')
  if (!year || !month || !day) return null
  return { year, month, day }
}

export function formatDateLabel(mode: CalendarMode, parts: BirthParts) {
  if (mode === 'lunar') {
    return `农历${parts.year}年${lunarMonthLabel(parts.month)}${lunarDayLabel(parts.day)}`
  }
  return `${parts.year}年${parts.month}月${parts.day}日`
}

export function formatBazi(mode: CalendarMode, parts: BirthParts, shichen: string, timestamp: number) {
  const picked = formatDateLabel(mode, parts)
  if (mode === 'solar') return `${picked} ${shichen}`
  const solar = solarPartsFromTimestamp(timestamp)
  if (!solar) return `${picked} ${shichen}`
  return `${picked}（公历${solar.year}年${solar.month}月${solar.day}日） ${shichen}`
}

function isSolarDate(parts: BirthParts) {
  if (!Number.isInteger(parts.year) || !Number.isInteger(parts.month) || !Number.isInteger(parts.day)) return false
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  return date.getUTCFullYear() === parts.year && date.getUTCMonth() === parts.month - 1 && date.getUTCDate() === parts.day
}
