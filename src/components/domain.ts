export type DomainEntry = {
  host: string
  /** 完整地址；缺省为 https://host/ */
  href?: string
  primary?: boolean
  /** 局域网本地调试入口 */
  local?: boolean
}

/** 主要 + 备用域名，以及本地调试入口 */
export const DOMAINS: DomainEntry[] = [
  { host: 'www.liuming1994.qzz.io', primary: true },
  { host: 'www.liuming1234.xyz' },
  { host: 'www.liuming1994.cc.cd' },
  { host: 'www.liuming1994.ccwu.cc' },
  { host: 'www.liuming1994.dpdns.org' },
  { host: 'www.liuming1994.us.ci' },
  { host: '192.168.0.233:10010', href: 'http://192.168.0.233:10010/', local: true },
]

/** 切到目标域名，并保留当前 path / search / hash（如 /works） */
export function toHref(domain: DomainEntry) {
  const base = domain.href ?? `https://${domain.host}/`
  if (typeof window === 'undefined') return base
  const url = new URL(base)
  url.pathname = window.location.pathname
  url.search = window.location.search
  url.hash = window.location.hash
  return url.href
}

/** 短名称：主站 / 备用 / 本地 */
export function domainTag(domain: DomainEntry) {
  if (domain.primary) return '主站'
  if (domain.local) return '本地'
  return '备用'
}

/** 列表角标：主站 / 备用 xyz / 本地 */
export function domainBadge(domain: DomainEntry) {
  const tag = domainTag(domain)
  return domain.primary || domain.local ? tag : `${tag} ${shortDomain(domain.host)}`
}

/** 域名后缀：liuming1234.xyz → xyz，liuming1994.cc.cd → cc.cd */
export function shortDomain(host: string) {
  const labels = host.replace(/^www\./, '').split('.')
  return labels.length > 2 ? labels.slice(-2).join('.') : labels[labels.length - 1]
}

/** 当前正在访问的域名（未命中列表时返回 undefined；含端口，如 192.168.0.233:10010） */
export function currentDomain() {
  if (typeof window === 'undefined') return undefined
  const host = window.location.host.toLowerCase()
  return DOMAINS.find((domain) => domain.host.toLowerCase() === host)
}