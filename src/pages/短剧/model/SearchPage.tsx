import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import styled from 'styled-components'
import DramaCard from './DramaCard'
import Pager from './Pager'
import { searchDramas, type DramaListItem } from '../utils/server'

function parsePage(raw: string | null) {
  const n = Number(raw || '1')
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q')?.trim() || ''
  const page = parsePage(params.get('page'))

  const [draft, setDraft] = useState(q)
  const [list, setList] = useState<DramaListItem[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(q)
  }, [q])

  useEffect(() => {
    if (!q) {
      setList([])
      setError('')
      setLoading(false)
      setTotalPages(1)
      return
    }

    let cancelled = false
    const ac = new AbortController()
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await searchDramas(q, page, ac.signal)
        if (cancelled) return
        setList(data.list || [])
        setTotalPages(data.total_pages || 1)
        if (!(data.list || []).length) setError('没有搜到相关短剧')
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return
        setList([])
        setError(err instanceof Error ? err.message : '搜索失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [q, page])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    const sp = new URLSearchParams()
    if (text) sp.set('q', text)
    setParams(sp, { replace: true })
  }

  function goPage(next: number) {
    const sp = new URLSearchParams(params)
    if (next <= 1) sp.delete('page')
    else sp.set('page', String(next))
    setParams(sp, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <Page>
      <div className="container">
        <form className="search" onSubmit={onSubmit}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="搜索短剧名称，例如：小无赖"
            aria-label="搜索短剧"
            autoFocus
          />
          <button type="submit">搜索</button>
        </form>

        {!q ? <Status>输入剧名开始搜索</Status> : null}
        {q && loading && !list.length ? <Status>检索中…</Status> : null}
        {q && !loading && error ? <Status className="err">{error}</Status> : null}
        {q && !loading && !error ? (
          <p className="hint">
            「{q}」· {list.length} 条结果
            {totalPages > 1 ? ` · 第 ${page} / ${totalPages} 页` : ''}
          </p>
        ) : null}

        <div className="grid">
          {list.map((item) => (
            <DramaCard key={item.id} item={item} />
          ))}
        </div>

        {q ? (
          <Pager page={page} totalPages={totalPages} loading={loading} onChange={goPage} />
        ) : null}
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

  .search {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;

    input {
      flex: 1;
      min-height: 42px;
      padding: 0 16px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(255, 255, 255, 0.06);
      color: #e8f5ee;
      font: inherit;
      font-size: 14px;
      outline: none;

      &:focus {
        border-color: rgba(62, 186, 122, 0.55);
      }

      &::placeholder {
        color: rgba(232, 245, 238, 0.38);
      }
    }

    button {
      min-height: 42px;
      padding: 0 20px;
      border: 0;
      border-radius: 999px;
      background: linear-gradient(145deg, #4fd18a, #2f9d5f);
      color: #04120a;
      font: inherit;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
  }

  .hint {
    margin: 0 0 18px;
    font-size: 13px;
    color: rgba(232, 245, 238, 0.45);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 20px 16px;
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
  color: rgba(232, 245, 238, 0.55);
  font-size: 14px;
  margin: 12px 0 24px;

  &.err {
    color: #e07070;
  }
`
