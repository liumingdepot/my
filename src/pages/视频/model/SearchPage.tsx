import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import styled from 'styled-components'
import VodCard from './VodCard'
import { fetchSources, searchVideos } from '../utils/server'
import { mergeVodLists } from '../utils/merge'
import type { VodItem } from '../utils/types'

const PER_SOURCE_LIMIT = 10

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q')?.trim() || ''

  const [draft, setDraft] = useState(q)
  const [sources, setSources] = useState<string[]>([])
  const [list, setList] = useState<VodItem[]>([])
  const [pending, setPending] = useState(0)
  const [done, setDone] = useState(0)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setDraft(q)
  }, [q])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchSources()
        if (cancelled) return
        setSources(data.list.map((s) => s.name))
      } catch {
        if (!cancelled) setError('无法获取采集源')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null

    if (!q) {
      setList([])
      setPending(0)
      setDone(0)
      return
    }
    if (!sources.length) return

    const controller = new AbortController()
    abortRef.current = controller

    setList([])
    setError('')
    setDone(0)
    setPending(sources.length)

    let finished = 0

    for (const source of sources) {
      ;(async () => {
        try {
          const data = await searchVideos(q, 1, source, controller.signal)
          if (controller.signal.aborted) return
          const batch = data.list.slice(0, PER_SOURCE_LIMIT)
          if (batch.length) {
            setList((prev) => mergeVodLists(prev, batch))
          }
        } catch (err) {
          if (controller.signal.aborted) return
          if (err instanceof DOMException && err.name === 'AbortError') return
          /* 单源失败忽略 */
        } finally {
          if (controller.signal.aborted) return
          finished += 1
          setDone(finished)
          setPending(sources.length)
        }
      })()
    }

    return () => {
      controller.abort()
      if (abortRef.current === controller) abortRef.current = null
    }
  }, [q, sources])

  function stopSearch() {
    abortRef.current?.abort()
    abortRef.current = null
    // 中断后视为搜索结束，避免进度条一直转
    setPending((p) => {
      setDone(p)
      return p
    })
  }

  function onConfirm(e: FormEvent) {
    e.preventDefault()
    const keyword = draft.trim()
    if (!keyword) return

    const next = new URLSearchParams()
    next.set('q', keyword)
    setParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const loading = pending > 0 && done < pending

  return (
    <Page>
      <div className="container">
        <form className="search-form" onSubmit={onConfirm}>
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
              placeholder="搜索影片、演员…"
              aria-label="搜索关键词"
              autoFocus
            />
            <button type="submit" className="confirm">
              搜索
            </button>
          </div>
        </form>

        {!q && <Status>输入关键词后点击搜索</Status>}
        {q && (
          <p className="progress">
            {loading
              ? `正在搜索「${q}」· ${done}/${pending} 个源…已显示 ${list.length} 部`
              : `「${q}」共 ${list.length} 部 · 已查询 ${done} 个源`}
          </p>
        )}
        {error && <Status className="err">{error}</Status>}
        {!loading && q && list.length === 0 && !error && <Status>未找到相关影片</Status>}

        <div className="grid">
          {list.map((item, i) => (
            <VodCard
              key={`${item.source}-${item.vod_id}-${i}`}
              item={item}
              onSelect={stopSearch}
            />
          ))}
        </div>
      </div>
    </Page>
  )
}

const Page = styled.div`
  .container {
    max-width: 90vw;
    margin: 0 auto;
    padding: 28px 0 24px;
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
    transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;

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
    margin: 18px 0 24px;
    font-size: 13px;
    color: rgba(245, 242, 234, 0.45);
    text-align: center;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 18px 14px;
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
      padding: 20px 12px 24px;
    }

    .grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px 10px;
    }
  }

  @media (max-width: 600px) {
    .container {
      padding: 16px 12px 24px;
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
