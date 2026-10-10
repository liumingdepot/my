import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import styled from 'styled-components'
import DramaCard from './DramaCard'
import { categoryByPath } from '../utils/categories'
import { searchDramas, type DramaListItem } from '../utils/server'

/** 与首页同接口；首屏多拉几页凑数量，再按需加载更多 */
const PREFETCH_PAGES = 3

export default function TypePage() {
  const { pathname } = useLocation()
  const cat = categoryByPath(pathname)

  const [list, setList] = useState<DramaListItem[]>([])
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const reqId = useRef(0)

  const mergeUnique = useCallback((prev: DramaListItem[], next: DramaListItem[]) => {
    const seen = new Set(prev.map((i) => String(i.id)))
    const out = [...prev]
    for (const item of next) {
      if (!item.image_link) continue
      const id = String(item.id)
      if (seen.has(id)) continue
      seen.add(id)
      out.push(item)
    }
    return out
  }, [])

  useEffect(() => {
    if (!cat) return
    const id = ++reqId.current
    const ac = new AbortController()
    setList([])
    setPage(0)
    setTotalPages(1)
    setLoading(true)
    setError('')
    ;(async () => {
      try {
        // 与首页相同：searchDramas('', page, category)；首屏并行多页
        const first = await searchDramas('', 1, cat.category, ac.signal)
        if (id !== reqId.current) return
        const pages = Math.max(1, first.total_pages || 1)
        setTotalPages(pages)

        let merged = mergeUnique([], first.list || [])
        const end = Math.min(PREFETCH_PAGES, pages)
        if (end > 1) {
          const rest = await Promise.all(
            Array.from({ length: end - 1 }, (_, i) =>
              searchDramas('', i + 2, cat.category, ac.signal).catch(() => null),
            ),
          )
          if (id !== reqId.current) return
          for (const data of rest) {
            if (data?.list) merged = mergeUnique(merged, data.list)
          }
        }

        setList(merged)
        setPage(end)
        if (!merged.length) setError('该分类暂无内容')
      } catch (err) {
        if (id !== reqId.current) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setList([])
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        if (id === reqId.current) setLoading(false)
      }
    })()
    return () => {
      ac.abort()
      reqId.current += 1
    }
  }, [cat, mergeUnique])

  async function loadMore() {
    if (!cat || loadingMore || page >= totalPages) return
    setLoadingMore(true)
    setError('')
    try {
      const next = page + 1
      const data = await searchDramas('', next, cat.category)
      setList((prev) => mergeUnique(prev, data.list || []))
      setPage(next)
      if (data.total_pages) setTotalPages(data.total_pages)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoadingMore(false)
    }
  }

  if (!cat) {
    return <Navigate to="/hongguo" replace />
  }

  const hasMore = page < totalPages

  return (
    <Page key={pathname}>
      <div className="container">
        <div className="head">
          <h1>{cat.label}</h1>
          <p className="hint">{loading ? '采集中…' : `${list.length} 部短剧`}</p>
        </div>

        {loading && !list.length ? <Status>加载中…</Status> : null}
        {error && !list.length ? <Status className="err">{error}</Status> : null}

        <div className="grid">
          {list.map((item) => (
            <DramaCard key={String(item.id)} item={item} />
          ))}
        </div>

        {hasMore ? (
          <div className="more">
            <button type="button" disabled={loadingMore} onClick={() => void loadMore()}>
              {loadingMore ? '加载中…' : '加载更多'}
            </button>
          </div>
        ) : null}
      </div>
    </Page>
  )
}

const Page = styled.div`
  .container {
    max-width: 90vw;
    margin: 0 auto;
    padding: 24px 0 32px;
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;

    h1 {
      margin: 0;
      font-family: ui-serif, 'Songti SC', 'STSong', 'SimSun', serif;
      font-size: clamp(22px, 3vw, 28px);
      font-weight: 700;
      letter-spacing: 0.04em;
    }

    .hint {
      margin: 0;
      font-size: 13px;
      color: rgba(245, 242, 234, 0.45);
    }
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
