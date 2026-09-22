import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router'
import styled from 'styled-components'
import { categoryByPath, QQ_PAGES } from '../utils/categories'
import { buildQqFilterParams, fetchQqList } from '../utils/server'
import type { QqFilterGroup, QqTitle } from '../utils/types'
import { searchPath } from './TitleCard'

const PRIMARY_KEYS = new Set(['sort', 'itype', 'iarea'])
const HIDDEN_KEYS = new Set([
  'ipay',
  'producer',
  'characteristic',
  'award',
  'theater',
  'anime_status',
  'item',
  'exclusive',
])
const HIDDEN_NAMES = new Set([
  '免费/VIP',
  '资费',
  '出品方',
  '院线/网络',
  '获奖',
  '剧场',
  '连载/完结',
  '3D/2D',
  '自制/独播',
])

function isHiddenGroup(g: QqFilterGroup) {
  return HIDDEN_KEYS.has(g.key) || HIDDEN_NAMES.has(g.name)
}

function isPrimaryGroup(g: QqFilterGroup) {
  if (isHiddenGroup(g)) return false
  return PRIMARY_KEYS.has(g.key) || g.key.startsWith('type_')
}

function optionLabel(group: QqFilterGroup, opt: { n: string; v: string }) {
  if (opt.v === '-1' && opt.n === group.name) return null
  if (opt.v === '-1') return '全部'
  return opt.n
}

export default function TypePage() {
  const { pathname } = useLocation()
  const cat = categoryByPath(pathname)

  const [filters, setFilters] = useState<QqFilterGroup[]>([])
  const [selected, setSelected] = useState<Record<string, string>>({ sort: '75' })
  const [list, setList] = useState<QqTitle[]>([])
  const [nextCtx, setNextCtx] = useState('')
  const [hasNext, setHasNext] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const channelId = cat ? QQ_PAGES[cat.key] : ''
  const filterParams = useMemo(() => buildQqFilterParams(selected), [selected])

  const visibleFilters = useMemo(() => {
    const shown = filters.filter((g) => !isHiddenGroup(g))
    const primary = shown.filter(isPrimaryGroup)
    const extra = shown.filter((g) => !isPrimaryGroup(g))
    return expanded ? [...primary, ...extra] : primary
  }, [filters, expanded])

  const hasExtra = filters.some((g) => !isHiddenGroup(g) && !isPrimaryGroup(g))

  useEffect(() => {
    if (!cat) return
    setSelected({ sort: '75' })
    setFilters([])
    setList([])
    setExpanded(false)
  }, [cat])

  useEffect(() => {
    if (!cat || !channelId) return
    let cancelled = false
    setLoading(true)
    setError('')
    setNextCtx('')
    fetchQqList(channelId, filterParams)
      .then((data) => {
        if (cancelled) return
        setFilters(data.filters)
        setList(data.list)
        setHasNext(data.has_next)
        setNextCtx(data.next_ctx || '')
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载失败')
          setList([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cat, channelId, filterParams])

  if (!cat) {
    return <Status>未知分类</Status>
  }

  function pick(key: string, value: string) {
    setSelected((prev) => {
      const next = { ...prev }
      if (key === 'sort') {
        next.sort = value
        return next
      }
      if (prev[key] === value) {
        next[key] = '-1'
      } else {
        next[key] = value
      }
      if (key === 'itype') {
        for (const k of Object.keys(next)) {
          if (k.startsWith('type_') || k === 'recommend_1') delete next[k]
        }
      }
      return next
    })
  }

  async function loadMore() {
    if (!channelId || !nextCtx || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await fetchQqList(channelId, filterParams, nextCtx)
      setList((prev) => {
        const seen = new Set(prev.map((i) => i.cid || i.title))
        const extra = data.list.filter((i) => !seen.has(i.cid || i.title))
        return [...prev, ...extra]
      })
      if (data.filters.length) setFilters(data.filters)
      setHasNext(data.has_next)
      setNextCtx(data.next_ctx || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <Page>
      <div className="filters">
        <div className="filters-inner">
          {visibleFilters.map((group) => {
            const opts = group.options
              .map((o) => ({ ...o, label: optionLabel(group, o) }))
              .filter((o) => o.label)
            if (!opts.length) return null
            const current = selected[group.key] ?? (group.key === 'sort' ? '75' : '-1')
            const showLabel = group.key !== 'sort'
            return (
              <div
                key={group.key}
                className={`row ${group.key.startsWith('type_') ? 'is-sub' : ''}`}
              >
                {showLabel ? <span className="label">{group.name}</span> : <span className="label" />}
                <div className="opts">
                  {opts.map((o) => (
                    <button
                      key={`${group.key}-${o.v}`}
                      type="button"
                      className={current === o.v ? 'is-active' : ''}
                      onClick={() => pick(group.key, o.v)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          {hasExtra ? (
            <button type="button" className="expand" onClick={() => setExpanded((v) => !v)}>
              {expanded ? '收起' : '展开'}
              <span className={expanded ? 'up' : ''}>▾</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="container">
        {loading && <Status>加载中…</Status>}
        {error && <Status className="err">{error}</Status>}
        {!loading && !error && list.length === 0 && <Status>暂无内容</Status>}

        <div className="grid">
          {list.map((item) => (
            <PosterCard key={item.cid || item.title} item={item} />
          ))}
        </div>

        {hasNext ? (
          <div className="more">
            <button type="button" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? '加载中…' : '加载更多'}
            </button>
          </div>
        ) : null}
      </div>
    </Page>
  )
}

function PosterCard({ item }: { item: QqTitle }) {
  return (
    <Card to={searchPath(item.title)}>
      <div className="poster">
        {item.pic ? (
          <img src={item.pic} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <div className="placeholder" />
        )}
        {item.year ? <span className="year">{item.year}</span> : null}
        {item.badge ? <span className="badge">{item.badge}</span> : null}
        {item.score ? <span className="score">{item.score}</span> : null}
      </div>
      <h3 title={item.title}>{item.title}</h3>
      {item.sub ? <p>{item.sub}</p> : <p>点击搜索播放源</p>}
    </Card>
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

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 0;
    min-width: 0;

    &.is-sub {
      margin: 4px 0;
      padding: 8px 12px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.04);
    }
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
    transition: color 0.15s, background 0.15s;

    &:hover {
      color: #f5f2ea;
    }

    &.is-active {
      color: #e8a54b;
      font-weight: 600;
    }
  }

  .expand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    width: 100%;
    margin-top: 2px;
    padding: 8px;
    border: 0;
    background: transparent;
    color: rgba(245, 242, 234, 0.45);
    font-size: 13px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    span {
      display: inline-block;
      transition: transform 0.2s;
      &.up {
        transform: rotate(180deg);
      }
    }

    &:hover {
      color: #e8a54b;
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

      &.is-sub {
        margin: 2px 0;
        padding: 6px 8px;
      }
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

    .expand {
      padding: 6px;
      font-size: 12px;
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

const Card = styled(Link)`
  display: block;
  width: 100%;
  min-width: 0;
  text-decoration: none;
  color: inherit;
  -webkit-tap-highlight-color: transparent;

  @media (hover: hover) {
    transition: transform 0.2s;

    &:hover {
      transform: translateY(-3px);

      h3 {
        color: #e8a54b;
      }
    }
  }

  .poster {
    position: relative;
    width: 100%;
    aspect-ratio: 2 / 3;
    border-radius: 8px;
    overflow: hidden;
    background: #1a1a1f;
    /* 防止图片固有尺寸撑破等比容器 */
    contain: layout paint;

    img,
    .placeholder {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
    }

    img {
      object-fit: cover;
      object-position: center center;
    }

    .placeholder {
      background: linear-gradient(160deg, #1e1e24, #121216);
    }
  }

  .year {
    position: absolute;
    z-index: 1;
    top: 6px;
    left: 6px;
    padding: 2px 5px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.55);
    font-size: 10px;
    color: #fff;
  }

  .badge {
    position: absolute;
    z-index: 1;
    top: 6px;
    right: 6px;
    max-width: 46%;
    padding: 2px 5px;
    border-radius: 4px;
    background: #ff650f;
    font-size: 10px;
    font-weight: 700;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .score {
    position: absolute;
    z-index: 1;
    right: 6px;
    bottom: 6px;
    max-width: calc(100% - 12px);
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  h3 {
    margin: 8px 0 3px;
    height: 1.35em;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.35;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.15s;
  }

  p {
    margin: 0;
    height: 1.3em;
    font-size: 11px;
    line-height: 1.3;
    color: rgba(245, 242, 234, 0.45);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-width: 600px) {
    h3 {
      font-size: 12px;
      margin-top: 6px;
    }

    p {
      font-size: 10px;
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
