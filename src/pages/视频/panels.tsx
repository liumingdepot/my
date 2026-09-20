import { useEffect, useState, type FormEvent } from 'react'
import { fetchSources, listVideos, mergeVodLists, searchVideos } from './api'
import { categoryName, useVideoCopy } from './i18n'
import type { CategoryNode, VodItem } from './types'
import {
  clearSearchHistory,
  getActiveSources,
  getFavorites,
  getSearchHistory,
  isWelfareSource,
  isWelfareUnlocked,
  pushSearchHistory,
  removeSearchHistory,
  setActiveSources,
  unlockWelfare,
} from './storage'

export const CATEGORIES: CategoryNode[] = [
  {
    type_id: 2,
    type_name: '电视剧',
    children: [
      { type_id: 13, type_name: '大陆剧' },
      { type_id: 14, type_name: '港澳剧' },
      { type_id: 15, type_name: '韩剧' },
      { type_id: 16, type_name: '日剧' },
      { type_id: 21, type_name: '台湾剧' },
      { type_id: 22, type_name: '欧美剧' },
      { type_id: 24, type_name: '泰剧' },
    ],
  },
  {
    type_id: 1,
    type_name: '电影',
    children: [
      { type_id: 6, type_name: '动作片' },
      { type_id: 7, type_name: '喜剧片' },
      { type_id: 8, type_name: '爱情片' },
      { type_id: 9, type_name: '科幻片' },
      { type_id: 10, type_name: '恐怖片' },
      { type_id: 11, type_name: '剧情片' },
      { type_id: 12, type_name: '战争片' },
      { type_id: 20, type_name: '动画电影' },
      { type_id: 32, type_name: '悬疑片' },
    ],
  },
  {
    type_id: 3,
    type_name: '综艺',
    children: [
      { type_id: 25, type_name: '大陆综艺' },
      { type_id: 26, type_name: '日韩综艺' },
      { type_id: 27, type_name: '港台综艺' },
      { type_id: 28, type_name: '欧美综艺' },
    ],
  },
  {
    type_id: 4,
    type_name: '动漫',
    children: [
      { type_id: 29, type_name: '国产动漫' },
      { type_id: 30, type_name: '日韩动漫' },
      { type_id: 31, type_name: '欧美动漫' },
    ],
  },
]

const SHORT_TYPE = 46
const LIST_SOURCE = '量子'

/** Shown until /api/video/sources returns admin config. */
const FALLBACK_SOURCES = [{ name: '量子' }, { name: '红牛' }] as const

type GridProps = {
  list: VodItem[]
  loading?: boolean
  empty?: string
  onOpen: (item: VodItem) => void
}

export function VodGrid({ list, loading, empty, onOpen }: GridProps) {
  const { t } = useVideoCopy()
  const emptyText = empty ?? t.empty
  if (loading && !list.length) {
    return <p className="vod-status">{t.loading}</p>
  }
  if (!list.length) {
    return <p className="vod-status">{emptyText}</p>
  }
  return (
    <div className="vod-grid">
      {list.map((item) => (
        <button
          key={`${item.source}-${item.vod_id}-${item.vod_name}`}
          type="button"
          className="vod-card"
          onClick={() => onOpen(item)}
        >
          <span className="vod-card__cover">
            <img src={item.vod_pic} alt="" loading="lazy" referrerPolicy="no-referrer" />
            {item.vod_remarks && <span className="vod-card__tag">{item.vod_remarks}</span>}
          </span>
          <span className="vod-card__name">{item.vod_name}</span>
          <span className="vod-card__sub">
            {item.type_name || item.source}
            {item.playSources && item.playSources.length > 1
              ? t.sourceCount.replace('{n}', String(item.playSources.length))
              : ''}
          </span>
        </button>
      ))}
    </div>
  )
}

type SearchProps = {
  initialQuery?: string
  onOpen: (item: VodItem) => void
  onConsumedQuery?: () => void
}

export function SearchPanel({ initialQuery, onOpen, onConsumedQuery }: SearchProps) {
  const { t } = useVideoCopy()
  const [q, setQ] = useState(initialQuery || '')
  const [list, setList] = useState<VodItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [history, setHistory] = useState(getSearchHistory)
  const [sources, setSources] = useState<{ name: string }[]>(() => [...FALLBACK_SOURCES])
  const [active, setActive] = useState(getActiveSources)
  const [editing, setEditing] = useState(false)
  const [showResult, setShowResult] = useState(!!initialQuery)
  const [gate, setGate] = useState<string | null>(null)
  const [secret, setSecret] = useState('')
  const [gateError, setGateError] = useState(false)

  useEffect(() => {
    void fetchSources()
      .then((res) => {
        if (res.list?.length) setSources(res.list)
      })
      .catch(() => {
        /* keep FALLBACK_SOURCES */
      })
  }, [])

  useEffect(() => {
    if (initialQuery) {
      setQ(initialQuery)
      void runSearch(initialQuery, 1)
      onConsumedQuery?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery])

  function applySource(name: string) {
    const next = active.includes(name) ? active.filter((n) => n !== name) : [...active, name]
    const final = next.length ? next : [name]
    setActive(final)
    setActiveSources(final)
  }

  function toggleSource(name: string) {
    const turningOn = !active.includes(name)
    if (turningOn && isWelfareSource(name) && !isWelfareUnlocked()) {
      setGate(name)
      setSecret('')
      setGateError(false)
      return
    }
    setGate(null)
    applySource(name)
  }

  function submitGate(event: FormEvent) {
    event.preventDefault()
    if (!gate) return
    if (!unlockWelfare(secret)) {
      setGateError(true)
      return
    }
    const name = gate
    setGate(null)
    setSecret('')
    applySource(name)
  }

  async function runSearch(keyword: string, pg: number) {
    const key = keyword.trim()
    if (!key) return
    setShowResult(true)
    setLoading(true)
    setPage(pg)
    setHistory(pushSearchHistory(key))
    try {
      let merged: VodItem[] = []
      for (const name of active) {
        try {
          const res = await searchVideos(key, name, pg)
          merged = mergeVodLists(merged, res.list)
        } catch {
          /* skip dead source */
        }
      }
      merged.sort((a, b) => {
        if (a.vod_name === key) return -1
        if (b.vod_name === key) return 1
        return 0
      })
      setList(merged)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="vod-panel">
      <form
        className="vod-search"
        onSubmit={(e) => {
          e.preventDefault()
          void runSearch(q, 1)
        }}
      >
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            if (!e.target.value) setShowResult(false)
          }}
          placeholder={t.searchPlaceholder}
          enterKeyHint="search"
        />
        <button type="submit">{t.search}</button>
      </form>

      <div className="vod-sources">
        <p>{t.sources}</p>
        <div className="vod-chips">
          {sources.map((s) => (
            <button
              key={s.name}
              type="button"
              className={active.includes(s.name) ? 'is-active' : ''}
              onClick={() => toggleSource(s.name)}
            >
              {s.name}
            </button>
          ))}
        </div>
        {gate && (
          <form className="vod-lock" onSubmit={submitGate}>
            <p>{t.passwordTitle}</p>
            <input
              type="password"
              value={secret}
              autoFocus
              placeholder={t.passwordPlaceholder}
              onChange={(e) => {
                setSecret(e.target.value)
                setGateError(false)
              }}
            />
            {gateError && <span className="vod-lock__error">{t.passwordWrong}</span>}
            <div className="vod-lock__actions">
              <button type="button" onClick={() => setGate(null)}>
                {t.passwordCancel}
              </button>
              <button type="submit">{t.passwordOk}</button>
            </div>
          </form>
        )}
      </div>

      {showResult ? (
        <>
          <VodGrid list={list} loading={loading} empty={t.emptySearch} onOpen={onOpen} />
          <div className="vod-pager">
            <button type="button" disabled={page <= 1 || loading} onClick={() => void runSearch(q, page - 1)}>
              {t.prevPage}
            </button>
            <span>{t.page.replace('{n}', String(page))}</span>
            <button type="button" disabled={loading} onClick={() => void runSearch(q, page + 1)}>
              {t.nextPage}
            </button>
          </div>
        </>
      ) : (
        <div className="vod-history">
          <div className="vod-history__head">
            <strong>{t.history}</strong>
            <button
              type="button"
              onClick={() => {
                if (editing) {
                  setEditing(false)
                } else {
                  setEditing(true)
                }
              }}
            >
              {editing ? t.done : t.edit}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  clearSearchHistory()
                  setHistory([])
                }}
              >
                {t.clear}
              </button>
            )}
          </div>
          <div className="vod-history__tags">
            {history.length === 0 && <span className="vod-status">{t.noHistory}</span>}
            {history.map((h) => (
              <button
                key={h}
                type="button"
                className="vod-tag"
                onClick={() => {
                  if (editing) {
                    setHistory(removeSearchHistory(h))
                  } else {
                    setQ(h)
                    void runSearch(h, 1)
                  }
                }}
              >
                {h}
                {editing ? ' ×' : ''}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

type CategoryProps = {
  onOpen: (item: VodItem) => void
}

export function CategoryPanel({ onOpen }: CategoryProps) {
  const { lang, t } = useVideoCopy()
  const [parent, setParent] = useState(CATEGORIES[0])
  const [childId, setChildId] = useState(CATEGORIES[0].children[0].type_id)
  const [list, setList] = useState<VodItem[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  async function load(typeId: number, pg: number) {
    setLoading(true)
    setPage(pg)
    try {
      const res = await listVideos(typeId, LIST_SOURCE, pg)
      setList(res.list)
    } catch {
      setList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(childId, 1)
  }, [childId])

  return (
    <div className="vod-panel">
      <div className="vod-cat-row">
        {CATEGORIES.map((c) => (
          <button
            key={c.type_id}
            type="button"
            className={parent.type_id === c.type_id ? 'is-active' : ''}
            onClick={() => {
              setParent(c)
              setChildId(c.children[0].type_id)
            }}
          >
            {categoryName(c.type_id, c.type_name, lang)}
          </button>
        ))}
      </div>
      <div className="vod-cat-row is-sub">
        {parent.children.map((c) => (
          <button
            key={c.type_id}
            type="button"
            className={childId === c.type_id ? 'is-active' : ''}
            onClick={() => setChildId(c.type_id)}
          >
            {categoryName(c.type_id, c.type_name, lang)}
          </button>
        ))}
      </div>
      <VodGrid
        list={list}
        loading={loading}
        onOpen={(item) => {
          // Category list may lack full play url detail — open via search of name if no sources
          if (!item.playSources?.length) return
          onOpen(item)
        }}
      />
      <div className="vod-pager">
        <button type="button" disabled={page <= 1 || loading} onClick={() => void load(childId, page - 1)}>
          {t.prevPage}
        </button>
        <span>{t.page.replace('{n}', String(page))}</span>
        <button type="button" disabled={loading} onClick={() => void load(childId, page + 1)}>
          {t.nextPage}
        </button>
      </div>
    </div>
  )
}

export function ShortPanel({ onOpen }: CategoryProps) {
  const { t } = useVideoCopy()
  const [list, setList] = useState<VodItem[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  async function load(pg: number) {
    setLoading(true)
    setPage(pg)
    try {
      const res = await listVideos(SHORT_TYPE, LIST_SOURCE, pg)
      setList(res.list)
    } catch {
      setList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(1)
  }, [])

  return (
    <div className="vod-panel">
      <p className="vod-lead">{t.shortLead}</p>
      <VodGrid list={list} loading={loading} onOpen={onOpen} />
      <div className="vod-pager">
        <button type="button" disabled={page <= 1 || loading} onClick={() => void load(page - 1)}>
          {t.prevPage}
        </button>
        <span>{t.page.replace('{n}', String(page))}</span>
        <button type="button" disabled={loading} onClick={() => void load(page + 1)}>
          {t.nextPage}
        </button>
      </div>
    </div>
  )
}

export function FavPanel({ onOpen }: CategoryProps) {
  const { t } = useVideoCopy()
  const [list, setList] = useState(getFavorites)

  useEffect(() => {
    const sync = () => setList(getFavorites())
    window.addEventListener('focus', sync)
    return () => window.removeEventListener('focus', sync)
  }, [])

  return (
    <div className="vod-panel">
      <p className="vod-lead">{t.favLead}</p>
      <VodGrid list={list} empty={t.emptyFav} onOpen={onOpen} />
      {list.length > 0 && (
        <button type="button" className="vod-refresh" onClick={() => setList(getFavorites())}>
          {t.refresh}
        </button>
      )}
    </div>
  )
}
