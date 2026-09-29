import mysql from 'mysql2/promise'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function loadEnv() {
  const envPath = path.join(root, '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    if (process.env[m[1]] == null) process.env[m[1]] = m[2]
  }
}

loadEnv()

const username = process.argv[2] || 'liuming'
const password = process.argv[3] || 'admin123'

// Import compiled-on-the-fly via nitro? Use inline PBKDF2 matching server/admin/password.ts
const ITERATIONS = 100_000
const SALT_LEN = 16
const KEY_BITS = 256

function bytesToB64(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  return Buffer.from(view).toString('base64')
}

async function derive(password, salt) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    material,
    KEY_BITS,
  )
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN))
  const hash = await derive(password, salt)
  return `pbkdf2$${ITERATIONS}$${bytesToB64(salt)}$${bytesToB64(hash)}`
}

const host = process.env.MYSQL_HOST || '192.168.0.233'
const port = Number(process.env.MYSQL_PORT || 3306)
const user = process.env.MYSQL_USER || 'root'
const dbPass = process.env.MYSQL_PASSWORD || '123456'
const database = process.env.MYSQL_DATABASE || 'liuming'

const passwordHash = await hashPassword(password)
const conn = await mysql.createConnection({ host, port, user, password: dbPass, database })
const [result] = await conn.execute('UPDATE users SET password_hash = ? WHERE username = ?', [
  passwordHash,
  username,
])
await conn.end()
console.log(`Updated ${result.affectedRows} user(s): ${username} / ${password}`)
