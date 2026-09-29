import { useEffect, useLayoutEffect, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router'
import styled from 'styled-components'
import { fetchGameDetail, type PublicGame } from '../utils/server'
import ArcadePlayer from './ArcadePlayer'
import FcPlayer, { type FcPlayerControls } from './FcPlayer'
import { GameCover, GameFrame, GameThemeToggle } from './Layout'

type GameOutlet = {
  toggleTheme: () => void
}

const FC_P1_KEYS = [
  { key: 'W A S D', label: '方向' },
  { key: 'J', label: 'B' },
  { key: 'K', label: 'A' },
  { key: 'L', label: '连发' },
  { key: 'U', label: 'Select' },
  { key: 'I / Enter', label: 'Start' },
]

const FC_P2_KEYS = [
  { key: '方向键', label: '方向' },
  { key: '1', label: 'B' },
  { key: '2', label: 'A' },
  { key: '4', label: 'Select' },
  { key: '5', label: 'Start' },
]

const ARCADE_P1_KEYS = [
  { key: 'W A S D', label: '方向' },
  { key: 'J', label: '按键 1' },
  { key: 'K', label: '按键 2' },
  { key: 'L', label: '按键 3' },
  { key: 'U', label: '按键 4' },
  { key: 'I', label: '按键 5' },
  { key: 'O', label: '按键 6' },
  { key: 'V', label: '投币' },
  { key: 'Enter', label: 'Start' },
]

const ARCADE_P2_KEYS = [
  { key: '方向键', label: '方向' },
  { key: '1', label: '按键 1' },
  { key: '2', label: '按键 2' },
  { key: '3', label: '按键 3' },
  { key: '7', label: '按键 4' },
  { key: '8', label: '按键 5' },
  { key: '9', label: '按键 6' },
  { key: '4', label: '投币' },
  { key: '5', label: 'Start' },
]

export default function DetailPage() {
  const { toggleTheme } = useOutletContext<GameOutlet>()
  const { id = '' } = useParams()
  const [game, setGame] = useState<PublicGame | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [controls, setControls] = useState<FcPlayerControls | null>(null)

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    const mq = window.matchMedia('(min-width: 801px)')
    const apply = () => {
      document.body.style.overflow = mq.matches ? 'hidden' : ''
    }
    apply()
    mq.addEventListener('change', apply)
    return () => {
      mq.removeEventListener('change', apply)
      document.body.style.overflow = ''
    }
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
        setControls(null)
        document.title = `${data.name} · 铭游戏`
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

  const isFc = game?.category === 'FC'
  const isArcade = game?.category === '街机'
  const playable = Boolean(isFc || isArcade)
  const p1Keys = isArcade ? ARCADE_P1_KEYS : FC_P1_KEYS
  const p2Keys = isArcade ? ARCADE_P2_KEYS : FC_P2_KEYS

  return (
    <GameFrame>
      <Style>
        <header className="top">
          <div className="shell top__inner">
            <Link to="/game" className="brand" aria-label="铭游戏">
              <span className="brand__mark">铭</span>
              <span className="brand__text">铭游戏</span>
            </Link>
            <div className="top__actions">
              <GameThemeToggle onToggle={toggleTheme} />
              <Link
                to={isArcade ? '/game?platform=街机' : '/game'}
                className="back"
              >
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
            <article className="card">
              <aside className="side">
                <div className="cover">
                  <GameCover src={game.imageUrl} />
                </div>

                <div className="meta">
                  <h1>{game.name}</h1>
                  <div className="tags">
                    <span className="tag">{game.category}</span>
                    {game.genre ? <span className="tag tag--muted">{game.genre}</span> : null}
                    {game.recommended ? <span className="tag tag--hot">精选</span> : null}
                  </div>
                </div>

                {playable ? (
                  <div className="guide">
                    <h2>操作说明</h2>
                    <p className="guide__lead">
                      {isArcade
                        ? '加载完成后直接开始，点击画面后用键盘操作'
                        : '点击画面后即可用键盘操作'}
                    </p>
                    <div className="guide__group">
                      <span className="guide__role">玩家 1</span>
                      <ul>
                        {p1Keys.map((item) => (
                          <li key={item.key}>
                            <kbd>{item.key}</kbd>
                            <span>{item.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="guide__group">
                      <span className="guide__role">玩家 2</span>
                      <ul>
                        {p2Keys.map((item) => (
                          <li key={item.key}>
                            <kbd>{item.key}</kbd>
                            <span>{item.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p className="side__note">
                    当前分类为 {game.category}，网页端仅支持 FC / 街机在线游玩。
                  </p>
                )}
              </aside>

              <section className="play">
                {isFc ? (
                  <>
                    <FcPlayer
                      gameId={game.id}
                      gameName={game.name}
                      hideBar
                      onControlsChange={setControls}
                    />
                    <div className="actions">
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={!controls || controls.status !== 'ready'}
                        onClick={() => controls?.togglePause()}
                      >
                        {controls?.paused ? '继续游戏' : '暂停'}
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={
                          !controls || (controls.status !== 'ready' && controls.status !== 'error')
                        }
                        onClick={() => controls?.hardReset()}
                      >
                        重新开始
                      </button>
                    </div>
                  </>
                ) : isArcade ? (
                  <ArcadePlayer
                    gameId={game.id}
                    gameName={game.name}
                    downloadUrl={game.downloadUrl}
                  />
                ) : (
                  <div className="unavailable">
                    <h2>暂不支持在线运行</h2>
                    <p>网页端模拟器仅支持 FC / 街机游戏。</p>
                  </div>
                )}
              </section>
            </article>
          )}
        </main>
      </Style>
    </GameFrame>
  )
}

const Style = styled.div`
  height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  .shell {
    width: min(96vw, 1280px);
    margin-left: auto;
    margin-right: auto;
  }

  .top {
    flex-shrink: 0;
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
    padding: 0.55rem 0;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    color: inherit;
    text-decoration: none;
  }

  .brand__mark {
    width: 1.75rem;
    height: 1.75rem;
    display: grid;
    place-items: center;
    border-radius: 0.5rem;
    background: var(--grad);
    color: #fff;
    font-size: 0.82rem;
    font-weight: 750;
  }

  .brand__text {
    font-size: 0.95rem;
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
    padding: 0.3rem 0.7rem;
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
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 0.75rem 0 0.85rem;
  }

  .status {
    margin: auto;
    text-align: center;
    color: var(--muted);
  }

  .status--err {
    color: var(--danger);
  }

  .card {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 0;
    align-items: stretch;
    border-radius: 1.15rem;
    background: var(--bg-elev);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-soft);
    overflow: hidden;
  }

  .side {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    min-height: 0;
    padding: 0.9rem 0.9rem 1rem;
    border-right: 1px solid var(--line);
    background: color-mix(in srgb, var(--bg) 55%, var(--bg-elev));
    overflow: hidden;
  }

  .cover {
    width: 100%;
    max-width: 132px;
    aspect-ratio: 1 / 1;
    flex-shrink: 0;
    border-radius: 0.75rem;
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

  .meta {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    flex-shrink: 0;
  }

  .meta h1 {
    margin: 0;
    font-size: 1.02rem;
    font-weight: 750;
    line-height: 1.3;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }

  .tag {
    padding: 0.15rem 0.45rem;
    border-radius: 0.35rem;
    background: var(--accent-soft);
    color: var(--purple);
    font-size: 0.68rem;
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

  .guide {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    min-height: 0;
    flex: 1;
    padding-top: 0.25rem;
    border-top: 1px solid var(--line);
    overflow: hidden;
  }

  .guide h2 {
    margin: 0;
    font-size: 0.78rem;
    font-weight: 720;
    color: var(--text-soft);
    letter-spacing: 0.04em;
  }

  .guide__lead {
    margin: 0;
    font-size: 0.72rem;
    color: var(--muted);
    line-height: 1.4;
  }

  .guide__group {
    display: flex;
    flex-direction: column;
    gap: 0.22rem;
  }

  .guide__role {
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--purple);
  }

  .guide__group ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.18rem;
  }

  .guide__group li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.4rem;
    font-size: 0.72rem;
    color: var(--text-soft);
  }

  .guide__group kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2rem;
    padding: 0.12rem 0.32rem;
    border-radius: 0.35rem;
    border: 1px solid var(--line);
    background: var(--bg-elev);
    color: var(--ink);
    font-family: inherit;
    font-size: 0.68rem;
    font-weight: 650;
    line-height: 1.2;
  }

  .side__note {
    margin: 0;
    padding-top: 0.25rem;
    border-top: 1px solid var(--line);
    font-size: 0.78rem;
    line-height: 1.55;
    color: var(--text-soft);
  }

  .play {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.7rem;
    padding: 0.85rem 1rem 0.95rem;
  }

  .actions {
    flex-shrink: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem 0.7rem;
  }

  .btn {
    min-width: 7.5rem;
    height: 36px;
    padding: 0 1.1rem;
    border-radius: 0.65rem;
    border: 1px solid var(--line);
    background: var(--bg);
    color: var(--ink);
    font-size: 0.84rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      color 0.15s ease,
      background 0.15s ease,
      filter 0.15s ease;
  }

  .btn:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--purple) 40%, transparent);
    color: var(--purple);
    background: var(--accent-soft);
  }

  .btn--primary {
    border: none;
    background: var(--grad);
    color: #fff;
    box-shadow: var(--shadow);
  }

  .btn--primary:hover:not(:disabled) {
    color: #fff;
    filter: brightness(1.05);
    background: var(--grad);
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .unavailable {
    margin: auto;
    padding: 1.5rem 1rem;
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
    height: auto;
    max-height: none;
    overflow: visible;
    min-height: 100dvh;

    .main {
      flex: none;
      min-height: 0;
      padding: 0.85rem 0 1.1rem;
    }

    .card {
      flex: none;
      grid-template-columns: 1fr;
      height: auto;
    }

    .side {
      border-right: none;
      border-bottom: 1px solid var(--line);
      flex-direction: row;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 0.75rem 0.9rem;
      overflow: visible;
    }

    .cover {
      width: 96px;
      max-width: 96px;
      flex-shrink: 0;
    }

    .meta {
      flex: 1;
      min-width: 140px;
    }

    .guide,
    .side__note {
      width: 100%;
      flex: none;
      overflow: visible;
    }

    .play {
      min-height: 280px;
    }

    .actions .btn {
      flex: 1;
      min-width: 0;
    }

    .guide__group ul {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.22rem 0.7rem;
    }
  }

  @media (max-width: 640px) {
    .brand__text {
      display: none;
    }

    .play {
      padding: 0.75rem 0.7rem 0.85rem;
    }

    .guide__group ul {
      grid-template-columns: 1fr;
    }
  }
`
