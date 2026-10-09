export const fmtW = (n?: number) => {
  if (!n) return ''
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '亿'
  if (n >= 1e4) return Math.round(n / 1e4) + '万'
  return String(n)
}

export const fmtT = (s?: number) => {
  const n = Math.max(0, Math.floor(s || 0))
  const m = Math.floor(n / 60)
  return m + ':' + String(n % 60).padStart(2, '0')
}

export const catStr = (v: unknown) =>
  typeof v === 'string'
    ? v
    : Array.isArray(v)
      ? v.filter((x) => typeof x === 'string').join('/')
      : ''

export const catDots = (v: unknown, n = 3) =>
  catStr(v)
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, n)
    .join(' · ')
