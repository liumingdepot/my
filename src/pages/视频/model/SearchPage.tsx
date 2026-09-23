import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import styled from 'styled-components'
import VodCard from './VodCard'
import { pickBestMatch } from '../utils/match'
import { mergeVodLists, saveMergedEntries } from '../utils/merge'
import { fetchSources, searchVideos } from '../utils/server'
import type { VodItem } from '../utils/types'

const PER_SOURCE_LIMIT = 10
/** 精确命中后，最多再等这么久收集更多镜像源 */
const EARLY_WAIT_MS = 2200

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const q = params.get('q')?.trim() || ''
  const year = params.get('year')?.trim() || ''
  const auto = params.get('auto') === '1'

  const [draft, setDraft] = useState(q)
  const [sources, setSources] = useState<string[]>([])
  const [list, setList] = useState<VodItem[]>([])
  const [pending, setPending] = useState(0)
  const [done, setDone] = useState(0)
  const [error, setError] = useState('')
  const [matching, setMatching] = useState(auto)
  const [matchHint, setMatchHint] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const jumpedRef = useRef(false)
  const earlyTimerRef = useRef<number | null>(null)
  const listRef = useRef<VodItem[]>([])

  useEffect(() => {
    setDraft(q)
  }, [q])

  useEffect(() => {
    listRef.current = list
  }, [list])

  useEffect(() => {
    setMatching(auto)
    if (auto) {
      jumpedRef.current = false
      setMatchHint('')
    }
  }, [auto, q, year])

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

  function goPlay(item: VodItem) {
    if (jumpedRef.current) return
    jumpedRef.current = true
    const entries = item.mergedEntries?.length
      ? item.mergedEntries
      : [{ source: item.source, vod_id: item.vod_id }]
    saveMergedEntries(entries)
    abortRef.current?.abort()
    navigate(`/video/play/${encodeURIComponent(item.source)}/${item.vod_id}`, {
      replace: true,
      state: { mirrors: entries },
    })
  }

  function fallbackManual(hint: string) {
    setMatching(false)
    setMatchHint(hint)
    if (!auto) return
    const next = new URLSearchParams()
    next.set('q', q)
    if (year) next.set('year', year)
    setParams(next, { replace: true })
  }

  // 搜索只跟 q / sources 走；去掉 auto 时不重搜、不清空列表
  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null
    jumpedRef.current = false

    if (!q) {
      setList([])
      setPending(0)
      setDone(0)
      setMatchHint('')
      return
    }
    if (!sources.length) return

    const controller = new AbortController()
    abortRef.current = controller

    setList([])
    listRef.current = []
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
            setList((prev) => {
              const next = mergeVodLists(prev, batch)
              listRef.current = next
              return next
            })
          }
        } catch (err) {
          if (controller.signal.aborted) return
          if (err instanceof DOMException && err.name === 'AbortError') return
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

  // 智能匹配：精确命中后稍等收集镜像，再进播放页
  useEffect(() => {
    if (!auto || !q || !matching) return
    if (jumpedRef.current) return

    const best = pickBestMatch(q, year, list)
    const allDone = pending > 0 && done >= pending

    if (best) {
      if (allDone) {
        goPlay(best)
        return
      }
      if (earlyTimerRef.current == null) {
        earlyTimerRef.current = window.setTimeout(() => {
          earlyTimerRef.current = null
          const hit = pickBestMatch(q, year, listRef.current)
          if (hit && !jumpedRef.current) goPlay(hit)
        }, EARLY_WAIT_MS)
      }
      return
    }

    if (allDone) {
      fallbackManual(
        list.length ? '未精确匹配到同名影片，请手动选择' : '未找到相关影片，可改关键词再搜',
      )
    }

    return () => {
      if (earlyTimerRef.current != null) {
        window.clearTimeout(earlyTimerRef.current)
        earlyTimerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, matching, q, year, list, done, pending])

  function stopSearch() {
    abortRef.current?.abort()
    abortRef.current = null
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
        <div className="sticky-bar">
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
                autoFocus={!auto}
              />
              <button type="submit" className="confirm">
                搜索
              </button>
            </div>
          </form>

          {!q && <Status>输入关键词后点击搜索</Status>}
          {q && matching && (
            <p className="progress match">
              正在匹配「{q}」{year ? ` · ${year}` : ''}
              {loading ? ` · ${done}/${pending} 源` : ''}
              {list.length ? ` · 已找到 ${list.length} 部候选` : '…'}
            </p>
          )}
          {q && !matching && (
            <p className="progress">
              {matchHint ? `${matchHint} · ` : ''}
              {loading
                ? `正在搜索「${q}」· ${done}/${pending} 个源…已显示 ${list.length} 部`
                : `「${q}」共 ${list.length} 部 · 已查询 ${done} 个源`}
            </p>
          )}
        </div>

        {matching ? (
          <MatchPanel>
            <div className="spin" />
            <p>智能匹配播放源</p>
            <span>精确命中后将自动进入播放</span>
          </MatchPanel>
        ) : (
          <>
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
          </>
        )}
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
    margin: 14px 0 12px;
    font-size: 13px;
    color: rgba(245, 242, 234, 0.45);
    text-align: center;

    &.match {
      color: rgba(232, 165, 75, 0.9);
    }
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

const MatchPanel = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 42vh;
  padding: 48px 16px;
  color: rgba(245, 242, 234, 0.7);

  .spin {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 2px solid rgba(232, 165, 75, 0.25);
    border-top-color: #e8a54b;
    animation: spin 0.8s linear infinite;
  }

  p {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #f5f2ea;
  }

  span {
    font-size: 13px;
    color: rgba(245, 242, 234, 0.42);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
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
