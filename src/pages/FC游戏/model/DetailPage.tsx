import { useEffect, useLayoutEffect, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router'
import styled from 'styled-components'
import { fetchGameDetail, type PublicGame } from '../utils/server'
import FcPlayer from './FcPlayer'
import { GameFrame, GameThemeToggle } from './Layout'

type GameOutlet = {
  toggleTheme: () => void
}

export default function DetailPage() {
  const { toggleTheme } = useOutletContext<GameOutlet>()
  const { id = '' } = useParams()
  const [game, setGame] = useState<PublicGame | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
  }, [])

  useEffect(() => {
    if (!id) {
      setError('无效的游戏')
      setLoading(false)
      return
    }
    const ac = new AbortController()
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await fetchGameDetail(id, ac.signal)
        if (ac.signal.aborted) return
        setGame(data)
        document.title = `${data.name} · 铭FC游戏`
      } catch (err) {
        if (!ac.signal.aborted) {
          setGame(null)
          setError(err instanceof Error ? err.message : '加载失败')
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    })()
    return () => ac.abort()
  }, [id])

  const playable = game?.category === 'FC'

  return (
    <GameFrame>
      <Style>
        <header className="top">
          <div className="shell top__inner">
            <Link to="/game" className="brand" aria-label="铭FC游戏">
              <span className="brand__mark">铭</span>
              <span className="brand__text">铭FC游戏</span>
            </Link>
            <div className="top__actions">
              <GameThemeToggle onToggle={toggleTheme} />
              <Link to="/works" className="back">
                返回作品集
              </Link>
              <Link to="/game" className="back">
                返回列表
              </Link>
            </div>
          </div>
        </header>

        <main className="shell main">
          {loading ? (
            <p className="status">加载中…</p>
          ) : error || !game ? (
            <p className="status status--err">{error || '游戏不存在'}</p>
          ) : (
            <div className="detail">
              <aside className="info">
                <div className="cover">
                  {game.imageUrl ? (
                    <img src={game.imageUrl} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="cover__ph">{game.name.slice(0, 1)}</span>
                  )}
                </div>
                <div className="info__body">
                  <h1>{game.name}</h1>
                  <div className="tags">
                    <span className="tag">{game.category}</span>
                    {game.genre ? <span className="tag tag--muted">{game.genre}</span> : null}
                    {game.recommended ? <span className="tag tag--hot">精选</span> : null}
                  </div>
                  <a className="dl" href={game.downloadUrl} target="_blank" rel="noreferrer">
                    下载 ROM
                  </a>
                </div>
              </aside>

              <section className="play">
                {playable ? (
                  <>
                    <div className="play__head">
                      <h2>在线游玩</h2>
                      <span className="play__badge">FC</span>
                    </div>
                    <FcPlayer gameId={game.id} gameName={game.name} />
                  </>
                ) : (
                  <div className="unavailable">
                    <h2>暂不支持在线运行</h2>
                    <p>
                      当前分类为 {game.category}，网页端模拟器仅支持 FC。
                      请下载 ROM 后使用本地模拟器游玩。
                    </p>
                    <a className="dl dl--inline" href={game.downloadUrl} target="_blank" rel="noreferrer">
                      下载 ROM
                    </a>
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      </Style>
    </GameFrame>
  )
}

const Style = styled.div`
  min-height: 100dvh;
  display: flex;
  flex-direction: column;

  .shell {
    width: 90vw;
    max-width: 1100px;
    margin-left: auto;
    margin-right: auto;
  }

  .top {
    position: sticky;
    top: 0;
    z-index: 20;
    border-bottom: 1px solid var(--line);
    background: color-mix(in srgb, var(--bg-elev) 86%, transparent);
    backdrop-filter: blur(14px) saturate(1.25);
    -webkit-backdrop-filter: blur(14px) saturate(1.25);
  }

  .top__inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 0;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    color: inherit;
    text-decoration: none;
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

  .top__actions {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .back {
    color: var(--text-soft);
    text-decoration: none;
    font-size: 0.84rem;
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    border: 1px solid transparent;
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
    padding: 1.5rem 0 2.5rem;
  }

  .status {
    margin: 4rem 0;
    text-align: center;
    color: var(--muted);
  }

  .status--err {
    color: var(--danger);
  }

  .detail {
    display: grid;
    grid-template-columns: 200px minmax(0, 1fr);
    gap: 1.75rem 2rem;
    align-items: start;
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    border-radius: 1.1rem;
    background: var(--bg-elev);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-soft);
  }

  .cover {
    aspect-ratio: 1 / 1;
    border-radius: 0.85rem;
    overflow: hidden;
    border: 1px solid var(--line);
    background: var(--cover-ph);
  }

  .cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .cover__ph {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    font-size: 2.2rem;
    font-weight: 750;
    color: var(--purple-soft);
  }

  .info__body {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .info h1 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 750;
    line-height: 1.35;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .tag {
    padding: 0.2rem 0.5rem;
    border-radius: 0.4rem;
    background: var(--accent-soft);
    color: var(--purple);
    font-size: 0.7rem;
    font-weight: 700;
  }

  .tag--muted {
    background: color-mix(in srgb, var(--ink) 6%, transparent);
    color: var(--text-soft);
    font-weight: 550;
  }

  .tag--hot {
    background: var(--amber-soft);
    color: var(--amber);
  }

  .dl {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 38px;
    padding: 0 1rem;
    border-radius: 0.7rem;
    border: none;
    background: var(--grad);
    color: #fff;
    text-decoration: none;
    font-size: 0.86rem;
    font-weight: 650;
    box-shadow: var(--shadow);
    transition: transform 0.15s ease, filter 0.15s ease;
  }

  .dl:hover {
    transform: translateY(-1px);
    filter: brightness(1.05);
  }

  .dl--inline {
    margin-top: 0.35rem;
    width: fit-content;
  }

  .play {
    min-width: 0;
    padding: 1.15rem 1.25rem 1.35rem;
    border-radius: 1.1rem;
    background: var(--bg-elev);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-soft);
  }

  .play__head {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    margin-bottom: 1rem;
  }

  .play__head h2 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 720;
  }

  .play__badge {
    padding: 0.15rem 0.45rem;
    border-radius: 0.35rem;
    background: var(--accent-soft);
    color: var(--purple);
    font-size: 0.68rem;
    font-weight: 750;
  }

  .unavailable {
    padding: 2.25rem 1.25rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.55rem;
  }

  .unavailable h2 {
    margin: 0;
    font-size: 1.05rem;
  }

  .unavailable p {
    margin: 0;
    max-width: 28rem;
    color: var(--text-soft);
    font-size: 0.92rem;
    line-height: 1.65;
  }

  @media (max-width: 800px) {
    .detail {
      grid-template-columns: 1fr;
    }

    .info {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.9rem 1rem;
    }

    .cover {
      width: 112px;
      flex-shrink: 0;
    }

    .info__body {
      flex: 1;
      min-width: 140px;
    }

    .dl {
      width: 100%;
    }
  }

  @media (max-width: 640px) {
    .brand__text {
      display: none;
    }

    .main {
      padding: 1.1rem 0 2rem;
    }

    .play {
      padding: 1rem 0.85rem 1.15rem;
    }
  }
`
