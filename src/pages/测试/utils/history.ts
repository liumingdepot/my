/** 本机收藏 / 观看历史（localStorage） */

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
  epCnt: number
  pos: number
  dur: number
  ts: number
}

const FAV_KEY = 'test_hg_favs'
const HIST_KEY = 'test_hg_hist'
const GENRE_KEY = 'test_hg_genre'

export const genreStore = {
  get: () => localStorage.getItem(GENRE_KEY) || 'comic_series',
  set: (g: string) => localStorage.setItem(GENRE_KEY, g),
}

export const favs = {
  all: (): FavItem[] => {
    try {
      return JSON.parse(localStorage.getItem(FAV_KEY) || '[]') as FavItem[]
    } catch {
      return []
    }
  },
  has: (sid: string) => favs.all().some((x) => x.sid === sid),
  toggle: (item: Omit<FavItem, 'ts'> & { ts?: number }) => {
    let a = favs.all()
    const sid = item.sid
    if (a.some((x) => x.sid === sid)) a = a.filter((x) => x.sid !== sid)
    else a.unshift({ ...item, ts: Date.now() })
    localStorage.setItem(FAV_KEY, JSON.stringify(a))
    return a.some((x) => x.sid === sid)
  },
}

export const hist = {
  all: (): HistItem[] => {
    try {
      return (JSON.parse(localStorage.getItem(HIST_KEY) || '[]') as HistItem[]).sort(
        (a, b) => b.ts - a.ts,
      )
    } catch {
      return []
    }
  },
  get: (sid: string) => hist.all().find((x) => x.sid === sid),
  put(rec: Omit<HistItem, 'ts'>) {
    let a: HistItem[]
    try {
      a = JSON.parse(localStorage.getItem(HIST_KEY) || '[]') as HistItem[]
    } catch {
      a = []
    }
    a = a.filter((x) => x.sid !== rec.sid)
    a.unshift({ ...rec, ts: Date.now() })
    if (a.length > 200) a = a.slice(0, 200)
    localStorage.setItem(HIST_KEY, JSON.stringify(a))
  },
  remove(sid: string) {
    const a = hist.all().filter((x) => x.sid !== sid)
    localStorage.setItem(HIST_KEY, JSON.stringify(a))
  },
  clear() {
    localStorage.setItem(HIST_KEY, '[]')
  },
  updateMeta(sid: string, patch: Partial<Pick<HistItem, 'title' | 'cover'>>) {
    const a = hist.all()
    const i = a.findIndex((y) => y.sid === sid)
    if (i < 0) return
    a[i] = { ...a[i], ...patch }
    localStorage.setItem(HIST_KEY, JSON.stringify(a))
  },
}
