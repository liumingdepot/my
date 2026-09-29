/**
 * Import tmp/*.json dumps into MySQL `liuming`.
 * Usage: node scripts/import-mysql.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const tmpDir = path.join(root, 'tmp')

const TABLES = ['users', 'video_sources', 'games', 'education_sources', 'education_config']

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

function loadFromTmp() {
  const data = {}
  for (const t of TABLES) {
    const file = path.join(tmpDir, `${t}.json`)
    if (!fs.existsSync(file)) {
      throw new Error(`Missing ${file}`)
    }
    data[t] = JSON.parse(fs.readFileSync(file, 'utf8'))
    console.log(`Loaded ${t}: ${data[t].length} rows ← ${file}`)
  }
  return data
}

async function importAll(data) {
  const host = process.env.MYSQL_HOST || '192.168.0.233'
  const port = Number(process.env.MYSQL_PORT || 3306)
  const user = process.env.MYSQL_USER || 'root'
  const password = process.env.MYSQL_PASSWORD || '123456'
  const database = process.env.MYSQL_DATABASE || 'liuming'

  const schema = fs.readFileSync(path.join(__dirname, 'mysql-schema.sql'), 'utf8')
  const boot = await mysql.createConnection({ host, port, user, password, multipleStatements: true })
  await boot.query(schema)
  await boot.end()

  const conn = await mysql.createConnection({ host, port, user, password, database })

  const insert = async (table, rows) => {
    if (!rows.length) {
      console.log(`Skip ${table}: 0 rows`)
      return 0
    }
    await conn.query(`DELETE FROM \`${table}\``)
    const cols = Object.keys(rows[0])
    const placeholders = cols.map(() => '?').join(',')
    const colSql = cols.map((c) => `\`${c}\``).join(',')
    const sql = `INSERT INTO \`${table}\` (${colSql}) VALUES (${placeholders})`
    let n = 0
    for (const row of rows) {
      const values = cols.map((c) => {
        const v = row[c]
        if (v == null) return null
        return v
      })
      await conn.execute(sql, values)
      n += 1
    }
    console.log(`Imported ${table}: ${n} rows`)
    return n
  }

  try {
    await conn.beginTransaction()
    for (const t of TABLES) {
      await insert(t, data[t] || [])
    }
    await conn.commit()

    console.log('\nRow counts in MySQL:')
    for (const t of TABLES) {
      const [rows] = await conn.query(`SELECT COUNT(*) AS c FROM \`${t}\``)
      console.log(`  ${t}: ${rows[0].c}`)
    }
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    await conn.end()
  }
}

const data = loadFromTmp()
await importAll(data)
console.log('Import done.')
