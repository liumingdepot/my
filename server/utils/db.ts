import mysql from 'mysql2/promise'
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise'

let pool: Pool | null = null

export type DbRow = RowDataPacket

function env(name: string, fallback = '') {
  return process.env[name] || fallback
}

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: env('MYSQL_HOST', '192.168.0.233'),
      port: Number(env('MYSQL_PORT', '3306')),
      user: env('MYSQL_USER', 'root'),
      password: env('MYSQL_PASSWORD', '123456'),
      database: env('MYSQL_DATABASE', 'liuming'),
      waitForConnections: true,
      connectionLimit: 10,
      charset: 'utf8mb4',
    })
  }
  return pool
}

/** mysql2 statement helper: prepare / bind / first / all / run */
export class Stmt {
  constructor(
    private readonly sql: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...params: unknown[]) {
    return new Stmt(this.sql, params)
  }

  async first<T = DbRow>(): Promise<T | null> {
    const [rows] = await getPool().execute<RowDataPacket[]>(this.sql, this.params as never[])
    return ((rows as T[])[0] as T) ?? null
  }

  async all<T = DbRow>(): Promise<{ results: T[] }> {
    const [rows] = await getPool().execute<RowDataPacket[]>(this.sql, this.params as never[])
    return { results: rows as T[] }
  }

  async run(): Promise<{ success: boolean; meta: { changes: number } }> {
    const [result] = await getPool().execute<ResultSetHeader>(this.sql, this.params as never[])
    const changes = 'affectedRows' in result ? result.affectedRows : 0
    return { success: true, meta: { changes } }
  }
}

export type AppDb = {
  prepare: (sql: string) => Stmt
  batch: (stmts: Stmt[]) => Promise<void>
}

export const DB: AppDb = {
  prepare(sql: string) {
    return new Stmt(sql)
  },
  async batch(stmts: Stmt[]) {
    for (const stmt of stmts) {
      await stmt.run()
    }
  },
}

export async function queryAll<T = DbRow>(sql: string, params: unknown[] = []) {
  return new Stmt(sql, params).all<T>()
}

export async function queryOne<T = DbRow>(sql: string, params: unknown[] = []) {
  return new Stmt(sql, params).first<T>()
}

export async function execute(sql: string, params: unknown[] = []) {
  return new Stmt(sql, params).run()
}
