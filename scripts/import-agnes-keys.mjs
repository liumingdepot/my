/**
 * Import Agnes keys from a text file into MySQL (international base URL).
 * Usage: node scripts/import-agnes-keys.mjs "f:/key/国际key.txt" intl
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import mysql from 'mysql2/promise'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const BASE = {
  cn: 'https://api.agnes-ai.cn/v1',
  intl: 'https://apihub.agnes-ai.com/v1',
}

function loadEnv() {
  const envPath = path.join(root, '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    if (process.env[m[1]] == null) process.env[m[1]] = m[2]
  }
}

function parseKeys(raw) {
  return raw
    .split(/[\n,，;；]+/)
    .map((item) => item.trim().replace(/^["']|["']$/g, ''))
    .filter((item) => item.startsWith('sk-') || item.startsWith('wk-') || item.length > 20)
}

loadEnv()

const filePath = process.argv[2]
const region = (process.argv[3] || 'intl').toLowerCase()
if (!filePath) {
  console.error('Usage: node scripts/import-agnes-keys.mjs <file> [cn|intl]')
  process.exit(1)
}
if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath)
  process.exit(1)
}

const baseUrl = BASE[region] || BASE.intl
const keys = parseKeys(fs.readFileSync(filePath, 'utf8'))
if (!keys.length) {
  console.error('No keys found in file')
  process.exit(1)
}

const host = process.env.MYSQL_HOST || '192.168.0.233'
const port = Number(process.env.MYSQL_PORT || 3306)
const user = process.env.MYSQL_USER || 'root'
const password = process.env.MYSQL_PASSWORD || '123456'
const database = process.env.MYSQL_DATABASE || 'liuming'

const conn = await mysql.createConnection({ host, port, user, password, database })

try {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS agnes_api_keys (
      id VARCHAR(36) NOT NULL,
      api_key VARCHAR(255) NOT NULL,
      base_url VARCHAR(255) NOT NULL,
      enabled TINYINT NOT NULL DEFAULT 1,
      created_at VARCHAR(64) NOT NULL,
      updated_at VARCHAR(64) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uk_agnes_api_keys_key (api_key),
      KEY idx_agnes_api_keys_enabled (enabled, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `)

  let inserted = 0
  let skipped = 0
  const now = new Date().toISOString()

  for (const apiKey of keys) {
    const id = randomUUID()
    try {
      const [result] = await conn.execute(
        `INSERT INTO agnes_api_keys (id, api_key, base_url, enabled, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?)
         ON DUPLICATE KEY UPDATE
           base_url = VALUES(base_url),
           enabled = 1,
           updated_at = VALUES(updated_at)`,
        [id, apiKey, baseUrl, now, now],
      )
      // mysql2: insertId/affectedRows — for ON DUPLICATE, affectedRows=1 insert, 2 update
      const affected = result.affectedRows ?? 0
      if (affected === 1) inserted += 1
      else skipped += 1 // updated existing
    } catch (err) {
      skipped += 1
      console.warn('skip', apiKey.slice(0, 8) + '…', err.message)
    }
  }

  const [rows] = await conn.query(
    `SELECT COUNT(*) AS total,
            SUM(base_url = ?) AS intl_count,
            SUM(enabled = 1) AS enabled_count
     FROM agnes_api_keys`,
    [BASE.intl],
  )
  const summary = rows[0]

  console.log(
    JSON.stringify(
      {
        file: filePath,
        baseUrl,
        parsed: keys.length,
        inserted,
        updatedOrSkipped: skipped,
        dbTotal: Number(summary.total),
        dbIntl: Number(summary.intl_count),
        dbEnabled: Number(summary.enabled_count),
      },
      null,
      2,
    ),
  )
} finally {
  await conn.end()
}
