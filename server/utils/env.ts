import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { useRuntimeConfig } from 'nitro/runtime-config'
import { DB } from './db.js'

const MODULE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

let cachedBiliCookie: string | null = null

function stripQuotes(value: string) {
  const text = value.trim()
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1).trim()
  }
  return text
}

/** 从项目根 .env 读取 */
function readEnvFileValue(name: string): string {
  const candidates = [path.join(process.cwd(), '.env'), path.join(MODULE_ROOT, '.env')]
  for (const envPath of candidates) {
    try {
      if (!fs.existsSync(envPath)) continue
      for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq <= 0) continue
        const key = trimmed.slice(0, eq).trim()
        if (key !== name) continue
        return stripQuotes(trimmed.slice(eq + 1))
      }
    } catch {
      /* try next */
    }
  }
  return ''
}

/** 读 nitro runtimeConfig；不在请求上下文（如 CLI 脚本）时返回空串 */
function readRuntimeConfigValue(key: string): string {
  try {
    // oxlint-disable-next-line react-hooks/rules-of-hooks -- nitro 的 useRuntimeConfig，非 React Hook
    return stripQuotes(String(useRuntimeConfig()[key] ?? ''))
  } catch {
    return ''
  }
}

/** B 站登录 Cookie：可选，仅增强 Web WBI 线路；缺省时只用 anti-crawl 自动 cookie */
function readBiliCookie() {
  if (cachedBiliCookie != null) return cachedBiliCookie

  cachedBiliCookie =
    readEnvFileValue('BILI_COOKIE') ||
    stripQuotes(process.env.BILI_COOKIE || '') ||
    readRuntimeConfigValue('biliCookie')
  return cachedBiliCookie
}

export function getAppEnv() {
  return {
    DB,
    BILI_COOKIE: readBiliCookie(),
  }
}

export type AppEnv = ReturnType<typeof getAppEnv>
