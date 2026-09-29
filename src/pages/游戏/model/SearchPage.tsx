import { useEffect, useLayoutEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router'
import styled from 'styled-components'
import {
  fetchGameList,
  GAME_PLATFORMS,
  type GamePlatform,
  type PublicGame,
} from '../utils/server'
import { GameFrame, GameThemeToggle, GameCover } from './Layout'

type GameOutlet = {
  toggleTheme: () => void
}

const PAGE_SIZE = 20

function GameCard({ game }: { game: PublicGame }) {
  const genreLabel = game.genre?.split(/[、,/|]/)[0] || ''
  const platformLabel = game.category === '街机' ? '街机' : game.category === 'FC' ? 'FC' : ''
  return (
    <Link className="card" to={`/game/${game.id}`} title={game.name}>
      <div className="card__cover">
        <GameCover src={game.imageUrl} />
        <div className="card__shade" aria-hidden />
        {platformLabel ? <span className="card__platform">{platformLabel}</span> : null}
        {genreLabel ? <span className="card__cat">{genreLabel}</span> : null}
      </div>
      <div className="card__meta">
        <h3 className="card__title">{game.name}</h3>
        <p className="card__genre">{game.genre || '未分类'}</p>
      </div>
    </Link>
  )
}

export default function SearchPage() {
  const { toggleTheme } = useOutletContext<GameOutlet>()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const q = params.get('q')?.trim() || ''

  const [draft, setDraft] = useState(q)
  const [items, setItems] = useState<PublicGame[]>([])
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useLayoutEffect(() => {
    document.title = q ? `搜索「${q}」· 铭游戏` : '搜索 · 铭游戏'
    const html = document.documentElement
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    html.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
    }
  }, [q])

  useEffect(() => {
    setDraft(q)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [q])

  useEffect(() => {
    if (!q) {
      setItems([])
      setTotal(0)
      setPageCount(1)
      setError('')
      setLoading(false)
      return
    }

    const ac = new AbortController()
    ;(async () => {
      setLoading(true)
      try {
        const result = await fetchGameList({
          page,
          pageSize: PAGE_SIZE,
          q,
          category: 'all',
          signal: ac.signal,
        })
        if (ac.signal.aborted) return
        setItems(result.items)
        setTotal(result.total)
        setPageCount(result.pageCount)
        setError('')
      } catch (err) {
        if (!ac.signal.aborted) {
          setError(err instanceof Error ? err.message : '搜索失败')
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    })()
    return () => ac.abort()
  }, [q, page])

  function onConfirm(e: FormEvent) {
    e.preventDefault()
    const keyword = draft.trim()
    const next = new URLSearchParams()
    if (keyword) next.set('q', keyword)
    setParams(next)
  }

  /** 搜索页点 FC / 街机：退出搜索，回到对应列表 */
  function goPlatformList(next: GamePlatform) {
    navigate(next === 'FC' ? '/game' : '/game?platform=街机')
  }

  const safePage = Math.min(page, pageCount)
  const hasListContent = items.length > 0

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

              <div className="platforms" role="tablist" aria-label="返回平台列表">
                {GAME_PLATFORMS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    aria-selected={false}
                    className="cat"
                    onClick={() => goPlatformList(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="top__actions">
                <GameThemeToggle onToggle={toggleTheme} />
                <button type="button" className="back" onClick={() => navigate(-1)}>
                  返回
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="shell main">
          <div className="sticky-bar">
            <form className="search-form" onSubmit={onConfirm} role="search">
              <div className="row">
                <svg className="icon" viewBox="0 0 24 24" aria-hidden>
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
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="搜索 FC / 街机游戏…"
                  aria-label="搜索关键词"
                  autoFocus
                />
                <button type="submit" className="confirm">
                  搜索
                </button>
              </div>
            </form>

            {!q && <p className="progress">输入关键词后点击搜索</p>}
            {q && (
              <p className="progress">
                {loading ? `正在搜索「${q}」…` : `「${q}」共 ${total} 款 · FC / 街机`}
              </p>
            )}
          </div>

          <section className="section">
            <div className="section__body">
              {error && !hasListContent ? (
                <p className="status status--err">{error}</p>
              ) : !q ? null : loading && !hasListContent ? (
                <p className="status">加载中…</p>
              ) : items.length === 0 ? (
                <p className="status">未找到相关游戏</p>
              ) : (
                <div className={`grid${loading ? ' grid--dim' : ''}`}>
                  {items.map((game) => (
                    <GameCard key={`${game.category}-${game.id}`} game={game} />
                  ))}
                </div>
              )}
            </div>

            {q && pageCount > 1 ? (
              <div className="pager">
                <button
                  type="button"
                  className="pager__btn"
                  disabled={safePage <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  上一页
                </button>
                <span className="pager__info">{safePage}</span>
                <button
                  type="button"
                  className="pager__btn"
                  disabled={safePage >= pageCount || loading}
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
    grid-template-columns: auto auto 1fr auto;
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
    justify-self: end;
  }

  .back {
    appearance: none;
    color: var(--text-soft);
    text-decoration: none;
    font: inherit;
    font-size: 0.84rem;
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
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
    gap: 0.35rem;
    padding: 0 0 0.85rem;
  }

  .sticky-bar {
    flex-shrink: 0;
    position: sticky;
    top: 0;
    z-index: 20;
    padding: 1rem 0 0.5rem;
    background: color-mix(in srgb, var(--bg) 72%, transparent);
    backdrop-filter: blur(18px) saturate(1.35);
    -webkit-backdrop-filter: blur(18px) saturate(1.35);
    border-bottom: 1px solid var(--line);
  }

  .search-form {
    max-width: 560px;
    margin: 0 auto;
  }

  .row {
    position: relative;
    display: flex;
    align-items: center;
    height: 44px;
    padding: 0 3px 0 36px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--bg-elev);
    box-shadow: var(--shadow-soft);
    box-sizing: border-box;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;

    &:focus-within {
      border-color: color-mix(in srgb, var(--purple) 45%, transparent);
      box-shadow: 0 0 0 3px var(--accent-soft);
    }

    .icon {
      position: absolute;
      left: 12px;
      width: 16px;
      height: 16px;
      color: var(--muted);
      pointer-events: none;
    }

    input {
      flex: 1;
      min-width: 0;
      height: 100%;
      padding: 0 8px 0 0;
      border: 0;
      background: transparent;
      color: var(--ink);
      font-size: 14px;
      outline: 0;

      &::placeholder {
        color: var(--muted);
      }
    }
  }

  .confirm {
    flex-shrink: 0;
    height: calc(100% - 6px);
    padding: 0 16px;
    border: 0;
    border-radius: 999px;
    background: var(--grad);
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: filter 0.15s ease;

    &:hover {
      filter: brightness(1.06);
    }
  }

  .progress {
    margin: 12px 0 4px;
    font-size: 13px;
    color: var(--muted);
    text-align: center;
  }

  .section {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .section__body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0.75rem 0.2rem 1.25rem;
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

  .card__shade {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background: linear-gradient(180deg, transparent 48%, rgba(8, 10, 22, 0.55) 100%);
    opacity: 0;
    transition: opacity 0.25s ease;
  }

  .card:hover .card__shade {
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

  .card__platform {
    position: absolute;
    top: 0.45rem;
    left: 0.45rem;
    z-index: 2;
    padding: 0.16rem 0.42rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--bg-elev) 82%, transparent);
    color: var(--ink);
    font-size: 0.6rem;
    font-weight: 700;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid var(--line);
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
  }

  @media (max-width: 640px) {
    .top__inner {
      padding: 0.55rem 0 0.45rem;
    }

    .top__row {
      grid-template-columns: auto minmax(0, 1fr);
      grid-template-areas:
        'brand actions'
        'platforms platforms';
      gap: 0.55rem 0.5rem;
    }

    .brand {
      grid-area: brand;
    }

    .platforms {
      grid-area: platforms;
      justify-self: start;
    }

    .top__actions {
      grid-area: actions;
    }

    .brand__text {
      font-size: 0.92rem;
    }

    .cat {
      padding: 8px 10px;
      font-size: 14px;
    }

    .cat::after {
      left: 10px;
      right: 10px;
    }

    .back {
      padding: 0.28rem 0.55rem;
      font-size: 0.78rem;
    }

    .row {
      height: 40px;
      padding-left: 32px;
    }

    .grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.8rem 0.55rem;
    }

    .card__title {
      font-size: 0.74rem;
    }
  }
`
