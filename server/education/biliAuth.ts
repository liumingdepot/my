/**
 * B 站公共鉴权：反爬 Cookie、WBI 签名、统一 JSON 抓取。
 * 本地 Node 直连 B 站 API。
 */

import { createHmac } from 'node:crypto'

export const REFERER = 'https://www.bilibili.com/'
export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export const ANTI_CRAWL_MSG = 'B 站风控拦截，请稍后重试'

export class AntiCrawlError extends Error {
  constructor(message = ANTI_CRAWL_MSG) {
    super(message)
    this.name = 'AntiCrawlError'
  }
}

const FALLBACK_BUVID3 = 'FE6D3664-927F-F75B-B7D4-733E5D4B263F69428infoc'

const mixinKeyEncTab = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14,
  39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56,
  59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
]

function getMixinKey(orig: string) {
  return mixinKeyEncTab
    .map((n) => orig[n] ?? '')
    .join('')
    .slice(0, 32)
}

async function fetchUpstream(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  if (!headers.has('accept-encoding')) {
    headers.set('accept-encoding', 'identity')
  }
  return fetch(url, {
    ...init,
    method: init?.method ?? 'GET',
    headers,
    signal: init?.signal ?? AbortSignal.timeout(20_000),
  })
}

async function fetchUpstreamText(url: string, init?: RequestInit) {
  const res = await fetchUpstream(url, init)
  const text = await res.text()
  if (!res.ok) throw new Error(`upstream ${res.status}`)
  return text
}

/** 纯 JS MD5：Web Crypto / 部分运行时的 node:crypto polyfill 都不支持 MD5 */
function md5Hex(text: string): string {
  const bytes = new TextEncoder().encode(text)
  const bitLen = bytes.length * 8
  const withOne = new Uint8Array(((bytes.length + 9 + 63) & ~63))
  withOne.set(bytes)
  withOne[bytes.length] = 0x80
  const view = new DataView(withOne.buffer)
  view.setUint32(withOne.length - 8, bitLen >>> 0, true)
  view.setUint32(withOne.length - 4, Math.floor(bitLen / 0x100000000), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
    20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10,
    15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ]
  const K = new Uint32Array(64)
  for (let i = 0; i < 64; i += 1) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000)

  const rotl = (x: number, c: number) => (x << c) | (x >>> (32 - c))

  for (let offset = 0; offset < withOne.length; offset += 64) {
    const M = new Uint32Array(16)
    for (let i = 0; i < 16; i += 1) M[i] = view.getUint32(offset + i * 4, true)

    let A = a0
    let B = b0
    let C = c0
    let D = d0

    for (let i = 0; i < 64; i += 1) {
      let F: number
      let g: number
      if (i < 16) {
        F = (B & C) | (~B & D)
        g = i
      } else if (i < 32) {
        F = (D & B) | (~D & C)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        F = B ^ C ^ D
        g = (3 * i + 5) % 16
      } else {
        F = C ^ (B | ~D)
        g = (7 * i) % 16
      }
      F = (F + A + K[i]! + M[g]!) >>> 0
      A = D
      D = C
      C = B
      B = (B + rotl(F, S[i]!)) >>> 0
    }

    a0 = (a0 + A) >>> 0
    b0 = (b0 + B) >>> 0
    c0 = (c0 + C) >>> 0
    d0 = (d0 + D) >>> 0
  }

  const out = new Uint8Array(16)
  const outView = new DataView(out.buffer)
  outView.setUint32(0, a0, true)
  outView.setUint32(4, b0, true)
  outView.setUint32(8, c0, true)
  outView.setUint32(12, d0, true)
  return Array.from(out, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function md5(text: string) {
  return md5Hex(text)
}

function hmacSha256Hex(key: string, message: string) {
  return createHmac('sha256', key).update(message, 'utf8').digest('hex')
}

export async function fetchBiliJson(url: string, options?: RequestInit) {
  let text: string
  try {
    text = await fetchUpstreamText(url, options)
  } catch (error) {
    // 网络/超时等原样抛出，勿一律吞成风控
    if (error instanceof Error && !error.message.includes(ANTI_CRAWL_MSG)) {
      throw error
    }
    throw new AntiCrawlError()
  }

  if (text.trim().startsWith('<')) {
    throw new AntiCrawlError()
  }

  let json: { code?: number; message?: string; data?: unknown }
  try {
    json = JSON.parse(text) as { code?: number; message?: string; data?: unknown }
  } catch {
    throw new AntiCrawlError()
  }

  if (json.code === -352) throw new AntiCrawlError()
  return json
}

export async function getAntiCrawlCookie() {
  let buvid3 = FALLBACK_BUVID3
  let buvid4: string | null = null

  try {
    const text = await fetchUpstreamText('https://api.bilibili.com/x/frontend/finger/spi', {
      headers: { 'User-Agent': UA },
    })
    const json = JSON.parse(text) as { data?: { b_3?: string; b_4?: string } }
    if (json.data?.b_3) buvid3 = json.data.b_3
    if (json.data?.b_4) buvid4 = json.data.b_4
  } catch {
    /* keep fallback */
  }

  let ticket: string | null = null
  try {
    const ts = Math.floor(Date.now() / 1000)
    const hexsign = await hmacSha256Hex('XgwSnGZ1p', `ts${ts}`)
    const ticketUrl = `https://api.bilibili.com/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket?key_id=ec02&hexsign=${hexsign}&context[ts]=${ts}&csrf=`
    const res = await fetchUpstream(ticketUrl, {
      method: 'POST',
      headers: { 'User-Agent': UA },
    })
    const json = (await res.json()) as { data?: { ticket?: string } }
    if (json.data?.ticket) ticket = json.data.ticket
  } catch {
    /* degrade */
  }

  const parts = [`buvid3=${buvid3}`]
  if (buvid4) parts.push(`buvid4=${buvid4}`)
  if (ticket) parts.push(`bili_ticket=${ticket}`)
  return parts.join('; ')
}

export function mergeCookie(adminCookie: string, antiCrawl: string) {
  const admin = adminCookie.trim()
  if (!admin) return antiCrawl
  return `${antiCrawl}; ${admin}`
}

export async function buildBiliCookie(adminCookie = '') {
  const antiCrawl = await getAntiCrawlCookie()
  return mergeCookie(adminCookie, antiCrawl)
}

export async function getMixinKeyFromNav(cookie: string) {
  const json = await fetchBiliJson('https://api.bilibili.com/x/web-interface/nav', {
    headers: { 'User-Agent': UA, Referer: REFERER, Cookie: cookie },
  })
  const data = json.data as { wbi_img?: { img_url?: string; sub_url?: string } } | undefined
  const img = data?.wbi_img?.img_url?.split('/').pop()?.split('.')[0] ?? ''
  const sub = data?.wbi_img?.sub_url?.split('/').pop()?.split('.')[0] ?? ''
  return getMixinKey(img + sub)
}

/** WBI 签名；返回完整 query（含 wts / w_rid） */
export async function signWbi(
  params: Record<string, string | number>,
  cookie: string,
  mixinKey?: string,
) {
  const mixin_key = mixinKey ?? (await getMixinKeyFromNav(cookie))
  const curr: Record<string, string | number> = {
    ...params,
    wts: Math.floor(Date.now() / 1000),
  }
  // 官方约定：过滤 !'()*
  for (const [k, v] of Object.entries(curr)) {
    if (typeof v === 'string') curr[k] = v.replace(/[!'()*]/g, '')
  }
  const query = Object.keys(curr)
    .sort()
    .map((k) => `${k}=${encodeURIComponent(String(curr[k]))}`)
    .join('&')
  return `${query}&w_rid=${await md5(query + mixin_key)}`
}

export async function appSign(
  params: Record<string, string>,
  appkey: string,
  appsec: string,
) {
  const all: Record<string, string> = { ...params, appkey }
  const query = Object.keys(all)
    .sort()
    .map((k) => `${k}=${encodeURIComponent(all[k]!)}`)
    .join('&')
  return `${query}&sign=${await md5(query + appsec)}`
}

export function biliHeaders(cookie: string): Record<string, string> {
  return {
    'User-Agent': UA,
    Referer: REFERER,
    Origin: 'https://www.bilibili.com',
    Cookie: cookie,
  }
}
