/**
 * 存档仓库：IndexedDB 持久化 FC / 街机的即时存档（save state）。
 *
 * 单份体积：FC 约 170kB（序列化后字符串），街机约 270kB（Uint8Array）。
 * 选 IndexedDB 而非 localStorage：后者总额仅 5MB 且同步写入会卡顿。
 */

const DB_NAME = 'mingyouxi'
const DB_VERSION = 1
const STORE = 'savestates'

export type SavePlatform = 'FC' | '街机'

export type SaveStateMeta = {
  /** `${gameId}:${slot}` */
  key: string
  gameId: string
  /** 槽位序号，从 1 开始 */
  slot: number
  platform: SavePlatform
  /** 存档内容；FC 为压缩后的 JSON 字符串，街机为核心原始状态 */
  data: string | Uint8Array
  /** 缩略图 dataURL（列表展示用） */
  thumbnail?: string
  /** 存档时的游戏内时间（毫秒），仅展示 */
  elapsed?: number
  createdAt: number
  updatedAt: number
}

export type SaveStateSummary = Omit<SaveStateMeta, 'data'>

/** 播放器导出的即时存档快照 */
export type PlayerSaveSnapshot = {
  /** FC 为压缩后的字符串，街机为核心原始状态 */
  data: string | Uint8Array
  /** 缩略图 dataURL */
  thumbnail?: string
}

/** 播放器需要实现的存取能力；不支持的播放器返回 null */
export type PlayerSaveApi = {
  save: () => PlayerSaveSnapshot | null
  load: (data: string | Uint8Array) => boolean
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)

  return new Promise((resolve) => {
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      resolve(null)
      return
    }

    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' })
        store.createIndex('gameId', 'gameId', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
    req.onblocked = () => resolve(null)
  })
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function toSummary(row: SaveStateMeta): SaveStateSummary {
  return {
    key: row.key,
    gameId: row.gameId,
    slot: row.slot,
    platform: row.platform,
    thumbnail: row.thumbnail,
    elapsed: row.elapsed,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function saveKey(gameId: string, slot: number) {
  return `${gameId}:${slot}`
}

export async function listSaves(gameId: string): Promise<SaveStateSummary[]> {
  const db = await openDb()
  if (!db) return []
  try {
    const tx = db.transaction(STORE, 'readonly')
    const index = tx.objectStore(STORE).index('gameId')
    const rows = await promisify<SaveStateMeta[]>(index.getAll(gameId) as IDBRequest<SaveStateMeta[]>)
    return rows.map(toSummary).sort((a, b) => a.slot - b.slot)
  } catch {
    return []
  } finally {
    db.close()
  }
}

export async function writeSave(entry: {
  gameId: string
  slot: number
  platform: SavePlatform
  data: string | Uint8Array
  thumbnail?: string
  elapsed?: number
}): Promise<SaveStateSummary | null> {
  const db = await openDb()
  if (!db) return null
  const key = saveKey(entry.gameId, entry.slot)
  try {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const existing = await promisify<SaveStateMeta | undefined>(
      store.get(key) as IDBRequest<SaveStateMeta | undefined>,
    )
    const now = Date.now()
    const row: SaveStateMeta = {
      key,
      gameId: entry.gameId,
      slot: entry.slot,
      platform: entry.platform,
      data: entry.data,
      thumbnail: entry.thumbnail,
      elapsed: entry.elapsed,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    store.put(row)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    return toSummary(row)
  } catch {
    return null
  } finally {
    db.close()
  }
}

export async function readSave(gameId: string, slot: number): Promise<SaveStateMeta | null> {
  const db = await openDb()
  if (!db) return null
  try {
    const tx = db.transaction(STORE, 'readonly')
    const row = await promisify<SaveStateMeta | undefined>(
      tx.objectStore(STORE).get(saveKey(gameId, slot)) as IDBRequest<SaveStateMeta | undefined>,
    )
    return row ?? null
  } catch {
    return null
  } finally {
    db.close()
  }
}

export async function removeSave(gameId: string, slot: number): Promise<void> {
  const db = await openDb()
  if (!db) return
  try {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(saveKey(gameId, slot))
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    })
  } finally {
    db.close()
  }
}