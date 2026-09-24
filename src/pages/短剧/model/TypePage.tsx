import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useParams } from 'react-router'
import styled from 'styled-components'
import DramaCard from './DramaCard'
import { categoryByKey } from '../utils/categories'
import { searchDramas, type DramaListItem } from '../utils/server'

export default function TypePage() {
  const { cat: catKey } = useParams()
  const { pathname } = useLocation()
  const cat = categoryByKey(catKey)

  const [list, setList] = useState<DramaListItem[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const loadingMoreRef = useRef(false)

  useEffect(() => {
    if (!cat) return
    let cancelled = false
    const ac = new AbortController()
    setLoading(true)
    setError('')
    setList([])
    setPage(1)
    setHasMore(false)
    ;(async () => {
      try {
        const data = await searchDramas(cat.name, 1, ac.signal)
        if (cancelled) return
        const items = data.list || []
        setList(items)
        setPage(data.page || 1)
        setHasMore(Boolean(data.next_page) || (data.page || 1) < (data.total_pages || 1))
        if (!items.length) setError('该分类暂无内容')
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [cat])

  if (!cat) {
    return <Navigate to="/short" replace />
  }

  async function loadMore() {
    if (!cat || !hasMore || loadingMoreRef.current) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    setError('')
    try {
      const nextPage = page + 1
      const data = await searchDramas(cat.name, nextPage)
      const items = data.list || []
      setList((prev) => {
        const seen = new Set(prev.map((i) => i.id))
        return [...prev, ...items.filter((i) => !seen.has(i.id))]
      })
      setPage(data.page || nextPage)
      setHasMore(Boolean(data.next_page) || (data.page || nextPage) < (data.total_pages || 1))
      if (!items.length) setHasMore(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }

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
            <DramaCard key={item.id} item={item} />
          ))}
        </div>

        {hasMore ? (
          <div className="more">
            <button type="button" disabled={loadingMore} onClick={() => void loadMore()}>
              {loadingMore ? '加载中…' : '加载更多'}
            </button>
          </div>
        ) : null}
        {error && list.length ? <Status className="err">{error}</Status> : null}
      </div>
    </Page>
  )
}

const Page = styled.div`
  .container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px 20px 32px;
  }

  .head {
    margin-bottom: 20px;

    h1 {
      margin: 0 0 6px;
      font-family: ui-serif, 'Songti SC', 'STSong', 'SimSun', serif;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }

    .hint {
      margin: 0;
      font-size: 13px;
      color: rgba(232, 245, 238, 0.45);
    }
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 20px 16px;
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
      color: #e8f5ee;
      font-size: 14px;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;

      &:hover:not(:disabled) {
        border-color: rgba(62, 186, 122, 0.55);
        color: #3eba7a;
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

    .head h1 {
      font-size: 18px;
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
  color: rgba(232, 245, 238, 0.55);
  font-size: 14px;
  margin: 12px 0 24px;

  &.err {
    color: #e07070;
  }
`
