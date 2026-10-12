import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react'
import { Link, useOutletContext, useParams } from 'react-router'
import styled from 'styled-components'
import { listFavorites, subscribeFavorites, toggleFavorite } from '../utils/favorites'
import { listSaves } from '../utils/saveStore'
import {
  fetchGameCheats,
  fetchGameDetail,
  type GameCheat,
  type PublicGame,
} from '../utils/server'
import ArcadePlayer, { type ArcadePlayerControls } from './ArcadePlayer'
import FcPlayer, { type FcPlayerControls } from './FcPlayer'
import JavaPlayer from './JavaPlayer'
import SaveStatePanel from './SaveStatePanel'
import WebPlayer from './WebPlayer'
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

const JAVA_KEYS = [
  { key: '方向键', label: '方向' },
  { key: 'Enter', label: 'OK / 确认' },
  { key: 'Q', label: '左软键' },
  { key: 'E', label: '右软键' },
  { key: '0-9 * #', label: '数字键' },
]

export default function DetailPage() {
  const { toggleTheme } = useOutletContext<GameOutlet>()
  const { id = '' } = useParams()
  const [game, setGame] = useState<PublicGame | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [controls, setControls] = useState<FcPlayerControls | null>(null)
  const [arcadeControls, setArcadeControls] = useState<ArcadePlayerControls | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveCount, setSaveCount] = useState(0)
  const favorites = useSyncExternalStore(subscribeFavorites, listFavorites, listFavorites)
  const faved = Boolean(game && favorites.some((item) => item.id === game.id))
  const [cheats, setCheats] = useState<GameCheat[]>([])
  const [cheatsLoading, setCheatsLoading] = useState(false)
  const [cheatsOpen, setCheatsOpen] = useState(false)
  const [enabledCheats, setEnabledCheats] = useState<ReadonlySet<number>>(() => new Set())

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
        setArcadeControls(null)
        setSaveOpen(false)
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

  const gameId = game?.id ?? ''
  const isFcGame = game?.category === 'FC'

  // 金手指：仅 FC（jsnes）支持按内存地址改写；开关状态不持久化，刷新后默认全关
  useEffect(() => {
    setCheatsOpen(false)
    setEnabledCheats(new Set())
    if (!isFcGame || !gameId) {
      setCheats([])
      return
    }

    const ac = new AbortController()
    ;(async () => {
      setCheatsLoading(true)
      try {
        const list = await fetchGameCheats(gameId, ac.signal)
        if (ac.signal.aborted) return
        setCheats(list)
      } catch {
        if (!ac.signal.aborted) setCheats([])
      } finally {
        if (!ac.signal.aborted) setCheatsLoading(false)
      }
    })()
    return () => ac.abort()
  }, [gameId, isFcGame])

  function toggleCheat(index: number) {
    setEnabledCheats((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function setAllCheats(value: boolean) {
    setEnabledCheats(value ? new Set(cheats.map((cheat) => cheat.index)) : new Set<number>())
  }

  function onToggleFavorite() {
    if (game) toggleFavorite(game)
  }

  // 存档数量角标
  useEffect(() => {
    if (!gameId) {
      setSaveCount(0)
      return
    }
    const ac = new AbortController()
    ;(async () => {
      const list = await listSaves(gameId)
      if (ac.signal.aborted) return
      setSaveCount(list.length)
    })()
    return () => ac.abort()
  }, [gameId, saveOpen])

  // Esc 关闭弹窗
  useEffect(() => {
    if (!cheatsOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCheatsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cheatsOpen])

  const isFc = game?.category === 'FC'
  const isArcade = game?.category === '街机'
  const isWeb = game?.category === '网页游戏'
  const isJava = game?.category === '怀旧java'
  const playable = Boolean(isFc || isArcade || isWeb || isJava)
  const p1Keys = isArcade ? ARCADE_P1_KEYS : FC_P1_KEYS
  const p2Keys = isArcade ? ARCADE_P2_KEYS : FC_P2_KEYS

  function listHref() {
    if (isArcade) return '/game?platform=街机'
    if (isWeb) return '/game?platform=网页游戏'
    if (isJava) return '/game?platform=怀旧java'
    return '/game'
  }

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
                to={listHref()}
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
                <div className="side__nav">
                  <Link to={listHref()} className="goback" aria-label="返回列表">
                    <span className="goback__icon" aria-hidden>
                      <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
                        <path
                          d="M10 3.5 5.5 8l4.5 4.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    返回
                  </Link>

                  <button
                    type="button"
                    className={`favbtn${faved ? ' is-on' : ''}`}
                    aria-pressed={faved}
                    onClick={onToggleFavorite}
                  >
                    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden>
                      <path
                        d="M12 3.6l2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-3.9 5.6-.8z"
                        fill={faved ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {faved ? '已收藏' : '收藏'}
                  </button>
                </div>

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

                {playable && !isWeb && !isJava ? (
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
                ) : isWeb ? (
                  <p className="side__note">Flash 网页游戏由 Ruffle 模拟运行，点击画面后开始操作。</p>
                ) : isJava ? (
                  <div className="guide">
                    <h2>操作说明</h2>
                    <p className="guide__lead">J2ME 模拟器运行，点击画面后用键盘操作。</p>
                    <div className="guide__group">
                      <span className="guide__role">按键</span>
                      <ul>
                        {JAVA_KEYS.map((item) => (
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
                    当前分类为 {game.category}，网页端仅支持 FC / 街机 / 网页游戏 / 怀旧java 在线游玩。
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
                      cheats={cheats}
                      enabledCheats={enabledCheats}
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
                      <button
                        type="button"
                        className={`btn btn--cheat${enabledCheats.size ? ' btn--on' : ''}`}
                        onClick={() => setCheatsOpen((open) => !open)}
                        aria-expanded={cheatsOpen}
                        aria-controls="game-cheat-panel"
                      >
                        金手指
                        {enabledCheats.size ? ` ${enabledCheats.size}` : ''}
                      </button>
                      <button
                        type="button"
                        className="btn btn--cheat"
                        onClick={() => setSaveOpen(true)}
                        aria-haspopup="dialog"
                      >
                        存档
                        {saveCount ? <b className="btn__badge">{saveCount}</b> : null}
                      </button>
                    </div>

                    {cheatsOpen ? (
                      <div
                        className="cheats"
                        id="game-cheat-panel"
                        role="dialog"
                        aria-modal="true"
                        aria-label="金手指"
                        onClick={(event) => {
                          // 点击遮罩关闭
                          if (event.target === event.currentTarget) setCheatsOpen(false)
                        }}
                      >
                        <div className="cheats__panel">
                          <div className="cheats__head">
                            <h3>金手指</h3>
                            <div className="cheats__ops">
                              <button
                                type="button"
                                disabled={!cheats.length}
                                onClick={() => setAllCheats(true)}
                              >
                                全开
                              </button>
                              <button
                                type="button"
                                disabled={!cheats.length}
                                onClick={() => setAllCheats(false)}
                              >
                                全关
                              </button>
                              <button
                                type="button"
                                className="cheats__close"
                                aria-label="关闭"
                                onClick={() => setCheatsOpen(false)}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                          {cheatsLoading ? (
                            <p className="cheats__empty">金手指加载中…</p>
                          ) : cheats.length === 0 ? (
                            <p className="cheats__empty">该游戏还没有金手指</p>
                          ) : (
                            <ul className="cheats__list">
                              {cheats.map((cheat) => (
                                <li key={cheat.index}>
                                  <label>
                                    <input
                                      type="checkbox"
                                      checked={enabledCheats.has(cheat.index)}
                                      onChange={() => toggleCheat(cheat.index)}
                                    />
                                    <span className="cheats__name">{cheat.name}</span>
                                    <code className="cheats__code">{cheat.code}</code>
                                  </label>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : isArcade ? (
                  <>
                    <ArcadePlayer
                      gameId={game.id}
                      gameName={game.name}
                      downloadUrl={game.downloadUrl}
                      onControlsChange={setArcadeControls}
                    />
                    <div className="actions">
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={!arcadeControls || arcadeControls.status !== 'ready'}
                        onClick={() => arcadeControls?.togglePause()}
                      >
                        {arcadeControls?.paused ? '继续游戏' : '暂停'}
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={
                          !arcadeControls ||
                          (arcadeControls.status !== 'ready' && arcadeControls.status !== 'error')
                        }
                        onClick={() => arcadeControls?.hardReset()}
                      >
                        重新开始
                      </button>
                      <button
                        type="button"
                        className="btn btn--cheat"
                        onClick={() => setSaveOpen(true)}
                        aria-haspopup="dialog"
                      >
                        存档
                        {saveCount ? <b className="btn__badge">{saveCount}</b> : null}
                      </button>
                    </div>
                  </>
                ) : isWeb ? (
                  <WebPlayer
                    gameId={game.id}
                    gameName={game.name}
                    downloadUrl={game.downloadUrl}
                    flashBase={game.flashBase}
                  />
                ) : isJava ? (
                  <JavaPlayer gameId={game.id} gameName={game.name} />
                ) : (
                  <div className="unavailable">
                    <h2>暂不支持在线运行</h2>
                    <p>网页端模拟器仅支持 FC / 街机 / 网页游戏 / 怀旧java。</p>
                  </div>
                )}
              </section>

              {saveOpen && game ? (
                <SaveStatePanel
                  gameId={game.id}
                  platform={isArcade ? '街机' : 'FC'}
                  saveApi={
                    (isArcade ? arcadeControls?.getSaveApi() : controls?.getSaveApi()) ?? null
                  }
                  onClose={() => setSaveOpen(false)}
                />
              ) : null}
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

  .goback {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
    padding: 0.32rem 0.8rem 0.32rem 0.34rem;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: color-mix(in srgb, var(--bg-elev) 72%, transparent);
    color: var(--text-soft);
    font-size: 0.8rem;
    font-weight: 620;
    letter-spacing: 0.02em;
    text-decoration: none;
    box-shadow: var(--shadow-soft);
    transition:
      color 0.18s ease,
      border-color 0.18s ease,
      background 0.18s ease,
      transform 0.18s ease,
      box-shadow 0.18s ease;
  }

  .goback__icon {
    display: grid;
    place-items: center;
    width: 1.3rem;
    height: 1.3rem;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--purple);
    transition:
      background 0.18s ease,
      color 0.18s ease;
  }

  .goback:hover {
    color: var(--purple);
    border-color: color-mix(in srgb, var(--purple) 38%, transparent);
    background: var(--accent-soft);
    transform: translateX(-2px);
    box-shadow:
      var(--shadow-soft),
      0 4px 14px color-mix(in srgb, var(--purple) 18%, transparent);
  }

  .goback:hover .goback__icon {
    background: var(--purple);
    color: #fff;
  }

  .goback:active {
    transform: translateX(0);
  }

  .goback:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--purple) 60%, transparent);
    outline-offset: 2px;
  }

  .side__nav {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
  }

  .favbtn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    flex-shrink: 0;
    padding: 0.32rem 0.7rem;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: color-mix(in srgb, var(--bg-elev) 72%, transparent);
    color: var(--text-soft);
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 620;
    letter-spacing: 0.02em;
    white-space: nowrap;
    cursor: pointer;
    box-shadow: var(--shadow-soft);
    transition:
      color 0.18s ease,
      border-color 0.18s ease,
      background 0.18s ease,
      box-shadow 0.18s ease;
  }

  .favbtn:hover {
    color: var(--amber);
    border-color: color-mix(in srgb, var(--amber) 40%, transparent);
    background: var(--amber-soft);
  }

  .favbtn.is-on {
    color: var(--amber);
    border-color: color-mix(in srgb, var(--amber) 52%, transparent);
    background: var(--amber-soft);
    box-shadow:
      var(--shadow-soft),
      0 4px 14px color-mix(in srgb, var(--amber) 22%, transparent);
  }

  .favbtn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--amber) 60%, transparent);
    outline-offset: 2px;
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

  .btn--cheat {
    min-width: 6rem;
  }

  .btn--cheat.btn--on {
    border-color: color-mix(in srgb, var(--purple) 45%, transparent);
    color: var(--purple);
    background: var(--accent-soft);
  }

  .btn__badge {
    display: inline-grid;
    place-items: center;
    min-width: 1.05rem;
    height: 1.05rem;
    margin-left: 0.3rem;
    padding: 0 0.22rem;
    border-radius: 999px;
    background: var(--purple);
    color: #fff;
    font-size: 0.64rem;
    font-weight: 700;
    line-height: 1;
    vertical-align: middle;
  }

  .cheats {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    padding: 1.25rem;
    background: rgba(8, 10, 18, 0.5);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
    animation: cheats-fade 0.16s ease;
  }

  .cheats__panel {
    width: min(30rem, 100%);
    max-height: min(70dvh, 32rem);
    display: flex;
    flex-direction: column;
    border-radius: 1rem;
    border: 1px solid var(--line);
    background: var(--bg-elev);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.32);
    overflow: hidden;
    animation: cheats-pop 0.18s ease;
  }

  @keyframes cheats-fade {
    from {
      opacity: 0;
    }
  }

  @keyframes cheats-pop {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.98);
    }
  }

  .cheats__head {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    padding: 0.7rem 0.75rem 0.7rem 0.95rem;
    border-bottom: 1px solid var(--line);
  }

  .cheats__head h3 {
    margin: 0;
    font-size: 0.82rem;
    font-weight: 720;
  }

  .cheats__ops {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .cheats__ops button {
    height: 26px;
    padding: 0 0.6rem;
    border-radius: 0.45rem;
    border: 1px solid var(--line);
    background: var(--bg);
    color: var(--text-soft);
    font-size: 0.74rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      color 0.15s ease,
      border-color 0.15s ease;
  }

  .cheats__ops button:hover:not(:disabled) {
    color: var(--purple);
    border-color: color-mix(in srgb, var(--purple) 40%, transparent);
  }

  .cheats__ops button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .cheats__ops .cheats__close {
    width: 26px;
    padding: 0;
    display: grid;
    place-items: center;
    font-size: 0.8rem;
  }

  .cheats__empty {
    margin: 0;
    padding: 1.6rem 0.95rem;
    text-align: center;
    color: var(--muted);
    font-size: 0.82rem;
  }

  .cheats__list {
    margin: 0;
    padding: 0.35rem;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    overflow-y: auto;
  }

  .cheats__list label {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.4rem 0.45rem;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .cheats__list label:hover {
    background: color-mix(in srgb, var(--purple) 8%, transparent);
  }

  .cheats__list input {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    accent-color: var(--purple);
    cursor: pointer;
  }

  .cheats__name {
    flex: 1;
    min-width: 0;
    font-size: 0.82rem;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cheats__code {
    flex-shrink: 0;
    padding: 0.1rem 0.35rem;
    border-radius: 0.35rem;
    background: color-mix(in srgb, var(--ink) 6%, transparent);
    color: var(--muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.68rem;
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

    .cheats {
      padding: 0.9rem;
    }

    .cheats__panel {
      max-height: 78dvh;
    }

    .actions .btn--cheat {
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
