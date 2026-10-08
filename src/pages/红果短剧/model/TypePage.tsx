import { useEffect, useState } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router'
import styled from 'styled-components'
import DramaCard from './DramaCard'
import Pager from './Pager'
import { categoryByPath } from '../utils/categories'
import { searchDramas, type DramaListItem } from '../utils/server'

function parsePage(raw: string | null) {
  const n = Number(raw || '1')
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
}

export default function TypePage() {
  const { pathname } = useLocation()
  const [params, setParams] = useSearchParams()
  const cat = categoryByPath(pathname)
  const page = parsePage(params.get('page'))

  const [list, setList] = useState<DramaListItem[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!cat) return
    let cancelled = false
    const ac = new AbortController()
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await searchDramas('', page, cat.category, ac.signal)
        if (cancelled) return
        const items = data.list || []
        setList(items)
        setTotalPages(data.total_pages || 1)
        if (!items.length) setError('该分类暂无内容')
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return
        setList([])
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [cat, page])

  if (!cat) {
    return <Navigate to="/hongguo" replace />
  }

  function goPage(next: number) {
    const sp = new URLSearchParams(params)
    if (next <= 1) sp.delete('page')
    else sp.set('page', String(next))
    setParams(sp, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
            <DramaCard key={String(item.id)} item={item} />
          ))}
        </div>

        <Pager page={page} pagecount={totalPages} onChange={goPage} />
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
