import { useEffect, useLayoutEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router'
import styled from 'styled-components'
import {
  fetchFeaturedGames,
  fetchGameList,
  GAME_CATEGORIES,
  type GameCategory,
  type PublicGame,
} from '../utils/server'
import { GameFrame, GameThemeToggle } from './Layout'

type GameOutlet = {
  toggleTheme: () => void
}

const COLS = 8
const ROWS = 3
const PAGE_SIZE = COLS * ROWS
const FEATURED_COUNT = COLS

function GameCard({ game, featured = false }: { game: PublicGame; featured?: boolean }) {
  return (
    <Link
      className={`card${featured ? ' card--hot' : ''}`}
      to={`/game/${game.id}`}
      title={game.name}
    >
      <div className="card__cover">
        {game.imageUrl ? (
          <img src={game.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <span className="card__placeholder">{game.name.slice(0, 1)}</span>
        )}
        {featured ? <span className="card__hot">热门</span> : null}
        <span className="card__cat">{game.category}</span>
      </div>
      <div className="card__meta">
        <h3 className="card__title">{game.name}</h3>
        <p className="card__genre">{game.genre || '未分类'}</p>
      </div>
    </Link>
  )
}

export default function ListPage() {
  const { toggleTheme } = useOutletContext<GameOutlet>()
  const [featured, setFeatured] = useState<PublicGame[]>([])
  const [items, setItems] = useState<PublicGame[]>([])
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [category, setCategory] = useState<GameCategory | ''>('')
  const [listLoading, setListLoading] = useState(false)
  const [error, setError] = useState('')

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
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 280)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    setPage(1)
  }, [debouncedQuery, category])

  useEffect(() => {
    const ac = new AbortController()
    ;(async () => {
      try {
        const games = await fetchFeaturedGames(FEATURED_COUNT, ac.signal)
        if (!ac.signal.aborted) setFeatured(games)
      } catch {
        /* featured optional */
      }
    })()
    return () => ac.abort()
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    ;(async () => {
      setListLoading(true)
      try {
        const result = await fetchGameList({
          page,
          pageSize: PAGE_SIZE,
          q: debouncedQuery,
          category,
          signal: ac.signal,
        })
        if (ac.signal.aborted) return
        setItems(result.items)
        setTotal(result.total)
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
  }, [page, debouncedQuery, category])

  const safePage = Math.min(page, pageCount)

  return (
    <GameFrame>
      <Style>
      <header className="top">
        <div className="shell top__inner">
          <div className="top__row">
            <Link to="/game" className="brand" aria-label="铭游戏">
              <span className="brand__mark">铭</span>
              <span className="brand__text">铭游戏</span>
            </Link>

            <div className="chips" role="tablist" aria-label="分类筛选">
              <button
                type="button"
                className={`chip${!category ? ' chip--on' : ''}`}
                onClick={() => setCategory('')}
              >
                全部
              </button>
              {GAME_CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`chip${category === item ? ' chip--on' : ''}`}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="top__actions">
              <GameThemeToggle onToggle={toggleTheme} />
              <Link to="/works" className="back">
                返回作品集
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="shell main">
        <div className="toolbar">
          <label className="search">
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
              placeholder="搜索游戏名称 / 类型…"
              aria-label="搜索游戏"
            />
          </label>
          <p className="count">
            共 <strong>{total}</strong> 款
          </p>
        </div>

        {featured.length > 0 ? (
          <section className="section section--hot">
            <div className="section__head">
              <h2>热门推荐</h2>
            </div>
            <div className="grid grid--hot">
              {featured.slice(0, COLS).map((game) => (
                <GameCard key={game.id} game={game} featured />
              ))}
            </div>
          </section>
        ) : null}

        <section className="section section--list">
          <div className="section__body">
            {error && !items.length ? (
              <p className="status status--err">{error}</p>
            ) : listLoading && !items.length ? (
              <p className="status">加载中…</p>
            ) : items.length === 0 ? (
              <p className="status">没有找到相关游戏</p>
            ) : (
              <div className={`grid${listLoading ? ' grid--dim' : ''}`}>
                {items.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            )}
          </div>

          <div className="pager">
            <button
              type="button"
              className="pager__btn"
              disabled={safePage <= 1 || listLoading || pageCount <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </button>
            <span className="pager__info">
              {safePage} / {Math.max(pageCount, 1)}
            </span>
            <button
              type="button"
              className="pager__btn"
              disabled={safePage >= pageCount || listLoading || pageCount <= 1}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              下一页
            </button>
          </div>
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
    background: color-mix(in srgb, var(--bg-elev) 82%, transparent);
    backdrop-filter: blur(14px) saturate(1.25);
    -webkit-backdrop-filter: blur(14px) saturate(1.25);
  }

  .top__inner {
    padding: 0.7rem 0;
  }

  .top__row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
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
    width: 1.9rem;
    height: 1.9rem;
    display: grid;
    place-items: center;
    border-radius: 0.5rem;
    background: var(--grad);
    color: #fff;
    font-size: 0.88rem;
    font-weight: 750;
  }

  .brand__text {
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .chips {
    display: flex;
    justify-content: center;
    gap: 0.3rem;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .chips::-webkit-scrollbar {
    display: none;
  }

  .chip {
    flex-shrink: 0;
    height: 30px;
    padding: 0 0.85rem;
    border-radius: 999px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-soft);
    font-size: 0.82rem;
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .chip:hover {
    color: var(--ink);
  }

  .chip--on {
    background: var(--accent-soft);
    color: var(--purple);
    font-weight: 650;
  }

  .top__actions {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    justify-self: end;
  }

  .back {
    color: var(--text-soft);
    text-decoration: none;
    font-size: 0.84rem;
    padding: 0.35rem 0.7rem;
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
    gap: 0.75rem;
    padding: 1rem 0 0.85rem;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.85rem;
    flex-shrink: 0;
  }

  .search {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: min(100%, 380px);
    height: 36px;
    padding: 0 0.9rem;
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
    font-size: 0.88rem;
  }

  .search input::placeholder {
    color: var(--muted);
  }

  .count {
    margin: 0;
    font-size: 0.8rem;
    color: var(--muted);
    white-space: nowrap;
  }

  .count strong {
    color: var(--purple);
    font-weight: 650;
  }

  .section {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .section--hot {
    flex: 0 0 auto;
    padding-bottom: 0.45rem;
    border-bottom: 1px solid var(--line);
  }

  .section--list {
    flex: 1;
    min-height: 0;
  }

  .section__head {
    margin-bottom: 0.45rem;
    flex-shrink: 0;
  }

  .section__head h2 {
    margin: 0;
    font-size: 0.82rem;
    font-weight: 650;
    color: var(--muted);
    letter-spacing: 0.04em;
  }

  .section__body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0.85rem 0.15rem 1.1rem;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--purple) 35%, transparent) transparent;
    -webkit-overflow-scrolling: touch;
  }

  .section__body::-webkit-scrollbar {
    width: 5px;
  }

  .section__body::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--purple) 35%, transparent);
    border-radius: 999px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    gap: 0.85rem 0.7rem;
    width: 100%;
    transition: opacity 0.2s ease;
  }

  .grid--hot {
    gap: 0.65rem 0.7rem;
  }

  .grid--hot .card__meta {
    display: none;
  }

  .grid--dim {
    opacity: 0.55;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    min-width: 0;
    color: inherit;
    text-decoration: none;
  }

  .card__cover {
    position: relative;
    aspect-ratio: 1 / 1;
    width: 100%;
    border-radius: 0.7rem;
    overflow: hidden;
    background: var(--cover-ph);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-soft);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      transform 0.2s ease;
  }

  .card:hover .card__cover {
    border-color: color-mix(in srgb, var(--purple) 45%, transparent);
    box-shadow: var(--shadow);
    transform: translateY(-2px);
  }

  .card--hot .card__cover {
    border-color: color-mix(in srgb, var(--amber) 45%, transparent);
  }

  .card__cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.3s ease;
  }

  .card:hover .card__cover img {
    transform: scale(1.04);
  }

  .card__placeholder {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    font-size: 1.5rem;
    font-weight: 750;
    color: var(--purple-soft);
  }

  .card__hot {
    position: absolute;
    top: 0.35rem;
    left: 0.35rem;
    z-index: 1;
    padding: 0.12rem 0.4rem;
    border-radius: 999px;
    background: var(--amber);
    color: #1a1203;
    font-size: 0.6rem;
    font-weight: 750;
  }

  .card__cat {
    position: absolute;
    top: 0.35rem;
    right: 0.35rem;
    z-index: 1;
    padding: 0.1rem 0.35rem;
    border-radius: 0.3rem;
    background: color-mix(in srgb, var(--bg-elev) 88%, transparent);
    color: var(--purple);
    font-size: 0.6rem;
    font-weight: 700;
    backdrop-filter: blur(6px);
  }

  .card__meta {
    padding: 0 0.1rem;
    min-width: 0;
  }

  .card__title {
    margin: 0;
    font-size: 0.78rem;
    font-weight: 650;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card__genre {
    margin: 0.15rem 0 0;
    font-size: 0.68rem;
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
    padding-top: 0.55rem;
    flex-shrink: 0;
    border-top: 1px solid var(--line);
  }

  .pager__btn {
    height: 32px;
    padding: 0 0.95rem;
    border-radius: 0.55rem;
    border: 1px solid var(--line);
    background: var(--bg-elev);
    color: var(--ink);
    font-size: 0.8rem;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      color 0.15s ease,
      background 0.15s ease;
  }

  .pager__btn:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--purple) 40%, transparent);
    color: var(--purple);
    background: var(--accent-soft);
  }

  .pager__btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .pager__info {
    font-size: 0.8rem;
    color: var(--muted);
    min-width: 3.8rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 1100px) {
    .grid {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }

    .grid--hot .card:nth-child(n + 7) {
      display: none;
    }
  }

  @media (max-width: 800px) {
    .grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.7rem 0.55rem;
    }

    .grid--hot .card:nth-child(n + 5) {
      display: none;
    }
  }

  @media (max-width: 640px) {
    .brand__text {
      display: none;
    }

    .chips {
      justify-content: flex-start;
    }

    .toolbar {
      flex-direction: column;
      align-items: stretch;
      gap: 0.45rem;
    }

    .search {
      width: 100%;
    }

    .count {
      text-align: right;
    }

    .grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .grid--hot .card:nth-child(n + 4) {
      display: none;
    }

    .card__title {
      font-size: 0.72rem;
    }

    .back {
      display: none;
    }
  }
`
