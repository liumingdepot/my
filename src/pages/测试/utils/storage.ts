/** 本机收藏 / 观看历史（localStorage，对齐 Mac 版 hg_favs / hg_hist） */

export type FavItem = {
  sid: string
  title: string
  cover: string
  cat?: string
  ts: number
}

export type HistItem = {
  sid: string
  title: string
  cover: string
  ep: number
  epCnt?: number
  pos: number
  dur: number
  ts: number
}

const FAV_KEY = 'hg_favs'
const HIST_KEY = 'hg_hist'
const GENRE_KEY = 'hg_genre'

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || '') as T
  } catch {
    return fallback
  }
}

export const favs = {
  all: (): FavItem[] => readJson(FAV_KEY, []),
  has: (sid: string) => favs.all().some((x) => x.sid === sid),
  toggle: (item: Omit<FavItem, 'ts'> & { ts?: number }) => {
    let a = favs.all()
    if (a.some((x) => x.sid === item.sid)) a = a.filter((x) => x.sid !== item.sid)
    else a.unshift({ ...item, ts: Date.now() })
    localStorage.setItem(FAV_KEY, JSON.stringify(a))
    return a.some((x) => x.sid === item.sid)
  },
}

export const hist = {
  all: (): HistItem[] => readJson<HistItem[]>(HIST_KEY, []).sort((a, b) => b.ts - a.ts),
  get: (sid: string) => hist.all().find((x) => x.sid === sid),
  put(rec: Omit<HistItem, 'ts'> & { ts?: number }) {
    let a = readJson<HistItem[]>(HIST_KEY, []).filter((x) => x.sid !== rec.sid)
    a.unshift({ ...rec, ts: Date.now() })
    if (a.length > 200) a = a.slice(0, 200)
    localStorage.setItem(HIST_KEY, JSON.stringify(a))
  },
  remove(sid: string) {
    localStorage.setItem(HIST_KEY, JSON.stringify(hist.all().filter((x) => x.sid !== sid)))
  },
  clear() {
    localStorage.setItem(HIST_KEY, '[]')
  },
}

export function getSavedGenre(): string {
  return localStorage.getItem(GENRE_KEY) || 'comic_series'
}

export function setSavedGenre(g: string) {
  localStorage.setItem(GENRE_KEY, g)
}
