import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import styled from 'styled-components'
import DramaCard from './DramaCard'
import Pager from './Pager'
import SearchHistory from './SearchHistory'
import {
  clearSearchHistory,
  deleteSearchHistory,
  readSearchHistory,
  saveSearchHistory,
  subscribeSearchHistory,
} from '../utils/history'
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
  const [searchHistory, setSearchHistory] = useState(() => readSearchHistory())

  useEffect(() => subscribeSearchHistory(() => setSearchHistory(readSearchHistory())), [])

  useEffect(() => {
    setDraft(q)
  }, [q])

  useEffect(() => {
    if (q) saveSearchHistory(q)
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
        const data = await searchDramas(q, page, '', ac.signal)
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
    if (text) {
      saveSearchHistory(text)
      sp.set('q', text)
    }
    setParams(sp, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function pickHistory(keyword: string) {
    setDraft(keyword)
    saveSearchHistory(keyword)
    const sp = new URLSearchParams()
    sp.set('q', keyword)
    setParams(sp, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
        <div className="sticky-bar">
          <form className="search-form" onSubmit={onSubmit}>
            <div className="row">
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M16.5 16.5L21 21"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="搜索短剧名称…"
                aria-label="搜索短剧"
                autoFocus
              />
              <button type="submit" className="confirm">
                搜索
              </button>
            </div>
          </form>

          {!q && (
            <div className="history-wrap">
              {searchHistory.length ? (
                <SearchHistory
                  items={searchHistory}
                  onPick={pickHistory}
                  onDelete={deleteSearchHistory}
                  onClear={clearSearchHistory}
                />
              ) : (
                <Status>输入关键词后点击搜索</Status>
              )}
            </div>
          )}
          {q ? (
            <p className="progress">
              {loading
                ? `正在搜索「${q}」…`
                : error
                  ? error
                  : `「${q}」共 ${list.length} 部${totalPages > 1 ? ` · 第 ${page} / ${totalPages} 页` : ''}`}
            </p>
          ) : null}
        </div>

        {q && loading && !list.length ? <Status>检索中…</Status> : null}
        {q && !loading && error && !list.length ? <Status className="err">{error}</Status> : null}

        <div className="grid">
          {list.map((item) => (
            <DramaCard key={String(item.id)} item={item} />
          ))}
        </div>

        {q ? <Pager page={page} pagecount={totalPages} onChange={goPage} /> : null}
      </div>
    </Page>
  )
}

const Page = styled.div`
  .container {
    max-width: 90vw;
    margin: 0 auto;
    padding: 0 0 24px;
  }

  .sticky-bar {
    position: sticky;
    top: 64px;
    z-index: 40;
    padding: 20px 0 8px;
    margin: 0 -4px;
    background: rgba(10, 10, 12, 0.55);
    backdrop-filter: blur(22px) saturate(1.45);
    -webkit-backdrop-filter: blur(22px) saturate(1.45);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.28);
  }

  .search-form {
    max-width: 560px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .row {
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
    height: 44px;
    padding: 0 3px 0 36px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.08);
    box-sizing: border-box;
    transition:
      border-color 0.2s,
      background 0.2s,
      box-shadow 0.2s;

    &:focus-within {
      border-color: rgba(232, 165, 75, 0.55);
      background: rgba(255, 255, 255, 0.12);
      box-shadow: 0 0 0 3px rgba(232, 165, 75, 0.12);
    }

    .icon {
      position: absolute;
      left: 12px;
      width: 16px;
      height: 16px;
      color: rgba(245, 242, 234, 0.45);
      pointer-events: none;
    }

    input {
      flex: 1;
      min-width: 0;
      height: 100%;
      padding: 0 8px 0 0;
      border: 0;
      background: transparent;
      color: #f5f2ea;
      font-size: 14px;
      outline: 0;

      &::placeholder {
        color: rgba(245, 242, 234, 0.38);
      }
    }
  }

  .confirm {
    flex-shrink: 0;
    height: calc(100% - 6px);
    padding: 0 16px;
    border: 0;
    border-radius: 999px;
    background: linear-gradient(145deg, #f0b85c, #e8a54b);
    color: #0a0a0c;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: opacity 0.2s;

    &:hover {
      opacity: 0.92;
    }
  }

  .progress {
    margin: 14px 0 12px;
    font-size: 13px;
    color: rgba(245, 242, 234, 0.45);
    text-align: center;
  }

  .history-wrap {
    max-width: 560px;
    margin: 16px auto 8px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 18px 14px;
    align-items: start;
    padding-top: 12px;
  }

  @media (max-width: 1200px) {
    .grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (max-width: 900px) {
    .container {
      max-width: 100%;
      padding: 0 12px 24px;
    }

    .sticky-bar {
      top: 96px;
      padding: 14px 0 4px;
    }

    .grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px 10px;
    }
  }

  @media (max-width: 600px) {
    .container {
      padding: 0 12px 24px;
    }

    .sticky-bar {
      padding: 12px 0 2px;
    }

    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px 8px;
    }
  }
`

const Status = styled.p`
  color: rgba(245, 242, 234, 0.55);
  font-size: 14px;
  margin: 16px 0;
  text-align: center;

  &.err {
    color: #e07070;
  }
`
