import { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from 'react'
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router'
import styled from 'styled-components'
import { listFavorites, subscribeFavorites } from '../utils/favorites'
import {
  fetchGameList,
  GAME_PLATFORMS,
  genresForPlatform,
  type GamePlatform,
  type PublicGame,
} from '../utils/server'
import { GameFrame, GameThemeToggle, GameCover } from './Layout'

type GameOutlet = {
  toggleTheme: () => void
}

/** 与 yikm `/nes` 每页条数对齐 */
const PAGE_SIZE = 20

function parsePlatform(value: string | null): GamePlatform {
  if (value === '街机' || value === '网页游戏' || value === '怀旧java') return value
  return 'FC'
}

/** 列表项与收藏项共用的最小字段集合 */
type GameCardData = Pick<PublicGame, 'id' | 'name' | 'imageUrl' | 'genre'>

function GameCard({
  game,
  hideGenre = false,
}: {
  game: GameCardData
  hideGenre?: boolean
}) {
  const genreLabel = game.genre?.split(/[、,/|]/)[0] || ''
  return (
    <Link className="card" to={`/game/${game.id}`} title={game.name}>
      <div className="card__cover">
        <GameCover src={game.imageUrl} />
        <div className="card__shade" aria-hidden />
        {!hideGenre && genreLabel ? <span className="card__cat">{genreLabel}</span> : null}
      </div>
      <div className="card__meta">
        <h3 className="card__title">{game.name}</h3>
        {!hideGenre ? <p className="card__genre">{game.genre || '未分类'}</p> : null}
      </div>
    </Link>
  )
}

function searchPath(keyword: string) {
  return keyword ? `/game/search?q=${encodeURIComponent(keyword)}` : '/game/search'
}

export default function ListPage() {
  const { toggleTheme } = useOutletContext<GameOutlet>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<PublicGame[]>([])
  const [pageCount, setPageCount] = useState(1)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const platform = parsePlatform(searchParams.get('platform'))
  const [filter, setFilter] = useState('')
  const [favOnly, setFavOnly] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [error, setError] = useState('')

  const genres = genresForPlatform(platform)

  // 收藏为本地数据，用 useSyncExternalStore 保证快照引用稳定
  const favorites = useSyncExternalStore(subscribeFavorites, listFavorites, listFavorites)
  const favCount = favorites.length

  /** 收藏是独立列表：不区分平台，直接用本地缓存渲染，不请求列表接口 */
  const favItems = useMemo(() => favorites, [favorites])

  useLayoutEffect(() => {
    document.title = '铭游戏'
    const html = document.documentElement
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    html.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
    }
  }, [])

  useEffect(() => {
    setPage(1)
    setFilter('')
  }, [platform])

  useEffect(() => {
    setPage(1)
  }, [filter])

  useEffect(() => {
    // 收藏视图完全走本地缓存，不发请求
    if (favOnly) {
      setItems([])
      setPageCount(1)
      setListLoading(false)
      setError('')
      return
    }

    const ac = new AbortController()
    ;(async () => {
      setListLoading(true)
      try {
        const result = await fetchGameList({
          page,
          pageSize: PAGE_SIZE,
          category: platform,
          genre: filter || '',
          signal: ac.signal,
        })
        if (ac.signal.aborted) return
        setItems(result.items)
        setPageCount(result.pageCount)
        setError('')
      } catch (err) {
        if (!ac.signal.aborted) {
          setError(err instanceof Error ? err.message : '列表加载失败')
        }
      } finally {
        if (!ac.signal.aborted) setListLoading(false)
      }
    })()
    return () => ac.abort()
  }, [page, filter, platform, favOnly])

  function onSearch(e: FormEvent) {
    e.preventDefault()
    navigate(searchPath(query.trim()))
  }

  function switchPlatform(next: GamePlatform) {
    // 收藏是跨平台的独立列表，点平台 tab 即退出收藏、回到该平台浏览
    if (!favOnly && next === platform) return
    setFavOnly(false)
    setSearchParams(next === 'FC' ? {} : { platform: next }, { replace: true })
    setQuery('')
    setPage(1)
  }

  const safePage = Math.min(page, pageCount)
  const shownItems = favOnly ? favItems : items
  const hasListContent = shownItems.length > 0
  const showPager = !favOnly

  return (
    <GameFrame>
      <Style>
      <header className="top">
        <div className="shell top__inner">
          <div className="top__row">
            <Link
              to="/game"
              className="brand"
              aria-label="铭游戏"
              onClick={() => {
                setSearchParams({}, { replace: true })
                setFilter('')
                setQuery('')
                setPage(1)
              }}
            >
              <span className="brand__mark">铭</span>
              <span className="brand__text">铭游戏</span>
            </Link>

            <div className="platforms" role="tablist" aria-label="平台切换">
              {GAME_PLATFORMS.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={!favOnly && platform === item}
                  className={`cat${!favOnly && platform === item ? ' is-active' : ''}`}
                  onClick={() => switchPlatform(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <form className="search" onSubmit={onSearch} role="search">
              <svg viewBox="0 0 24 24" aria-hidden width="16" height="16">
                <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M20 20l-3.5-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索 FC / 街机 / 网页游戏 / 怀旧java…"
                aria-label="搜索游戏"
              />
              <button type="submit" className="search__btn">
                搜索
              </button>
            </form>

            <div className="top__actions">
              <button
                type="button"
                className={`favtab${favOnly ? ' is-active' : ''}`}
                aria-pressed={favOnly}
                onClick={() => setFavOnly((v) => !v)}
                title={favCount ? `已收藏 ${favCount} 个游戏` : '查看收藏的游戏'}
              >
                <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden>
                  <path
                    d="M12 3.6l2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-3.9 5.6-.8z"
                    fill={favOnly ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
                收藏
                {favCount ? <b className="favtab__count">{favCount}</b> : null}
              </button>
              <GameThemeToggle onToggle={toggleTheme} />
            </div>
          </div>
        </div>
      </header>

      <main className="shell main">
        {favOnly ? null : (
          <div className="toolbar">
            <div className="cats" role="tablist" aria-label="类型筛选">
              <button
                type="button"
                role="tab"
                aria-selected={!filter}
                className={`cat${!filter ? ' is-active' : ''}`}
                onClick={() => setFilter('')}
              >
                全部
              </button>
              {genres.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={filter === item}
                  className={`cat${filter === item ? ' is-active' : ''}`}
                  onClick={() => setFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        <section className="section section--list">
          <div className="section__body">
            {error && !hasListContent ? (
              <p className="status status--err">{error}</p>
            ) : listLoading && !hasListContent ? (
              <p className="status">加载中…</p>
            ) : shownItems.length === 0 ? (
              <p className="status">
                {favOnly ? '还没有收藏任何游戏，去游戏详情页点「收藏」试试' : '没有找到相关游戏'}
              </p>
            ) : (
              <div className={`grid${listLoading ? ' grid--dim' : ''}`}>
                {shownItems.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    hideGenre={Boolean(filter)}
                  />
                ))}
              </div>
            )}
          </div>

          {showPager ? (
            <div className="pager">
            <button
              type="button"
              className="pager__btn"
              disabled={safePage <= 1 || listLoading || pageCount <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </button>
            <span className="pager__info">{safePage}</span>
            <button
              type="button"
              className="pager__btn"
              disabled={safePage >= pageCount || listLoading || pageCount <= 1}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              下一页
            </button>
          </div>
          ) : null}
        </section>
      </main>
      </Style>
    </GameFrame>
  )
}

const Style = styled.div`
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  .shell {
    width: 90vw;
    margin-left: auto;
    margin-right: auto;
  }

  .top {
    flex-shrink: 0;
    border-bottom: 1px solid var(--line);
    background: color-mix(in srgb, var(--bg-elev) 88%, transparent);
    backdrop-filter: blur(16px) saturate(1.3);
    -webkit-backdrop-filter: blur(16px) saturate(1.3);
  }

  .top__inner {
    padding: 0.75rem 0;
  }

  .top__row {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem 1rem;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    color: inherit;
    text-decoration: none;
    flex-shrink: 0;
  }

  .brand__mark {
    width: 2rem;
    height: 2rem;
    display: grid;
    place-items: center;
    border-radius: 0.55rem;
    background: var(--grad);
    color: #fff;
    font-size: 0.9rem;
    font-weight: 750;
    box-shadow: 0 4px 12px color-mix(in srgb, var(--purple) 28%, transparent);
  }

  .brand__text {
    font-size: 1.05rem;
    font-weight: 750;
    letter-spacing: 0.02em;
  }

  .platforms {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    min-width: 0;
  }

  .favtab {
    appearance: none;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    flex-shrink: 0;
    height: 32px;
    padding: 0 0.7rem;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--bg-elev);
    color: var(--text-soft);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
    box-shadow: var(--shadow-soft);
    cursor: pointer;
    transition:
      color 0.18s ease,
      border-color 0.18s ease,
      background 0.18s ease,
      box-shadow 0.18s ease;
  }

  .favtab:hover {
    color: var(--amber);
    border-color: color-mix(in srgb, var(--amber) 42%, transparent);
    background: var(--amber-soft);
  }

  .favtab.is-active {
    color: var(--amber);
    border-color: color-mix(in srgb, var(--amber) 55%, transparent);
    background: var(--amber-soft);
  }

  .favtab:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--amber) 60%, transparent);
    outline-offset: 2px;
  }

  .favtab__count {
    display: inline-grid;
    place-items: center;
    min-width: 1.05rem;
    height: 1.05rem;
    padding: 0 0.25rem;
    border-radius: 999px;
    background: var(--amber);
    color: #1a1203;
    font-size: 0.64rem;
    font-weight: 750;
    line-height: 1;
  }

  .cats {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 2px;
    min-width: 0;
    flex: 1;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .cats::-webkit-scrollbar {
    display: none;
  }

  .cat {
    appearance: none;
    position: relative;
    flex-shrink: 0;
    border: none;
    background: transparent;
    color: var(--text-soft);
    padding: 8px 14px;
    font: inherit;
    font-size: 15px;
    letter-spacing: 0.02em;
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.2s;
  }

  .cat::after {
    content: '';
    position: absolute;
    left: 14px;
    right: 14px;
    bottom: 2px;
    height: 2px;
    border-radius: 1px;
    background: var(--grad);
    transform: scaleX(0);
    transform-origin: center;
    transition: transform 0.22s ease;
  }

  .cat:hover {
    color: var(--ink);
  }

  .cat.is-active {
    color: var(--ink);
    font-weight: 650;
  }

  .cat.is-active::after {
    transform: scaleX(1);
  }

  .top__actions {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .search {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    width: 268px;
    max-width: 100%;
    justify-self: end;
    height: 36px;
    padding: 0 0.3rem 0 0.8rem;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--bg-elev);
    color: var(--muted);
    box-sizing: border-box;
    box-shadow: var(--shadow-soft);
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }

  .search:hover,
  .search:focus-within {
    border-color: color-mix(in srgb, var(--purple) 45%, transparent);
    box-shadow: 0 0 0 3px var(--accent-soft);
    color: var(--purple);
  }

  .search input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--ink);
    font-size: 0.84rem;
  }

  .search input::placeholder {
    color: var(--muted);
  }

  .search__btn {
    flex-shrink: 0;
    height: 28px;
    padding: 0 0.75rem;
    border: 0;
    border-radius: 999px;
    background: var(--grad);
    color: #fff;
    font-size: 0.75rem;
    font-weight: 650;
    letter-spacing: 0.04em;
    cursor: pointer;
    white-space: nowrap;
    transition: filter 0.15s ease;
  }

  .search__btn:hover {
    filter: brightness(1.06);
  }

  .back {
    color: var(--text-soft);
    text-decoration: none;
    font-size: 0.84rem;
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    border: 1px solid transparent;
    white-space: nowrap;
    transition:
      color 0.15s ease,
      border-color 0.15s ease,
      background 0.15s ease;
  }

  .back:hover {
    color: var(--purple);
    border-color: color-mix(in srgb, var(--purple) 28%, transparent);
    background: var(--accent-soft);
  }

  .main {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    padding: 0.85rem 0 0.85rem;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.75rem 1rem;
    flex-shrink: 0;
  }

  .section {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .section--hot {
    flex: 0 0 auto;
    margin-bottom: 1.35rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid var(--line);
  }

  .section--list {
    flex: 1;
    min-height: 0;
  }

  .section__head {
    margin-bottom: 0.75rem;
    flex-shrink: 0;
  }

  .section__head h2 {
    margin: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 1rem;
    font-weight: 750;
    color: var(--ink);
    letter-spacing: 0.02em;
  }

  .section__mark {
    width: 3px;
    height: 1em;
    border-radius: 999px;
    background: var(--grad);
    flex-shrink: 0;
  }

  .home-groups {
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
    transition: opacity 0.2s ease;
  }

  .home-group__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .home-group__more {
    appearance: none;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-soft);
    font: inherit;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0.3rem 0.65rem;
    border-radius: 999px;
    white-space: nowrap;
    transition:
      color 0.15s ease,
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .home-group__more:hover {
    color: var(--purple);
    border-color: color-mix(in srgb, var(--purple) 28%, transparent);
    background: var(--accent-soft);
  }

  .home-group__count {
    display: inline-grid;
    place-items: center;
    min-width: 1.35rem;
    height: 1.2rem;
    padding: 0 0.35rem;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--purple);
    font-size: 0.68rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .section__body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0.55rem 0.2rem 1.25rem;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .section__body::-webkit-scrollbar {
    display: none;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 1.15rem 0.95rem;
    width: 100%;
    transition: opacity 0.2s ease;
  }

  .grid--hot {
    gap: 1rem 0.95rem;
  }

  .grid--dim {
    opacity: 0.55;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    min-width: 0;
    color: inherit;
    text-decoration: none;
  }

  .card__cover {
    position: relative;
    aspect-ratio: 1 / 1;
    width: 100%;
    border-radius: 0.85rem;
    overflow: hidden;
    background: var(--cover-ph);
    border: 1px solid color-mix(in srgb, var(--line) 80%, transparent);
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.04),
      0 8px 20px rgba(15, 23, 42, 0.06);
    isolation: isolate;
    transition:
      border-color 0.25s ease,
      box-shadow 0.25s ease,
      transform 0.25s ease;
  }

  .card:hover .card__cover {
    border-color: color-mix(in srgb, var(--purple) 40%, transparent);
    box-shadow:
      0 4px 8px rgba(15, 23, 42, 0.05),
      0 18px 36px rgba(99, 102, 241, 0.14);
    transform: translateY(-4px);
  }

  .card--hot .card__cover {
    border-color: color-mix(in srgb, var(--amber) 40%, transparent);
  }

  .card--featured:hover .card__cover {
    border-color: color-mix(in srgb, var(--amber) 55%, transparent);
    box-shadow:
      0 4px 8px rgba(15, 23, 42, 0.05),
      0 18px 36px rgba(245, 158, 11, 0.16);
  }

  .card__shade {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background: linear-gradient(
      180deg,
      transparent 48%,
      rgba(8, 10, 22, 0.55) 100%
    );
    opacity: 0;
    transition: opacity 0.25s ease;
  }

  .card--featured .card__shade,
  .card:hover .card__shade {
    opacity: 1;
  }

  .card--featured .card__shade {
    background: linear-gradient(
      180deg,
      transparent 35%,
      rgba(8, 10, 22, 0.72) 100%
    );
    opacity: 1;
  }

  .card__cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.4s ease;
  }

  .card:hover .card__cover img {
    transform: scale(1.06);
  }

  .card__hot {
    position: absolute;
    top: 0.45rem;
    left: 0.45rem;
    z-index: 2;
    padding: 0.18rem 0.5rem;
    border-radius: 999px;
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
    color: #1a1203;
    font-size: 0.62rem;
    font-weight: 750;
    letter-spacing: 0.04em;
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.35);
  }

  .card__cat {
    position: absolute;
    top: 0.45rem;
    right: 0.45rem;
    z-index: 2;
    max-width: calc(100% - 0.9rem);
    padding: 0.16rem 0.42rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--bg-elev) 82%, transparent);
    color: var(--purple);
    font-size: 0.6rem;
    font-weight: 700;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid color-mix(in srgb, var(--purple) 18%, transparent);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card__overlay {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    padding: 0.7rem 0.65rem 0.6rem;
    pointer-events: none;
  }

  .card__overlay-title {
    margin: 0;
    font-size: 0.78rem;
    font-weight: 700;
    line-height: 1.3;
    color: #fff;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card__meta {
    padding: 0 0.15rem;
    min-width: 0;
  }

  .card__title {
    margin: 0;
    font-size: 0.82rem;
    font-weight: 650;
    line-height: 1.35;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.15s ease;
  }

  .card:hover .card__title {
    color: var(--purple);
  }

  .card__genre {
    margin: 0.2rem 0 0;
    font-size: 0.7rem;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status {
    margin: auto;
    text-align: center;
    color: var(--muted);
    font-size: 0.92rem;
  }

  .status--err {
    color: var(--danger);
  }

  .pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    margin-top: 0.35rem;
    padding-top: 0.65rem;
    flex-shrink: 0;
    border-top: 1px solid var(--line);
  }

  .pager__btn {
    height: 34px;
    padding: 0 1rem;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--bg-elev);
    color: var(--ink);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: var(--shadow-soft);
    transition:
      border-color 0.15s ease,
      color 0.15s ease,
      background 0.15s ease,
      box-shadow 0.15s ease;
  }

  .pager__btn:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--purple) 40%, transparent);
    color: var(--purple);
    background: var(--accent-soft);
    box-shadow: 0 4px 14px color-mix(in srgb, var(--purple) 16%, transparent);
  }

  .pager__btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .pager__info {
    font-size: 0.8rem;
    color: var(--muted);
    min-width: 1.5rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 960px) {
    .grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.9rem 0.7rem;
    }

    .grid--hot .card:nth-child(n + 5) {
      display: none;
    }
  }

  @media (max-width: 640px) {
    .top__inner {
      padding: 0.55rem 0 0.45rem;
    }

    .top__row {
      grid-template-columns: auto minmax(0, 1fr) auto;
      grid-template-areas:
        'brand search actions'
        'platforms platforms platforms';
      gap: 0.55rem 0.5rem;
    }

    .brand {
      grid-area: brand;
    }

    .platforms {
      grid-area: platforms;
      justify-self: start;
      width: 100%;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .platforms::-webkit-scrollbar {
      display: none;
    }

    .favtab {
      height: 28px;
      padding: 0 0.55rem;
      font-size: 0.75rem;
    }

    .search {
      grid-area: search;
      width: auto;
      min-width: 0;
      height: 32px;
      padding: 0 0.25rem 0 0.6rem;
    }

    .top__actions {
      grid-area: actions;
    }

    .brand__text {
      font-size: 0.92rem;
    }

    .toolbar {
      flex-direction: column;
      align-items: stretch;
      gap: 0.45rem;
    }

    .cats {
      margin: 0 -0.1rem;
      padding-bottom: 0.1rem;
    }

    .cat {
      padding: 8px 10px;
      font-size: 14px;
    }

    .cat::after {
      left: 10px;
      right: 10px;
    }

    .search input {
      font-size: 0.78rem;
    }

    .search input::placeholder {
      font-size: 0.72rem;
    }

    .search__btn {
      height: 24px;
      padding: 0 0.55rem;
      font-size: 0.7rem;
    }

    .back {
      padding: 0.28rem 0.55rem;
      font-size: 0.78rem;
    }

    .section__head h2 {
      font-size: 0.92rem;
    }

    .grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.8rem 0.55rem;
    }

    .grid--hot .card:nth-child(n + 4) {
      display: none;
    }

    .card__title,
    .card__overlay-title {
      font-size: 0.74rem;
    }
  }
`
