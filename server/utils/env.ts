import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { useRuntimeConfig } from 'nitro/runtime-config'
import { parseAgnesKeys } from '../fortune/agnesKeyParse.js'
import { DB } from './db.js'

const MODULE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

let cachedAgnesKey: string | null = null

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

/** 从项目根 .env 读取（长逗号分隔 key 最稳妥） */
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

function pickRichestKeySource(...candidates: string[]) {
  const usable = candidates.map(stripQuotes).filter(Boolean)
  if (!usable.length) return ''
  usable.sort((a, b) => parseAgnesKeys(b).length - parseAgnesKeys(a).length)
  return usable[0] || ''
}

function readAgnesApiKey() {
  if (cachedAgnesKey != null) return cachedAgnesKey

  const fromFile = readEnvFileValue('AGNES_API_KEY')
  const fromProcess = stripQuotes(process.env.AGNES_API_KEY || '')
  let fromRuntime = ''
  try {
    fromRuntime = stripQuotes(String(useRuntimeConfig().agnesApiKey || ''))
  } catch {
    /* not in nitro request context */
  }

  // 优先选 key 数量最多的来源，避免 process.env 只注入了第一个 key
  const chosen = pickRichestKeySource(fromFile, fromProcess, fromRuntime)
  cachedAgnesKey = chosen
  const count = parseAgnesKeys(chosen).length
  console.info(`[env] AGNES_API_KEY loaded: ${count} key(s)`)
  return chosen
}

export function getAppEnv() {
  return {
    DB,
    AGNES_API_KEY: readAgnesApiKey(),
  }
}

export type AppEnv = ReturnType<typeof getAppEnv>
