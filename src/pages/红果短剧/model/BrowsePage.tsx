import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import styled from 'styled-components'
import DramaCard from './DramaCard'
import {
  buildBrowseQuery,
  fetchBrowse,
  fetchFilters,
  readPicked,
  writePicked,
  type BrowseItem,
  type FilterRow,
} from '../utils/browse'
import type { DramaListItem } from '../utils/server'

const PAGE_SIZE = 36
const GENRE = 'short_play'

/** 分类页只保留主题 / 设定 / 背景 / 状态 */
const HIDDEN_DIMS = new Set(['sort', 'online_time', 'gender', 'genre'])
const HIDDEN_LABELS = new Set(['推荐', '排序', '时间', '受众', '分类'])

function isHiddenRow(row: FilterRow): boolean {
  if (HIDDEN_DIMS.has(row.type)) return true
  const label = row.label.replace(/^全部/, '')
  return HIDDEN_LABELS.has(label)
}

function formatPlay(n: number): string {
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)} 亿播放`
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)} 万播放`
  return `${n} 播放`
}

function toDrama(item: BrowseItem): DramaListItem {
  const sub = [item.score ? `${item.score} 分` : '', formatPlay(item.playCnt)]
    .filter(Boolean)
    .join(' · ')
  return {
    id: item.seriesId,
    image_link: item.cover,
    title: item.title,
    sub_title: sub || item.tags.slice(0, 3).join(' / '),
    total_num: item.episodeCnt ? String(item.episodeCnt) : '',
  }
}

/** 顶栏「分类」：多维筛选浏览（真人剧 landpage） */
export default function BrowsePage() {
  const [params, setParams] = useSearchParams()
  const paramKey = params.toString()
  const picked = useMemo(() => readPicked(params), [paramKey])
  const query = useMemo(() => buildBrowseQuery(GENRE, picked), [paramKey])

  const [rows, setRows] = useState<FilterRow[]>([])
  const [filterFailed, setFilterFailed] = useState(false)
  const [items, setItems] = useState<BrowseItem[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const reqId = useRef(0)

  useEffect(() => {
    const ac = new AbortController()
    fetchFilters(GENRE, ac.signal)
      .then((data) => {
        setRows(data.rows.filter((r) => !isHiddenRow(r)))
        setFilterFailed(false)
      })
      .catch(() => {
        if (!ac.signal.aborted) setFilterFailed(true)
      })
    return () => ac.abort()
  }, [])

  const load = useCallback(
    async (nextOffset: number, append: boolean) => {
      const id = ++reqId.current
      setError('')
      if (append) setLoadingMore(true)
      else setLoading(true)
      try {
        const data = await fetchBrowse(query, nextOffset, PAGE_SIZE)
        if (id !== reqId.current) return
        setItems((prev) => (append ? [...prev, ...data.items] : data.items))
        setHasMore(data.hasMore)
        setOffset(nextOffset)
      } catch (e) {
        if (id !== reqId.current) return
        if (!append) setItems([])
        setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (id === reqId.current) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [query],
  )

  useEffect(() => {
    void load(0, false)
  }, [load])

  function toggle(dim: string, id: string) {
    // 全局单选：选中任意一项时清除其他维度
    const next = picked[dim] === id ? {} : { [dim]: id }
    setParams(writePicked(next), { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <Page>
      <div className="filters">
        <div className="filters-inner">
          {filterFailed ? (
            <p className="note">筛选面板加载失败，可直接浏览下方列表</p>
          ) : null}

          {rows.map((row) => {
            if (!row.items.length) return null
            return (
              <div key={row.type} className="row">
                <span className="label">{row.label.replace(/^全部/, '')}</span>
                <div className="opts">
                  {row.items.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      className={picked[row.type] === it.id ? 'is-active' : ''}
                      onClick={() => toggle(row.type, it.id)}
                    >
                      {it.name}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="container">
        {loading && !items.length ? <Status>加载中…</Status> : null}
        {error && !items.length ? <Status className="err">{error}</Status> : null}
        {!loading && !error && !items.length ? <Status>暂无内容</Status> : null}

        <div className="grid">
          {items.map((item) => (
            <DramaCard key={item.seriesId} item={toDrama(item)} />
          ))}
        </div>

        {hasMore ? (
          <div className="more">
            <button type="button" disabled={loadingMore} onClick={() => void load(offset + PAGE_SIZE, true)}>
              {loadingMore ? '加载中…' : '加载更多'}
            </button>
          </div>
        ) : null}
      </div>
    </Page>
  )
}

const Page = styled.div`
  .filters {
    background: rgba(10, 10, 12, 0.5);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .filters-inner {
    max-width: 90vw;
    margin: 0 auto;
    padding: 12px 0 10px;
  }

  .note {
    margin: 0 0 6px;
    font-size: 12px;
    color: rgba(245, 242, 234, 0.35);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 0;
    min-width: 0;
  }

  .label {
    flex: 0 0 48px;
    font-size: 13px;
    color: rgba(245, 242, 234, 0.45);
    white-space: nowrap;
  }

  .opts {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 2px;
    flex: 1;
    min-width: 0;
  }

  .opts button {
    height: 30px;
    padding: 0 12px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: rgba(245, 242, 234, 0.72);
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
    transition:
      color 0.15s,
      background 0.15s;

    &:hover {
      color: #f5f2ea;
    }

    &.is-active {
      color: #e8a54b;
      font-weight: 600;
    }
  }

  .container {
    max-width: 90vw;
    margin: 0 auto;
    padding: 24px 0 32px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 20px 14px;
    align-items: start;
  }

  .more {
    display: flex;
    justify-content: center;
    margin: 36px 0 8px;

    button {
      min-width: 160px;
      height: 40px;
      padding: 0 24px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.04);
      color: #f5f2ea;
      font-size: 14px;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;

      &:hover:not(:disabled) {
        border-color: rgba(232, 165, 75, 0.5);
        color: #e8a54b;
      }

      &:disabled {
        opacity: 0.5;
        cursor: wait;
      }
    }
  }

  @media (max-width: 1200px) {
    .grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (max-width: 900px) {
    .filters-inner {
      max-width: 100%;
      padding: 8px 12px 6px;
    }

    .row {
      gap: 8px;
      padding: 4px 0;
    }

    .label {
      flex: 0 0 36px;
      font-size: 12px;
    }

    .opts {
      flex-wrap: nowrap;
      overflow-x: auto;
      gap: 0;
      padding-bottom: 2px;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;

      &::-webkit-scrollbar {
        display: none;
      }
    }

    .opts button {
      height: 32px;
      padding: 0 10px;
      font-size: 13px;
      flex-shrink: 0;
    }

    .container {
      max-width: 100%;
      padding: 16px 12px 28px;
    }

    .grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px 10px;
    }
  }

  @media (max-width: 600px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px 8px;
    }

    .more button {
      width: 100%;
      min-width: 0;
    }
  }
`

const Status = styled.p`
  color: rgba(245, 242, 234, 0.55);
  font-size: 14px;
  margin: 12px 0 24px;

  &.err {
    color: #e07070;
  }
`
