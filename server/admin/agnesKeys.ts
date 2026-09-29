import type { AppDb } from '../utils/db.js'

export const AGNES_BASE_CN = 'https://api.agnes-ai.cn/v1'
export const AGNES_BASE_INTL = 'https://apihub.agnes-ai.com/v1'

export const AGNES_BASE_OPTIONS = [
  { label: '中国', value: AGNES_BASE_CN },
  { label: '国际', value: AGNES_BASE_INTL },
] as const

export type AgnesBaseUrl = (typeof AGNES_BASE_OPTIONS)[number]['value']

export type AgnesApiKeyRow = {
  id: string
  api_key: string
  base_url: string
  enabled: number
  created_at: string
  updated_at: string
}

export type PublicAgnesApiKey = {
  id: string
  apiKey: string
  apiKeyMasked: string
  baseUrl: string
  baseLabel: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type AgnesCredential = {
  id: string
  apiKey: string
  baseUrl: string
}

function nowIso() {
  return new Date().toISOString()
}

export function isAgnesBaseUrl(value: unknown): value is AgnesBaseUrl {
  return value === AGNES_BASE_CN || value === AGNES_BASE_INTL
}

export function baseLabel(baseUrl: string) {
  if (baseUrl === AGNES_BASE_INTL) return '国际'
  return '中国'
}

export function maskApiKey(apiKey: string) {
  const key = apiKey.trim()
  if (key.length <= 10) return `${key.slice(0, 3)}***`
  return `${key.slice(0, 6)}…${key.slice(-4)}`
}

export function toPublicAgnesApiKey(row: AgnesApiKeyRow): PublicAgnesApiKey {
  return {
    id: row.id,
    apiKey: row.api_key,
    apiKeyMasked: maskApiKey(row.api_key),
    baseUrl: row.base_url,
    baseLabel: baseLabel(row.base_url),
    enabled: Number(row.enabled) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function ensureAgnesApiKeysTable(db: AppDb) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS agnes_api_keys (
        id VARCHAR(36) NOT NULL,
        api_key VARCHAR(255) NOT NULL,
        base_url VARCHAR(255) NOT NULL,
        enabled TINYINT NOT NULL DEFAULT 1,
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_agnes_api_keys_key (api_key),
        KEY idx_agnes_api_keys_enabled (enabled, updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
    )
    .run()
}

export async function listAgnesApiKeys(db: AppDb): Promise<PublicAgnesApiKey[]> {
  const result = await db
    .prepare(
      `SELECT id, api_key, base_url, enabled, created_at, updated_at
       FROM agnes_api_keys
       ORDER BY updated_at DESC, created_at DESC`,
    )
    .all<AgnesApiKeyRow>()
  return (result.results ?? []).map(toPublicAgnesApiKey)
}

export async function listEnabledAgnesCredentials(db: AppDb): Promise<AgnesCredential[]> {
  const result = await db
    .prepare(
      `SELECT id, api_key, base_url, enabled, created_at, updated_at
       FROM agnes_api_keys
       WHERE enabled = 1
       ORDER BY updated_at DESC, created_at DESC`,
    )
    .all<AgnesApiKeyRow>()
  return (result.results ?? []).map((row) => ({
    id: row.id,
    apiKey: row.api_key,
    baseUrl: row.base_url || AGNES_BASE_CN,
  }))
}

export async function findAgnesApiKeyById(db: AppDb, id: string) {
  return db
    .prepare(
      `SELECT id, api_key, base_url, enabled, created_at, updated_at
       FROM agnes_api_keys WHERE id = ? LIMIT 1`,
    )
    .bind(id)
    .first<AgnesApiKeyRow>()
}

export async function findAgnesApiKeyByKey(db: AppDb, apiKey: string) {
  return db
    .prepare(
      `SELECT id, api_key, base_url, enabled, created_at, updated_at
       FROM agnes_api_keys WHERE api_key = ? LIMIT 1`,
    )
    .bind(apiKey.trim())
    .first<AgnesApiKeyRow>()
}

export type CreateAgnesApiKeyInput = {
  apiKey: string
  baseUrl: AgnesBaseUrl
  enabled?: boolean
}

export async function createAgnesApiKey(db: AppDb, input: CreateAgnesApiKeyInput) {
  const apiKey = input.apiKey.trim()
  if (!apiKey) throw new Error('请填写密钥')
  if (!isAgnesBaseUrl(input.baseUrl)) throw new Error('请选择 Base URL')

  const existing = await findAgnesApiKeyByKey(db, apiKey)
  if (existing) throw new Error('该密钥已存在')

  const id = crypto.randomUUID()
  const ts = nowIso()
  await db
    .prepare(
      `INSERT INTO agnes_api_keys (id, api_key, base_url, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, apiKey, input.baseUrl, input.enabled === false ? 0 : 1, ts, ts)
    .run()

  const row = await findAgnesApiKeyById(db, id)
  return row ? toPublicAgnesApiKey(row) : null
}

export type UpdateAgnesApiKeyInput = {
  apiKey: string
  baseUrl: AgnesBaseUrl
  enabled: boolean
}

export async function updateAgnesApiKey(db: AppDb, id: string, input: UpdateAgnesApiKeyInput) {
  const apiKey = input.apiKey.trim()
  if (!apiKey) throw new Error('请填写密钥')
  if (!isAgnesBaseUrl(input.baseUrl)) throw new Error('请选择 Base URL')

  const current = await findAgnesApiKeyById(db, id)
  if (!current) return null

  const clash = await findAgnesApiKeyByKey(db, apiKey)
  if (clash && clash.id !== id) throw new Error('该密钥已存在')

  const ts = nowIso()
  await db
    .prepare(
      `UPDATE agnes_api_keys
       SET api_key = ?, base_url = ?, enabled = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(apiKey, input.baseUrl, input.enabled ? 1 : 0, ts, id)
    .run()

  const row = await findAgnesApiKeyById(db, id)
  return row ? toPublicAgnesApiKey(row) : null
}

export async function deleteAgnesApiKey(db: AppDb, id: string) {
  const result = await db.prepare(`DELETE FROM agnes_api_keys WHERE id = ?`).bind(id).run()
  return (result.meta?.changes ?? 0) > 0
}

export async function patchAgnesApiKeyEnabled(db: AppDb, id: string, enabled: boolean) {
  const current = await findAgnesApiKeyById(db, id)
  if (!current) return null
  const ts = nowIso()
  await db
    .prepare(`UPDATE agnes_api_keys SET enabled = ?, updated_at = ? WHERE id = ?`)
    .bind(enabled ? 1 : 0, ts, id)
    .run()
  const row = await findAgnesApiKeyById(db, id)
  return row ? toPublicAgnesApiKey(row) : null
}

export async function patchAgnesApiKeysEnabledByBase(
  db: AppDb,
  baseUrl: AgnesBaseUrl,
  enabled: boolean,
) {
  const ts = nowIso()
  const result = await db
    .prepare(`UPDATE agnes_api_keys SET enabled = ?, updated_at = ? WHERE base_url = ?`)
    .bind(enabled ? 1 : 0, ts, baseUrl)
    .run()
  const items = await listAgnesApiKeys(db)
  return {
    updated: result.meta?.changes ?? 0,
    items,
  }
}

/** 表为空时，把 .env 里的 AGNES_API_KEY 导入为中国区密钥 */
export async function importEnvAgnesKeysIfEmpty(db: AppDb, rawEnvKeys?: string) {
  const count = await db.prepare(`SELECT COUNT(*) AS c FROM agnes_api_keys`).first<{ c: number }>()
  if (Number(count?.c ?? 0) > 0) return 0

  const { parseAgnesKeys } = await import('../fortune/agnesKeyParse.js')
  const keys = parseAgnesKeys(rawEnvKeys)
  if (!keys.length) return 0

  let imported = 0
  for (const apiKey of keys) {
    try {
      await createAgnesApiKey(db, { apiKey, baseUrl: AGNES_BASE_CN, enabled: true })
      imported += 1
    } catch {
      /* skip duplicates / invalid */
    }
  }
  return imported
}

export function resolveAgnesEndpoints(baseUrl: string) {
  const normalized = (baseUrl || AGNES_BASE_CN).replace(/\/$/, '')
  const isIntl = /agnes-ai\.com/i.test(normalized)
  // 中国区密钥：对话/图/视频均走 api.agnes-ai.cn（apihub.agnes-ai.cn 会 Invalid token）
  // 国际区：统一走 apihub.agnes-ai.com
  let mediaHost = 'https://api.agnes-ai.cn'
  try {
    mediaHost = new URL(normalized).origin
  } catch {
    /* keep default */
  }
  return {
    chatBase: normalized,
    mediaBase: isIntl ? 'https://apihub.agnes-ai.com/v1' : normalized,
    mediaHost: isIntl ? 'https://apihub.agnes-ai.com' : mediaHost,
  }
}
