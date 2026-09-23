import { useEffect, useRef, useState, type CSSProperties } from 'react'
import styled from 'styled-components'
import { ThemeToggle } from '../utils/ThemeToggle'
import { fetchLyric } from '../utils/server'
import { formatTime, usePlayer, type PlayError } from '../utils/usePlayer'
import type { LyricLine } from '../utils/types'

type PlayerApi = ReturnType<typeof usePlayer>

const ERR: Record<Exclude<PlayError, ''>, string> = {
  next: '播放失败，试试下一首',
  url: '获取播放地址失败',
  fail: '播放失败',
}

function IconPrev() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="currentColor" d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
    </svg>
  )
}

function IconNext() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="currentColor" d="M16 6h2v12h-2V6zM5 18l8.5-6L5 6v12z" />
    </svg>
  )
}

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path fill="currentColor" d="M8 5v14l11-7L8 5z" />
    </svg>
  )
}

function IconPause() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path fill="currentColor" d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  )
}

export function PlayerDock({
  player,
  onOpenFull,
  onOpenQueue,
}: {
  player: PlayerApi
  onOpenFull: () => void
  onOpenQueue: () => void
}) {
  const { current, playing, loading, currentTime, duration, error, toggle, next, prev, seek } = player
  if (!current) return null

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <Dock>
      {error && <p className="error">{ERR[error]}</p>}
      <div className="progress">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          aria-label="播放进度"
          onChange={(e) => seek(Number(e.target.value))}
          style={{ '--p': `${progress}%` } as CSSProperties}
        />
      </div>
      <div className="main">
        <button type="button" className="info" onClick={onOpenFull}>
          <span
            className={`cover ${playing ? 'is-spinning' : ''}`}
            style={{ backgroundImage: current.cover ? `url(${current.cover})` : undefined }}
          />
          <span className="text">
            <span className="title">{current.title}</span>
            <span className="artist">{current.artist}</span>
          </span>
        </button>
        <div className="controls">
          <button type="button" aria-label="上一首" onClick={prev}>
            <IconPrev />
          </button>
          <button type="button" className="primary" aria-label={playing ? '暂停' : '播放'} onClick={toggle}>
            {loading ? '…' : playing ? <IconPause /> : <IconPlay />}
          </button>
          <button type="button" aria-label="下一首" onClick={next}>
            <IconNext />
          </button>
          <button type="button" aria-label="播放列表" onClick={onOpenQueue}>
            ≡
          </button>
        </div>
      </div>
    </Dock>
  )
}

export function FullPlayer({
  player,
  onClose,
  onToggleTheme,
}: {
  player: PlayerApi
  onClose: () => void
  onToggleTheme: () => void
}) {
  const { queue, index, current, playing, loading, currentTime, duration, mode, toggle, next, prev, seek, toggleMode, playAt } =
    player
  const [lines, setLines] = useState<LyricLine[]>([])
  const [lyricErr, setLyricErr] = useState(false)
  const [showList, setShowList] = useState(false)
  const lyricsRef = useRef<HTMLDivElement | null>(null)
  const queueListRef = useRef<HTMLUListElement | null>(null)
  const activeRef = useRef<HTMLLIElement | null>(null)
  const queueActiveRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!current?.id) return
    setLines([])
    setLyricErr(false)
    void fetchLyric(current.id)
      .then((res) => setLines(res.lines))
      .catch(() => setLyricErr(true))
  }, [current?.id])

  const activeIndex = (() => {
    if (!lines.length) return -1
    let idx = 0
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= currentTime + 0.15) idx = i
      else break
    }
    return idx
  })()

  // 只在歌词/列表容器内滚动，避免 scrollIntoView 把整页顶上去
  useEffect(() => {
    const box = lyricsRef.current
    const el = activeRef.current
    if (!box || !el) return
    const boxRect = box.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const offset = elRect.top - boxRect.top + box.scrollTop
    const top = offset - box.clientHeight / 2 + el.clientHeight / 2
    box.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }, [activeIndex])

  useEffect(() => {
    const box = queueListRef.current
    const el = queueActiveRef.current
    if (!box || !el) return
    const boxRect = box.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    if (elRect.top < boxRect.top) {
      box.scrollBy({ top: elRect.top - boxRect.top, behavior: 'smooth' })
    } else if (elRect.bottom > boxRect.bottom) {
      box.scrollBy({ top: elRect.bottom - boxRect.bottom, behavior: 'smooth' })
    }
  }, [index])

  if (!current) return null
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <Full role="dialog" aria-label="正在播放" data-list={showList ? '1' : '0'}>
      <div className="bg" style={{ backgroundImage: current.cover ? `url(${current.cover})` : undefined }} />
      <div className="shade" />

      <aside className="queue">
        <header className="queue-head">
          <h3>播放列表</h3>
          <span className="count">{queue.length} 首</span>
          <button type="button" className="queue-close" onClick={() => setShowList(false)} aria-label="关闭列表">
            ×
          </button>
        </header>
        <ul className="queue-list" ref={queueListRef}>
          {queue.map((song, i) => (
            <li key={`${song.id}-${i}`}>
              <button
                type="button"
                ref={i === index ? queueActiveRef : null}
                className={i === index ? 'is-active' : ''}
                onClick={() => {
                  void playAt(i)
                  setShowList(false)
                }}
              >
                <span className="q-idx">{i === index && playing ? '♪' : i + 1}</span>
                <span
                  className="q-cover"
                  style={{ backgroundImage: song.cover ? `url(${song.cover})` : undefined }}
                />
                <span className="q-meta">
                  <span className="q-title">{song.title}</span>
                  <span className="q-artist">{song.artist}</span>
                </span>
                {song.duration ? <span className="q-time">{song.duration}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="stage">
        <header className="top">
          <button type="button" className="ghost" onClick={onClose} aria-label="收起">
            ↓
          </button>
          <div className="now">
            <p className="title">
              {current.title}
              <span className="sep"> - </span>
              {current.artist}
            </p>
          </div>
          <div className="top-actions">
            <button type="button" className="ghost list-btn" onClick={() => setShowList(true)} aria-label="播放列表">
              ≡
            </button>
            <button type="button" className="ghost" onClick={toggleMode} aria-label="播放模式">
              {mode === 'list' ? '列表' : '单曲'}
            </button>
            <ThemeToggle onClick={onToggleTheme} aria-label="切换深浅色" />
          </div>
        </header>

        <div className="art-wrap">
          <div
            className={`art ${playing ? 'is-spinning' : ''}`}
            style={{ backgroundImage: current.cover ? `url(${current.cover})` : undefined }}
          />
        </div>

        <div className="lyrics" ref={lyricsRef}>
          {lyricErr && <p className="state">暂无歌词</p>}
          {!lyricErr && !lines.length && <p className="state">歌词加载中…</p>}
          <ul>
            {lines.map((line, i) => (
              <li
                key={`${line.time}-${i}`}
                ref={i === activeIndex ? activeRef : null}
                className={i === activeIndex ? 'is-active' : ''}
              >
                {line.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="bottom">
          <div className="times">
            <span>{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={currentTime}
              onChange={(e) => seek(Number(e.target.value))}
              style={{ '--p': `${progress}%` } as CSSProperties}
            />
            <span>{formatTime(duration)}</span>
          </div>
          <div className="controls">
            <button type="button" className="side" onClick={prev} aria-label="上一首">
              <IconPrev />
            </button>
            <button type="button" className="primary" onClick={toggle} aria-label={playing ? '暂停' : '播放'}>
              {loading ? '…' : playing ? <IconPause /> : <IconPlay />}
            </button>
            <button type="button" className="side" onClick={next} aria-label="下一首">
              <IconNext />
            </button>
          </div>
        </div>
      </section>

      {showList && <button type="button" className="mask" aria-label="关闭列表" onClick={() => setShowList(false)} />}
    </Full>
  )
}

export function QueueSheet({ player, onClose }: { player: PlayerApi; onClose: () => void }) {
  const { queue, index, playAt, current, playing } = player
  return (
    <Sheet role="dialog" aria-label="播放列表">
      <button type="button" className="backdrop" aria-label="关闭" onClick={onClose} />
      <div className="panel">
        <header>
          <div>
            <h3>播放列表</h3>
            <p>{queue.length} 首</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>
        <ul>
          {queue.map((song, i) => (
            <li key={`${song.id}-${i}`}>
              <button type="button" className={i === index ? 'is-active' : ''} onClick={() => void playAt(i)}>
                <span className="q-idx">{i === index && playing ? '♪' : i + 1}</span>
                <span
                  className="q-cover"
                  style={{ backgroundImage: song.cover ? `url(${song.cover})` : undefined }}
                />
                <span className="q-meta">
                  <span className="q-title">{song.title}</span>
                  <span className="q-artist">{song.artist}</span>
                </span>
                {current && i === index ? <span className="dot" /> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  )
}

const Dock = styled.div`
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  z-index: 40;
  width: min(640px, calc(100vw - 28px));
  background: var(--dock);
  border: 1px solid var(--line);
  border-radius: 18px;
  backdrop-filter: blur(22px) saturate(1.3);
  -webkit-backdrop-filter: blur(22px) saturate(1.3);
  box-shadow: var(--shadow);
  padding: 6px 14px 10px;

  .error {
    margin: 6px 0 0;
    color: var(--danger);
    font-size: 12px;
    text-align: center;
  }

  .progress input {
    width: 100%;
    appearance: none;
    height: 3px;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--purple) var(--p, 0%), color-mix(in srgb, var(--ink) 12%, transparent) var(--p, 0%));
    outline: none;
    cursor: pointer;
  }

  .progress input::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--purple);
    border: 2px solid var(--bg-elev);
    box-shadow: 0 1px 6px rgba(124, 92, 252, 0.4);
  }

  .main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 4px;
  }

  .info {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    border: 0;
    background: transparent;
    padding: 0;
    cursor: pointer;
    text-align: left;
    flex: 1;
  }

  .cover {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--cover) center / cover no-repeat;
    box-shadow: 0 0 0 1px var(--line);
  }

  .is-spinning {
    animation: spin 12s linear infinite;
  }

  .text {
    min-width: 0;
    display: grid;
    gap: 2px;
  }

  .title,
  .artist {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .title {
    font-size: 13px;
    color: var(--ink);
    font-weight: 600;
  }

  .artist {
    font-size: 11px;
    color: var(--muted);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;

    button {
      width: 34px;
      height: 34px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--text-soft);
      display: grid;
      place-items: center;
      cursor: pointer;
      transition:
        background 0.2s,
        color 0.2s;

      &:hover {
        background: var(--accent-soft);
        color: var(--purple);
      }
    }

    .primary {
      width: 40px;
      height: 40px;
      background: var(--grad-btn);
      color: #fff;
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);

      &:hover {
        opacity: 0.92;
        background: var(--grad-btn);
        color: #fff;
      }
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 520px) {
    width: calc(100vw - 16px);
    bottom: calc(10px + env(safe-area-inset-bottom, 0px));
    padding: 4px 10px 8px;
    border-radius: 16px;
  }
`

const Full = styled.div`
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100dvh;
  max-height: 100dvh;
  z-index: 60;
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  align-items: stretch;
  color: var(--ink);
  overflow: hidden;
  overscroll-behavior: none;
  background: var(--bg);

  .bg {
    position: absolute;
    inset: -48px;
    z-index: 0;
    background: var(--cover) center / cover no-repeat;
    filter: blur(48px) saturate(1.35);
    transform: scale(1.18);
    opacity: 0.72;
    pointer-events: none;
  }

  .shade {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background:
      linear-gradient(
        105deg,
        color-mix(in srgb, var(--bg) 88%, transparent) 0%,
        color-mix(in srgb, var(--bg) 42%, transparent) 38%,
        color-mix(in srgb, var(--bg) 28%, transparent) 62%,
        color-mix(in srgb, var(--bg) 55%, transparent) 100%
      ),
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--bg) 35%, transparent) 0%,
        color-mix(in srgb, var(--bg) 18%, transparent) 42%,
        color-mix(in srgb, var(--bg) 72%, transparent) 100%
      );
  }

  html[data-theme='dark'] & .bg {
    opacity: 0.55;
    filter: blur(52px) saturate(1.25) brightness(0.72);
  }

  html[data-theme='dark'] & .shade {
    background:
      linear-gradient(
        105deg,
        color-mix(in srgb, var(--bg) 82%, transparent) 0%,
        color-mix(in srgb, var(--bg) 38%, transparent) 38%,
        color-mix(in srgb, var(--bg) 22%, transparent) 62%,
        color-mix(in srgb, var(--bg) 48%, transparent) 100%
      ),
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--bg) 30%, transparent) 0%,
        color-mix(in srgb, var(--bg) 12%, transparent) 42%,
        color-mix(in srgb, var(--bg) 78%, transparent) 100%
      );
  }

  .mask {
    display: none;
  }

  .queue,
  .stage {
    position: relative;
    z-index: 1;
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }

  .queue {
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--line);
    background: color-mix(in srgb, var(--bg-elev) 72%, transparent);
    backdrop-filter: blur(22px) saturate(1.2);
    -webkit-backdrop-filter: blur(22px) saturate(1.2);
  }

  .queue-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 22px 20px 14px;
    padding-top: calc(22px + env(safe-area-inset-top, 0px));
    border-bottom: 1px solid var(--line);

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: var(--ink);
    }

    .count {
      font-size: 12px;
      color: var(--muted);
    }

    .queue-close {
      display: none;
      margin-left: auto;
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: 50%;
      background: var(--accent-soft);
      color: var(--ink);
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
    }
  }

  .queue-list {
    list-style: none;
    margin: 0;
    padding: 8px 10px calc(16px + env(safe-area-inset-bottom, 0px));
    overflow: auto;
    overscroll-behavior: contain;
    flex: 1;
    min-height: 0;
  }

  .queue-list button {
    width: 100%;
    display: grid;
    grid-template-columns: 28px 44px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    padding: 10px 10px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: background 0.2s;

    &:hover {
      background: var(--accent-soft);
    }

    &.is-active {
      background: var(--accent-soft);

      .q-title {
        color: var(--purple);
        font-weight: 600;
      }

      .q-idx {
        color: var(--purple);
      }
    }
  }

  .q-idx {
    font-size: 12px;
    color: var(--muted);
    text-align: center;
  }

  .q-cover {
    width: 44px;
    height: 44px;
    border-radius: 8px;
    background: var(--cover) center / cover no-repeat;
    box-shadow: 0 0 0 1px var(--line);
  }

  .q-meta {
    min-width: 0;
    display: grid;
    gap: 2px;
  }

  .q-title {
    font-size: 13px;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .q-artist {
    font-size: 11px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .q-time {
    font-size: 11px;
    color: var(--muted);
  }

  .stage {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    min-width: 0;
    height: 100%;
  }

  .top {
    display: grid;
    grid-template-columns: 40px 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 18px 22px 8px;
    padding-top: calc(18px + env(safe-area-inset-top, 0px));
  }

  .ghost {
    border: 0;
    background: var(--bg-elev);
    color: var(--ink);
    border-radius: 999px;
    height: 36px;
    min-width: 36px;
    padding: 0 12px;
    cursor: pointer;
    border: 1px solid var(--line);
    box-shadow: var(--shadow-soft);
  }

  .top-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .list-btn {
    display: none;
  }

  .now {
    min-width: 0;
    text-align: center;
  }

  .title {
    margin: 0;
    font-size: 15px;
    font-weight: 500;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    .sep {
      color: var(--muted);
    }
  }

  .art-wrap {
    display: grid;
    place-items: center;
    padding: 8px 16px 4px;
  }

  .art {
    width: min(220px, 42vw, 36vh);
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--cover) center / cover no-repeat;
    box-shadow:
      0 0 0 1px var(--line),
      0 20px 50px rgba(15, 23, 42, 0.12);
  }

  .is-spinning {
    animation: spin 18s linear infinite;
  }

  .lyrics {
    overflow: auto;
    overscroll-behavior: contain;
    mask-image: linear-gradient(180deg, transparent, #000 10%, #000 90%, transparent);
    padding: 0 28px;
    min-height: 0;

    ul {
      list-style: none;
      margin: 0;
      padding: 36px 0;
      text-align: center;
    }

    li {
      padding: 7px 0;
      color: var(--muted);
      transition:
        color 0.2s,
        transform 0.2s;
      font-size: 14px;
      line-height: 1.5;
    }

    li.is-active {
      color: var(--ink);
      transform: scale(1.04);
      font-weight: 600;
    }

    .state {
      text-align: center;
      color: var(--muted);
      margin-top: 24px;
    }
  }

  .bottom {
    padding: 10px 36px calc(20px + env(safe-area-inset-bottom, 0px));
    flex-shrink: 0;
  }

  .times {
    display: grid;
    grid-template-columns: 40px 1fr 40px;
    align-items: center;
    gap: 12px;
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 18px;

    input {
      width: 100%;
      appearance: none;
      height: 3px;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--purple) var(--p, 0%), rgba(255, 255, 255, 0.14) var(--p, 0%));
      outline: none;
      cursor: pointer;
    }

    input::-webkit-slider-thumb {
      appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--purple);
      box-shadow: 0 0 12px rgba(124, 92, 252, 0.4);
    }
  }

  .controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 28px;

    button {
      display: grid;
      place-items: center;
      cursor: pointer;
    }

    .side {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      border: 0;
      background: var(--bg-elev);
      color: var(--ink);
      box-shadow: inset 0 0 0 1px var(--line);
    }

    .primary {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      border: 0;
      background: var(--grad-btn);
      color: #fff;
      box-shadow: 0 10px 30px rgba(59, 130, 246, 0.35);
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr);

    .queue {
      position: fixed;
      inset: 0 auto 0 0;
      height: 100dvh;
      max-height: 100dvh;
      width: min(86vw, 340px);
      z-index: 3;
      transform: translateX(-105%);
      transition: transform 0.28s ease;
      border-right: 1px solid var(--line);
      box-shadow: 12px 0 40px rgba(0, 0, 0, 0.4);
    }

    &[data-list='1'] .queue {
      transform: translateX(0);
    }

    &[data-list='1'] .mask {
      display: block;
      position: absolute;
      inset: 0;
      z-index: 2;
      border: 0;
      background: rgba(0, 0, 0, 0.5);
      cursor: pointer;
    }

    .queue-head .queue-close {
      display: grid;
      place-items: center;
    }

    .list-btn {
      display: inline-grid;
      place-items: center;
    }

    .art {
      width: min(200px, 52vw);
    }

    .bottom {
      padding-left: 20px;
      padding-right: 20px;
    }

    .controls {
      gap: 22px;

      .side {
        width: 48px;
        height: 48px;
      }

      .primary {
        width: 64px;
        height: 64px;
      }
    }
  }
`

const Sheet = styled.div`
  position: fixed;
  inset: 0;
  z-index: 55;

  .backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    background: rgba(0, 0, 0, 0.55);
    cursor: pointer;
  }

  .panel {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    max-height: 72vh;
    background: var(--bg-elev);
    border-radius: 18px 18px 0 0;
    border-top: 1px solid var(--line);
    display: grid;
    grid-template-rows: auto 1fr;
    animation: sheet-up 0.25s ease;
    box-shadow: var(--shadow);

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);

      h3 {
        margin: 0;
        font-size: 16px;
        color: var(--ink);
      }

      p {
        margin: 4px 0 0;
        font-size: 12px;
        color: var(--muted);
      }

      button {
        width: 34px;
        height: 34px;
        border: 0;
        border-radius: 50%;
        background: var(--accent-soft);
        color: var(--ink);
        font-size: 20px;
        cursor: pointer;
      }
    }

    ul {
      list-style: none;
      margin: 0;
      padding: 8px 10px calc(16px + env(safe-area-inset-bottom, 0px));
      overflow: auto;
    }

    li button {
      width: 100%;
      display: grid;
      grid-template-columns: 28px 44px minmax(0, 1fr) 12px;
      gap: 10px;
      align-items: center;
      padding: 10px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      text-align: left;
      cursor: pointer;
      transition: background 0.2s;

      &:hover {
        background: var(--accent-soft);
      }

      &.is-active {
        background: var(--accent-soft);

        .q-title {
          color: var(--purple);
          font-weight: 600;
        }

        .q-idx {
          color: var(--purple);
        }

        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--purple);
          box-shadow: 0 0 10px rgba(124, 92, 252, 0.45);
        }
      }
    }

    .q-idx {
      font-size: 12px;
      color: var(--muted);
      text-align: center;
    }

    .q-cover {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      background: var(--bg-elev) center / cover no-repeat;
    }

    .q-meta {
      min-width: 0;
      display: grid;
      gap: 2px;
    }

    .q-title {
      font-size: 14px;
      color: var(--ink);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .q-artist {
      font-size: 12px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  @keyframes sheet-up {
    from {
      transform: translateY(24px);
      opacity: 0.6;
    }
    to {
      transform: none;
      opacity: 1;
    }
  }
`
