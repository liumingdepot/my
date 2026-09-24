import Hls from 'hls.js'
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import styled from 'styled-components'
import { fetchDramaDetail, type DramaDetail, type DramaEpisode } from '../utils/server'

const PLAY_FROM_KEY = 'short-play-from'

type PlayLocationState = {
  from?: string
}

function resolveBack(from: string | null | undefined) {
  const path = (from || '').trim()
  if (!path.startsWith('/short')) {
    return { to: '/short', label: '返回首页' }
  }
  if (path === '/short' || path === '/short/' || path.startsWith('/short/play')) {
    return { to: '/short', label: '返回首页' }
  }
  return { to: path, label: '返回列表' }
}

function sortEpisodes(list: DramaEpisode[]) {
  return [...list].sort((a, b) => Number(a.sort) - Number(b.sort))
}

function pickUrl(ep: DramaEpisode) {
  return ep.video_url || ep.video_h265_url || ''
}

type SlideProps = {
  ep: DramaEpisode
  title: string
  total: number
  active: boolean
  onEnded: () => void
}

function EpisodeSlide({ ep, title, total, active, onEnded }: SlideProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [muted, setMuted] = useState(false)
  const [playError, setPlayError] = useState('')
  const playUrl = pickUrl(ep)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !playUrl) return

    setPlayError('')
    hlsRef.current?.destroy()
    hlsRef.current = null

    const isHls = playUrl.includes('.m3u8')
    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 30 })
      hlsRef.current = hls
      hls.loadSource(playUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setPlayError('播放失败，上滑换下一集')
      })
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playUrl
    } else {
      video.src = playUrl
    }

    return () => {
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
  }, [playUrl])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (active) {
      video.muted = muted
      void video.play().catch(() => {})
    } else {
      video.pause()
      try {
        video.currentTime = 0
      } catch {
        /* ignore */
      }
    }
  }, [active, muted])

  function toggleMute(e: MouseEvent) {
    e.stopPropagation()
    setMuted((m) => !m)
  }

  function togglePlay() {
    const video = videoRef.current
    if (!video || !active) return
    if (video.paused) void video.play().catch(() => {})
    else video.pause()
  }

  return (
    <Slide onClick={togglePlay}>
      <video
        ref={videoRef}
        playsInline
        loop={false}
        muted={muted}
        poster={ep.first_img || ''}
        onEnded={onEnded}
      />
      <div className="shade" />
      <div className="meta">
        <h2>{title}</h2>
        <p className="ep">
          第 {ep.sort} 集{total ? ` / 共 ${total} 集` : ''}
          {ep.duration ? ` · ${ep.duration}s` : ''}
        </p>
        {playError ? <p className="err">{playError}</p> : null}
      </div>
      <button type="button" className="mute" onClick={toggleMute} aria-label={muted ? '取消静音' : '静音'}>
        {muted ? '🔇' : '🔊'}
      </button>
    </Slide>
  )
}

export default function PlayPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const epIndexRef = useRef(0)

  const [detail, setDetail] = useState<DramaDetail | null>(null)
  const [episodes, setEpisodes] = useState<DramaEpisode[]>([])
  const [epIndex, setEpIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [epPanelOpen, setEpPanelOpen] = useState(false)

  epIndexRef.current = epIndex

  const back = useMemo(() => {
    const stateFrom = (location.state as PlayLocationState | null)?.from
    if (stateFrom && stateFrom.startsWith('/short')) {
      try {
        sessionStorage.setItem(PLAY_FROM_KEY, stateFrom)
      } catch {
        /* ignore */
      }
      return resolveBack(stateFrom)
    }
    let stored = ''
    try {
      stored = sessionStorage.getItem(PLAY_FROM_KEY) || ''
    } catch {
      /* ignore */
    }
    return resolveBack(stored)
  }, [location.state, id])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const ac = new AbortController()
    ;(async () => {
      setLoading(true)
      setError('')
      setDetail(null)
      setEpisodes([])
      setEpIndex(0)
      setEpPanelOpen(false)
      try {
        const data = await fetchDramaDetail(id, ac.signal)
        if (cancelled) return
        const list = sortEpisodes(data.play_list || [])
        setDetail(data)
        setEpisodes(list)
      } catch (e) {
        if (cancelled || (e instanceof DOMException && e.name === 'AbortError')) return
        setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [id])

  useEffect(() => {
    const root = scrollerRef.current
    if (!root || !episodes.length) return

    const slides = root.querySelectorAll<HTMLElement>('[data-slide]')
    if (!slides.length) return

    const io = new IntersectionObserver(
      (entries) => {
        let best: { idx: number; ratio: number } | null = null
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const idx = Number((entry.target as HTMLElement).dataset.slide)
          if (!Number.isFinite(idx)) continue
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { idx, ratio: entry.intersectionRatio }
          }
        }
        if (best && best.ratio >= 0.55) setEpIndex(best.idx)
      },
      { root, threshold: [0.55, 0.75, 0.9] },
    )

    slides.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [episodes.length])

  function scrollToIndex(idx: number, behavior: ScrollBehavior = 'smooth') {
    const root = scrollerRef.current
    const max = episodes.length - 1
    const next = Math.max(0, Math.min(max, idx))
    const el = root?.querySelector<HTMLElement>(`[data-slide="${next}"]`)
    el?.scrollIntoView({ behavior, block: 'start' })
    setEpIndex(next)
  }

  /** PC 滚轮 / 拖拽：按页切换 */
  useEffect(() => {
    const root = scrollerRef.current
    if (!root || !episodes.length) return

    let locked = false
    let unlockTimer = 0
    let dragStartY: number | null = null
    let dragMoved = false

    const go = (dir: 1 | -1) => {
      if (locked || epPanelOpen) return
      const cur = epIndexRef.current
      const max = episodes.length - 1
      const next = cur + dir
      if (next < 0 || next > max) return
      locked = true
      scrollToIndex(next)
      window.clearTimeout(unlockTimer)
      unlockTimer = window.setTimeout(() => {
        locked = false
      }, 520)
    }

    const onWheel = (e: WheelEvent) => {
      if (epPanelOpen) return
      if (Math.abs(e.deltaY) < 8 && Math.abs(e.deltaX) < 8) return
      e.preventDefault()
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        go(e.deltaY > 0 ? 1 : -1)
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      if (epPanelOpen) return
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      const t = e.target as HTMLElement | null
      if (t?.closest('a, button, input')) return
      dragStartY = e.clientY
      dragMoved = false
      root.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (dragStartY == null) return
      if (Math.abs(e.clientY - dragStartY) > 12) dragMoved = true
    }

    const onPointerUp = (e: PointerEvent) => {
      if (dragStartY == null) return
      const dy = e.clientY - dragStartY
      dragStartY = null
      if (dragMoved) {
        const block = (ev: Event) => {
          ev.preventDefault()
          ev.stopPropagation()
          root.removeEventListener('click', block, true)
        }
        root.addEventListener('click', block, true)
        window.setTimeout(() => root.removeEventListener('click', block, true), 0)
      }
      if (!dragMoved || Math.abs(dy) < 48) return
      go(dy < 0 ? 1 : -1)
    }

    root.addEventListener('wheel', onWheel, { passive: false })
    root.addEventListener('pointerdown', onPointerDown)
    root.addEventListener('pointermove', onPointerMove)
    root.addEventListener('pointerup', onPointerUp)
    root.addEventListener('pointercancel', onPointerUp)

    return () => {
      window.clearTimeout(unlockTimer)
      root.removeEventListener('wheel', onWheel)
      root.removeEventListener('pointerdown', onPointerDown)
      root.removeEventListener('pointermove', onPointerMove)
      root.removeEventListener('pointerup', onPointerUp)
      root.removeEventListener('pointercancel', onPointerUp)
    }
  }, [episodes.length, epPanelOpen])

  function pickEpisode(i: number) {
    setEpPanelOpen(false)
    // 等面板关掉再滚，避免布局抖动
    requestAnimationFrame(() => scrollToIndex(i, 'auto'))
  }

  if (loading) {
    return (
      <Page>
        <Status>加载中…</Status>
      </Page>
    )
  }

  if (error) {
    return (
      <Page>
        <Status className="err">
          {error}
          <Link className="back-inline" to={back.to}>
            {back.label}
          </Link>
        </Status>
      </Page>
    )
  }

  if (!detail) return null

  const current = episodes[epIndex]
  const total = Number(detail.total_episode_num) || episodes.length

  return (
    <Page>
      <div className="top-bar">
        <Link className="back" to={back.to}>
          ← {back.label}
        </Link>
        <div className="title-wrap">
          <p className="drama-title">{detail.title}</p>
          {current ? (
            <p className="drama-ep">
              第 {current.sort} 集{total ? ` / ${total}` : ''}
            </p>
          ) : null}
        </div>
      </div>

      <div className="feed" ref={scrollerRef}>
        {episodes.map((ep, i) => (
          <div key={ep.video_id || `${ep.sort}-${i}`} className="slot" data-slide={i}>
            <EpisodeSlide
              ep={ep}
              title={detail.title}
              total={total}
              active={i === epIndex}
              onEnded={() => {
                if (i < episodes.length - 1) scrollToIndex(i + 1)
              }}
            />
          </div>
        ))}
        {!episodes.length ? (
          <div className="slot tip">
            <p>暂无分集</p>
          </div>
        ) : null}
      </div>

      {episodes.length > 0 ? (
        <aside className="side-actions">
          <button
            type="button"
            className={`ep-fab${epPanelOpen ? ' on' : ''}`}
            onClick={() => setEpPanelOpen((o) => !o)}
            aria-expanded={epPanelOpen}
            aria-label={`选集，当前第 ${current?.sort ?? epIndex + 1} 集`}
            title="选集"
          >
            <svg className="ep-icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="4" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.95" />
              <rect x="14" y="4" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.55" />
              <rect x="3" y="13" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.55" />
              <rect x="14" y="13" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.55" />
            </svg>
            <span className="ep-fab-num">{current?.sort ?? epIndex + 1}</span>
          </button>
        </aside>
      ) : null}

      {episodes.length > 1 ? <p className="hint">上下滑动切换集数</p> : null}

      {epPanelOpen ? (
        <div className="ep-sheet" role="dialog" aria-label="分集列表">
          <button type="button" className="ep-mask" aria-label="关闭" onClick={() => setEpPanelOpen(false)} />
          <div className="ep-panel">
            <div className="ep-head">
              <div>
                <h3>选集</h3>
                <p>
                  {detail.title}
                  {total ? ` · 共 ${total} 集` : ` · ${episodes.length} 集`}
                </p>
              </div>
              <button type="button" className="ep-close" onClick={() => setEpPanelOpen(false)}>
                关闭
              </button>
            </div>
            <div className="ep-grid">
              {episodes.map((ep, i) => (
                <button
                  key={ep.video_id || `${ep.sort}-${i}`}
                  type="button"
                  className={i === epIndex ? 'on' : ''}
                  onClick={() => pickEpisode(i)}
                >
                  {ep.sort}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </Page>
  )
}

const Page = styled.div`
  position: relative;
  height: 100%;
  min-height: 0;
  background: #000;
  overflow: hidden;
  touch-action: pan-y;

  .top-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 6;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    padding-top: max(12px, env(safe-area-inset-top));
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.62) 0%, transparent 100%);
    pointer-events: none;

    a,
    .title-wrap {
      pointer-events: auto;
    }
  }

  .back {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    min-height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.22);
    background: rgba(0, 0, 0, 0.35);
    color: #fff;
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    backdrop-filter: blur(8px);
    -webkit-tap-highlight-color: transparent;

    &:hover {
      border-color: rgba(62, 186, 122, 0.55);
      background: rgba(62, 186, 122, 0.28);
    }
  }

  .title-wrap {
    min-width: 0;
    flex: 1;
  }

  .drama-title {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 8px rgba(0, 0, 0, 0.45);
  }

  .drama-ep {
    margin: 2px 0 0;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.65);
  }

  .feed {
    height: 100%;
    overflow-y: auto;
    overscroll-behavior: none;
    scroll-snap-type: y mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    touch-action: pan-y;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .slot {
    height: 100%;
    scroll-snap-align: start;
    scroll-snap-stop: always;
    position: relative;

    &.tip {
      display: grid;
      place-items: center;
      color: rgba(255, 255, 255, 0.45);
      font-size: 14px;
      background: #0a0a0a;
    }
  }

  .side-actions {
    position: absolute;
    right: 14px;
    bottom: 28%;
    z-index: 7;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .ep-fab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    width: 44px;
    min-height: 44px;
    padding: 6px 0 4px;
    border: 0;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.45);
    color: #fff;
    font: inherit;
    cursor: pointer;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    -webkit-tap-highlight-color: transparent;
    transition:
      transform 0.15s ease,
      background 0.15s ease,
      color 0.15s ease;

    &:hover {
      background: rgba(0, 0, 0, 0.6);
    }

    &.on {
      color: #3eba7a;
      background: rgba(0, 0, 0, 0.7);
    }
  }

  .ep-icon {
    width: 20px;
    height: 20px;
    display: block;
  }

  .ep-fab-num {
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    color: rgba(255, 255, 255, 0.72);
  }

  .ep-fab.on .ep-fab-num {
    color: #3eba7a;
  }

  .hint {
    position: absolute;
    right: 14px;
    bottom: 24px;
    z-index: 5;
    margin: 0;
    writing-mode: vertical-rl;
    font-size: 11px;
    letter-spacing: 0.18em;
    color: rgba(255, 255, 255, 0.35);
    pointer-events: none;
  }

  .ep-sheet {
    position: absolute;
    inset: 0;
    z-index: 20;
  }

  .ep-mask {
    position: absolute;
    inset: 0;
    border: 0;
    padding: 0;
    background: rgba(0, 0, 0, 0.45);
    cursor: pointer;
  }

  .ep-panel {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    max-height: min(62vh, 520px);
    display: flex;
    flex-direction: column;
    padding: 16px 16px max(18px, env(safe-area-inset-bottom));
    border-radius: 18px 18px 0 0;
    background: rgba(10, 18, 14, 0.97);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 -16px 40px rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }

  .ep-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;

    h3 {
      margin: 0 0 4px;
      font-size: 16px;
      font-weight: 700;
      color: #e8f5ee;
    }

    p {
      margin: 0;
      font-size: 12px;
      color: rgba(232, 245, 238, 0.55);
      max-width: 48vw;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .ep-close {
    flex-shrink: 0;
    min-height: 32px;
    padding: 0 12px;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(232, 245, 238, 0.85);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .ep-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
    gap: 8px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding-right: 2px;

    button {
      min-height: 42px;
      padding: 0 6px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.05);
      color: #e8f5ee;
      font: inherit;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition:
        color 0.15s,
        background 0.15s,
        border-color 0.15s;

      &:hover {
        border-color: rgba(62, 186, 122, 0.45);
        color: #3eba7a;
      }

      &.on {
        color: #04120a;
        background: linear-gradient(145deg, #4fd18a, #2f9d5f);
        border-color: transparent;
        font-weight: 800;
      }
    }
  }

  @media (min-width: 961px) {
    .side-actions {
      right: 28px;
      bottom: 30%;
    }

    .ep-fab {
      width: 48px;
      min-height: 48px;
    }

    .ep-icon {
      width: 22px;
      height: 22px;
    }

    .ep-panel {
      left: 50%;
      right: auto;
      bottom: 24px;
      transform: translateX(-50%);
      width: min(560px, 92vw);
      max-height: min(58vh, 480px);
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .ep-head p {
      max-width: 360px;
    }
  }

  @media (max-width: 960px) {
    .hint {
      display: none;
    }

    .side-actions {
      right: 12px;
      bottom: 22%;
    }
  }
`

const Slide = styled.article`
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  cursor: pointer;
  user-select: none;

  video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #000;
    pointer-events: none;
  }

  .shade {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.4) 0%,
      transparent 16%,
      transparent 55%,
      rgba(0, 0, 0, 0.7) 100%
    );
    pointer-events: none;
  }

  .meta {
    position: absolute;
    left: 0;
    right: 84px;
    bottom: 0;
    z-index: 2;
    padding: 20px 20px 36px;
    pointer-events: none;
  }

  h2 {
    margin: 0 0 8px;
    font-family: ui-serif, 'Songti SC', 'STSong', 'SimSun', serif;
    font-size: clamp(16px, 2.8vw, 22px);
    font-weight: 700;
    line-height: 1.25;
    color: #fff;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.55);
  }

  .ep {
    margin: 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.78);
  }

  .err {
    margin: 8px 0 0;
    font-size: 12px;
    color: #e07070;
  }

  .mute {
    position: absolute;
    right: 16px;
    bottom: 120px;
    z-index: 3;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.45);
    color: #fff;
    font-size: 18px;
    cursor: pointer;
    backdrop-filter: blur(6px);
    -webkit-tap-highlight-color: transparent;
  }

  @media (max-width: 600px) {
    .meta {
      right: 72px;
      padding: 16px 14px 28px;
    }

    .mute {
      right: 12px;
      bottom: 108px;
      width: 40px;
      height: 40px;
    }
  }
`

const Status = styled.p`
  position: absolute;
  inset: 0;
  z-index: 4;
  display: grid;
  place-items: center;
  place-content: center;
  gap: 14px;
  margin: 0;
  background: #0a120e;
  color: rgba(232, 245, 238, 0.55);
  font-size: 14px;

  &.err {
    color: #e07070;
  }

  .back-inline {
    color: #3eba7a;
    text-decoration: none;
    font-weight: 600;
  }
`
