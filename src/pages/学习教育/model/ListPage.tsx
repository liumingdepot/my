import { useEffect, useLayoutEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import styled from 'styled-components'
import {
  fetchEducationSources,
  fetchEducationVideos,
  formatPlayCount,
  type EducationFilter,
  type EducationSource,
  type EducationVideo,
} from '../utils/server'

const DURATION_FALLBACK: EducationFilter = {
  key: 'duration',
  name: '时长',
  value: [
    { n: '全部', v: '0' },
    { n: '60分钟以上', v: '4' },
    { n: '30~60分钟', v: '3' },
    { n: '10~30分钟', v: '2' },
    { n: '10分钟以下', v: '1' },
  ],
}

/** 小学 / 初中 / 高中：教材筛选默认人教版，并隐藏「全部」 */
function isEditionFilter(filter?: EducationFilter) {
  return Boolean(filter?.value.some((opt) => opt.n === '人教版'))
}

function defaultTidKeyword(filter?: EducationFilter) {
  if (!filter) return ''
  const renjiao = filter.value.find((opt) => opt.n === '人教版')
  return renjiao?.v ?? ''
}

function visibleTidOptions(filter: EducationFilter) {
  if (!isEditionFilter(filter)) return filter.value
  return filter.value.filter((opt) => opt.n !== '全部' && opt.v !== '0')
}

function VideoCard({ video }: { video: EducationVideo }) {
  return (
    <Link to={`/education/play/${video.bvid}`} className="card" title={video.title}>
      <div className="card__media">
        {video.pic ? (
          <img src={video.pic} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <span className="card__placeholder">{video.title.slice(0, 1) || '教'}</span>
        )}
        <div className="card__shade" />
        {video.duration ? <span className="card__duration">{video.duration}</span> : null}
      </div>
      <div className="card__body">
        <h3 className="card__title">{video.title}</h3>
        <p className="card__meta">
          <span>{video.author || 'UP主'}</span>
          <span>{formatPlayCount(video.play)} 播放</span>
        </p>
      </div>
    </Link>
  )
}

export default function ListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = (searchParams.get('q') ?? '').trim()

  const [sources, setSources] = useState<EducationSource[]>([])
  const [sourceId, setSourceId] = useState('')
  const [typeId, setTypeId] = useState('')
  const [tidKeyword, setTidKeyword] = useState('')
  const [duration, setDuration] = useState('0')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<EducationVideo[]>([])
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [sourcesLoading, setSourcesLoading] = useState(true)
  const [listLoading, setListLoading] = useState(false)
  const [error, setError] = useState('')
  const [draftQ, setDraftQ] = useState(q)

  const activeSource = useMemo(
    () => sources.find((item) => item.id === sourceId) ?? null,
    [sources, sourceId],
  )

  const classes = activeSource?.classes ?? []
  const classFilters = useMemo(() => {
    if (!activeSource || !typeId) return [] as EducationFilter[]
    return activeSource.filter[typeId] ?? []
  }, [activeSource, typeId])

  const tidFilter = classFilters.find((item) => item.key === 'tid')
  const tidOptions = tidFilter ? visibleTidOptions(tidFilter) : []
  const durationFilter =
    classFilters.find((item) => item.key === 'duration') ?? DURATION_FALLBACK

  const searchKeyword = useMemo(() => {
    if (tidFilter?.value.some((opt) => opt.v === tidKeyword && opt.n !== '全部' && opt.v !== '0')) {
      return tidKeyword
    }
    return defaultTidKeyword(tidFilter) || typeId
  }, [tidFilter, tidKeyword, typeId])

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = '铭教育'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0a0c10')
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    ;(async () => {
      setSourcesLoading(true)
      setError('')
      try {
        const next = await fetchEducationSources(ac.signal)
        if (ac.signal.aborted) return
        setSources(next)
        if (next[0]) {
          const firstType = next[0].classes[0]?.typeId ?? ''
          const tid = next[0].filter[firstType]?.find((item) => item.key === 'tid')
          setSourceId(next[0].id)
          setTypeId(firstType)
          setTidKeyword(defaultTidKeyword(tid))
        }
      } catch (err) {
        if (!ac.signal.aborted) {
          setError(err instanceof Error ? err.message : '教育源加载失败')
        }
      } finally {
        if (!ac.signal.aborted) setSourcesLoading(false)
      }
    })()
    return () => ac.abort()
  }, [])

  useEffect(() => {
    const source = sources.find((item) => item.id === sourceId)
    if (!source || !typeId) {
      setTidKeyword('')
      setDuration('0')
      setPage(1)
      return
    }
    const tid = source.filter[typeId]?.find((item) => item.key === 'tid')
    setTidKeyword(defaultTidKeyword(tid))
    setDuration('0')
    setPage(1)
  }, [typeId, sourceId, sources])

  useEffect(() => {
    setPage(1)
  }, [tidKeyword, duration, q])

  useEffect(() => {
    setDraftQ(q)
  }, [q])

  useEffect(() => {
    if (!sourceId || !typeId) {
      setItems([])
      setTotal(0)
      setPageCount(1)
      return
    }

    const ac = new AbortController()
    ;(async () => {
      setListLoading(true)
      setError('')
      try {
        const result = await fetchEducationVideos({
          sourceId,
          typeId,
          keyword: searchKeyword,
          q,
          page,
          duration: Number(duration) || 0,
          signal: ac.signal,
        })
        if (ac.signal.aborted) return
        setItems(result.items)
        setTotal(result.total)
        setPageCount(result.pageCount)
      } catch (err) {
        if (!ac.signal.aborted) {
          setItems([])
          setError(err instanceof Error ? err.message : '视频列表加载失败')
        }
      } finally {
        if (!ac.signal.aborted) setListLoading(false)
      }
    })()
    return () => ac.abort()
  }, [sourceId, typeId, searchKeyword, q, duration, page])

  function applySearch(next: string) {
    const trimmed = next.trim()
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (trimmed) params.set('q', trimmed)
        else params.delete('q')
        return params
      },
      { replace: true },
    )
  }

  function onSearch(e: FormEvent) {
    e.preventDefault()
    applySearch(draftQ)
  }

  function clearSearch() {
    setDraftQ('')
    applySearch('')
  }

  const safePage = Math.min(page, pageCount)

  return (
    <Style>
      <header className="top">
        <div className="shell top__inner">
          <Link to="/" className="brand" aria-label="铭教育">
            <span className="brand__mark">教</span>
            <span className="brand__text">铭教育</span>
          </Link>

          {sourcesLoading ? (
            <p className="source-status">加载中</p>
          ) : sources.length === 0 ? (
            <p className="source-status">暂无教育源</p>
          ) : (
            <nav className="source-rail" role="tablist" aria-label="教育源">
              {sources.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  role="tab"
                  aria-selected={source.id === sourceId}
                  className={source.id === sourceId ? 'is-active' : ''}
                  onClick={() => {
                    setSourceId(source.id)
                    setTypeId(source.classes[0]?.typeId ?? '')
                  }}
                >
                  {source.name}
                </button>
              ))}
            </nav>
          )}

          <form className="search" onSubmit={onSearch} role="search">
            <svg className="search__icon" viewBox="0 0 24 24" aria-hidden>
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
              value={draftQ}
              onChange={(e) => setDraftQ(e.target.value)}
              placeholder="搜索课程…"
              aria-label="在教育范围内搜索"
            />
            {draftQ || q ? (
              <button type="button" className="search__clear" onClick={clearSearch} aria-label="清除搜索">
                ×
              </button>
            ) : null}
            <button type="submit" className="search__go">
              搜索
            </button>
          </form>
        </div>
      </header>

      {activeSource ? (
        <div className="filters">
          <div className="shell filters-inner">
            <div className="row">
              <span className="label">分类</span>
              <div className="opts">
                {classes.map((item) => (
                  <button
                    key={item.typeId}
                    type="button"
                    className={typeId === item.typeId ? 'is-active' : ''}
                    onClick={() => setTypeId(item.typeId)}
                  >
                    {item.typeName}
                  </button>
                ))}
              </div>
            </div>

            {tidFilter && tidOptions.length ? (
              <div className="row">
                <span className="label">{tidFilter.name}</span>
                <div className="opts">
                  {tidOptions.map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      className={tidKeyword === opt.v ? 'is-active' : ''}
                      onClick={() => setTidKeyword(opt.v)}
                    >
                      {opt.n}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="row">
              <span className="label">{durationFilter.name}</span>
              <div className="opts">
                {durationFilter.value.map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    className={duration === opt.v ? 'is-active' : ''}
                    onClick={() => setDuration(opt.v)}
                  >
                    {opt.n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <main className="shell main">
        <div className="list-head">
          <h2>{q ? `搜索「${q}」` : '全部课程'}</h2>
          <span>{total > 0 ? `${total} 条` : ''}</span>
        </div>

        {error && !items.length ? (
          <p className="status status--err">{error}</p>
        ) : listLoading && !items.length ? (
          <p className="status">加载中</p>
        ) : !sourceId || !typeId ? (
          <p className="status">请选择教育源与分类</p>
        ) : items.length === 0 ? (
          <p className="status">没有找到相关视频</p>
        ) : (
          <div className={`grid${listLoading ? ' grid--dim' : ''}`}>
            {items.map((video) => (
              <VideoCard key={video.bvid} video={video} />
            ))}
          </div>
        )}

        {pageCount > 1 ? (
          <div className="pager">
            <button
              type="button"
              className="pager__btn"
              disabled={safePage <= 1 || listLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </button>
            <span className="pager__info">
              {safePage} / {pageCount}
            </span>
            <button
              type="button"
              className="pager__btn"
              disabled={safePage >= pageCount || listLoading}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              下一页
            </button>
          </div>
        ) : null}
      </main>
    </Style>
  )
}

const Style = styled.div`
  --bg: #0a0c10;
  --ink: #f0eee8;
  --muted: rgba(240, 238, 232, 0.52);
  --line: rgba(240, 238, 232, 0.1);
  --gold: #c9a46a;
  --gold-soft: rgba(201, 164, 106, 0.16);
  --serif: "Songti SC", "STSong", "Noto Serif SC", "Source Han Serif SC", Georgia, serif;
  --sans: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif;

  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  color: var(--ink);
  background:
    radial-gradient(1100px 520px at 8% -8%, rgba(201, 164, 106, 0.14), transparent 55%),
    radial-gradient(900px 480px at 92% 4%, rgba(90, 120, 160, 0.12), transparent 50%),
    linear-gradient(180deg, #12151c 0%, var(--bg) 38%, #06080c 100%);
  font-family: var(--sans);

  .shell {
    width: 90%;
    max-width: 1680px;
    margin-left: auto;
    margin-right: auto;
  }

  .top {
    position: sticky;
    top: 0;
    z-index: 30;
    border-bottom: 1px solid var(--line);
    background: rgba(10, 12, 16, 0.72);
    backdrop-filter: blur(18px) saturate(1.3);
  }

  .top__inner {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 0.85rem 0;
    min-width: 0;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.7rem;
    color: inherit;
    text-decoration: none;
    flex-shrink: 0;
  }

  .brand__mark {
    width: 2.15rem;
    height: 2.15rem;
    display: grid;
    place-items: center;
    border-radius: 0.55rem;
    background: linear-gradient(145deg, #e2c48a 0%, #c9a46a 48%, #9a7340 100%);
    color: #14110c;
    font-family: var(--serif);
    font-size: 1.05rem;
    font-weight: 700;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.16) inset,
      0 6px 18px rgba(201, 164, 106, 0.22);
  }

  .brand__text {
    font-family: var(--serif);
    font-size: 1.28rem;
    font-weight: 700;
    letter-spacing: 0.12em;
  }

  .source-status {
    margin: 0;
    flex: 1;
    min-width: 0;
    color: var(--muted);
    font-size: 0.88rem;
  }

  .source-rail {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    gap: 0.15rem;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .source-rail button {
    position: relative;
    flex-shrink: 0;
    height: 2.25rem;
    padding: 0 0.9rem;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: rgba(240, 238, 232, 0.62);
    font: inherit;
    font-size: 0.9rem;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: color 0.2s;

    &::after {
      content: '';
      position: absolute;
      left: 0.9rem;
      right: 0.9rem;
      bottom: 0.15rem;
      height: 2px;
      border-radius: 1px;
      background: var(--gold);
      transform: scaleX(0);
      transform-origin: center;
      transition: transform 0.22s ease;
    }

    &:hover {
      color: var(--ink);
    }

    &.is-active {
      color: var(--ink);
      font-weight: 600;

      &::after {
        transform: scaleX(1);
      }
    }
  }

  .search {
    display: flex;
    align-items: center;
    flex: 0 1 18rem;
    min-width: 11rem;
    max-width: 22rem;
    height: 2.35rem;
    margin-left: auto;
    padding: 0 0.2rem 0 0.75rem;
    border-radius: 0.55rem;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.04);
    transition: border-color 0.2s, background 0.2s;

    &:focus-within {
      border-color: rgba(201, 164, 106, 0.55);
      background: rgba(201, 164, 106, 0.08);
    }
  }

  .search__icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    color: var(--muted);
  }

  .search input {
    flex: 1;
    min-width: 0;
    height: 100%;
    margin: 0 0.35rem;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 0.88rem;
    outline: none;

    &::placeholder {
      color: rgba(240, 238, 232, 0.38);
    }
  }

  .search__clear {
    flex-shrink: 0;
    width: 1.5rem;
    height: 1.5rem;
    margin-right: 0.15rem;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 1.1rem;
    line-height: 1;
    cursor: pointer;

    &:hover {
      color: var(--ink);
      background: rgba(255, 255, 255, 0.08);
    }
  }

  .search__go {
    flex-shrink: 0;
    height: calc(100% - 0.3rem);
    padding: 0 0.85rem;
    border: 0;
    border-radius: 0.4rem;
    background: linear-gradient(145deg, #e2c48a 0%, #c9a46a 48%, #9a7340 100%);
    color: #14110c;
    font: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: opacity 0.2s, filter 0.2s;

    &:hover {
      filter: brightness(1.06);
    }
  }

  .filters {
    background: rgba(10, 12, 16, 0.45);
    border-bottom: 1px solid var(--line);
  }

  .filters-inner {
    padding: 0.75rem 0 0.65rem;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.35rem 0;
    min-width: 0;
  }

  .label {
    flex: 0 0 3rem;
    font-size: 0.82rem;
    color: rgba(240, 238, 232, 0.42);
    white-space: nowrap;
  }

  .opts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.15rem 0.1rem;
    flex: 1;
    min-width: 0;
  }

  .opts button {
    height: 1.9rem;
    padding: 0 0.75rem;
    border: 0;
    border-radius: 0.25rem;
    background: transparent;
    color: rgba(240, 238, 232, 0.72);
    font: inherit;
    font-size: 0.82rem;
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s, background 0.15s;

    &:hover {
      color: var(--ink);
    }

    &.is-active {
      color: var(--gold);
      font-weight: 600;
    }
  }

  .main {
    padding: 1.6rem 0 3.5rem;
    flex: 1;
  }

  .list-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .list-head h2 {
    margin: 0;
    font-family: var(--serif);
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: 0.08em;
  }

  .list-head span {
    color: var(--muted);
    font-size: 0.85rem;
  }

  .status {
    margin: 0;
    padding: 3rem 0;
    color: var(--muted);
    text-align: center;
    letter-spacing: 0.04em;
  }

  .status--err {
    color: #f0a8a8;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 1.35rem 1rem;
  }

  .grid--dim {
    opacity: 0.55;
  }

  .card {
    display: grid;
    gap: 0.65rem;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    font: inherit;
    min-width: 0;
    transition: transform 0.2s;

    @media (hover: hover) {
      &:hover {
        transform: translateY(-3px);

        .card__title {
          color: var(--gold);
        }

        .card__media {
          box-shadow:
            inset 0 0 0 1px rgba(201, 164, 106, 0.28),
            0 16px 36px rgba(0, 0, 0, 0.35);
        }
      }
    }
  }

  .card__media {
    position: relative;
    aspect-ratio: 16 / 10;
    border-radius: 0.55rem;
    overflow: hidden;
    background: #151820;
    box-shadow: inset 0 0 0 1px var(--line);
    transition: box-shadow 0.2s;
  }

  .card__media img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .card__placeholder {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    font-family: var(--serif);
    font-size: 1.8rem;
    color: var(--muted);
  }

  .card__shade {
    position: absolute;
    inset: auto 0 0;
    height: 48%;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.55));
    pointer-events: none;
  }

  .card__duration {
    position: absolute;
    right: 0.45rem;
    bottom: 0.45rem;
    z-index: 1;
    padding: 0.12rem 0.4rem;
    border-radius: 0.25rem;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    font-size: 0.7rem;
    letter-spacing: 0.02em;
  }

  .card__body {
    display: grid;
    gap: 0.3rem;
    padding: 0 0.05rem;
  }

  .card__title {
    margin: 0;
    font-size: 0.92rem;
    font-weight: 600;
    line-height: 1.4;
    transition: color 0.2s;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card__meta {
    margin: 0;
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    color: var(--muted);
    font-size: 0.74rem;
  }

  .pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding-top: 2rem;
  }

  .pager__btn {
    min-width: 6.5rem;
    height: 2.5rem;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.03);
    color: var(--ink);
    border-radius: 0.5rem;
    font: inherit;
    font-size: 0.88rem;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: border-color 0.2s, color 0.2s;

    &:hover:not(:disabled) {
      border-color: rgba(201, 164, 106, 0.5);
      color: var(--gold);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  .pager__info {
    color: var(--muted);
    font-size: 0.9rem;
    letter-spacing: 0.06em;
  }

  @media (max-width: 1200px) {
    .grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (max-width: 900px) {
    .shell {
      width: calc(100% - 1.5rem);
    }

    .top__inner {
      flex-wrap: wrap;
      gap: 0.35rem 0.75rem;
      padding: 0.65rem 0 0.45rem;
    }

    .source-status,
    .source-rail {
      flex: 1 1 100%;
      width: 100%;
      order: 3;
    }

    .search {
      flex: 1 1 auto;
      min-width: 0;
      max-width: none;
      margin-left: 0;
      order: 2;
    }

    .brand {
      order: 1;
    }

    .source-rail button {
      height: 2.1rem;
      padding: 0 0.7rem;
      font-size: 0.85rem;

      &::after {
        left: 0.7rem;
        right: 0.7rem;
        bottom: 0.05rem;
      }
    }

    .filters-inner {
      padding: 0.55rem 0 0.45rem;
    }

    .row {
      gap: 0.5rem;
      padding: 0.25rem 0;
    }

    .label {
      flex: 0 0 2.25rem;
      font-size: 0.75rem;
    }

    .opts {
      flex-wrap: nowrap;
      overflow-x: auto;
      gap: 0;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;

      &::-webkit-scrollbar {
        display: none;
      }
    }

    .opts button {
      flex-shrink: 0;
      height: 2rem;
      padding: 0 0.65rem;
    }

    .grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem 0.7rem;
    }
  }

  @media (max-width: 600px) {
    .brand__text {
      font-size: 1.1rem;
    }

    .list-head h2 {
      font-size: 1.15rem;
    }

    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.9rem 0.55rem;
    }

    .pager__btn {
      min-width: 0;
      flex: 1;
    }
  }
`
