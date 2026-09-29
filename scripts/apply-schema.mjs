/**
 * Apply MySQL schema: create database liuming + tables.
 * Usage: node scripts/apply-schema.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

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

const host = process.env.MYSQL_HOST || '192.168.0.233'
const port = Number(process.env.MYSQL_PORT || 3306)
const user = process.env.MYSQL_USER || 'root'
const password = process.env.MYSQL_PASSWORD || '123456'
const database = process.env.MYSQL_DATABASE || 'liuming'

const sqlPath = path.join(__dirname, 'mysql-schema.sql')
const sql = fs.readFileSync(sqlPath, 'utf8')

const conn = await mysql.createConnection({ host, port, user, password, multipleStatements: true })
try {
  await conn.query(sql)
  console.log(`Schema applied on ${host}:${port}/${database}`)
} finally {
  await conn.end()
}
