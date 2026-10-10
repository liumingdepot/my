import Hls from 'hls.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import styled from 'styled-components'
import { saveWatchHistory } from '../utils/history'
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

const PLAY_RATES = [0.75, 1, 1.25, 1.5, 2] as const

type SlideProps = {
  ep: DramaEpisode
  title: string
  total: number
  active: boolean
  clean: boolean
  rate: number
  onEnded: () => void
  onTap: () => void
}

function EpisodeSlide({ ep, title, total, active, clean, rate, onEnded, onTap }: SlideProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
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
    video.playbackRate = rate
  }, [rate, playUrl, active])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (active) {
      video.muted = false
      video.playbackRate = rate
      void video.play().catch(() => {})
    } else {
      video.pause()
      try {
        video.currentTime = 0
      } catch {
        /* ignore */
      }
    }
  }, [active, rate])

  function handleTap() {
    if (clean) {
      onTap()
      return
    }
    const video = videoRef.current
    if (!video || !active) return
    if (video.paused) void video.play().catch(() => {})
    else video.pause()
  }

  const cover = ep.first_img || ''

  return (
    <Slide className={clean ? 'is-clean' : undefined} onClick={handleTap}>
      <div className="glass" aria-hidden="true">
        {cover ? <img src={cover} alt="" draggable={false} /> : null}
      </div>
      <video
        ref={videoRef}
        playsInline
        loop={false}
        muted={false}
        poster={cover}
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
  const [clean, setClean] = useState(false)
  const [rate, setRate] = useState(1)
  const [rateOpen, setRateOpen] = useState(false)

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
      setClean(false)
      setRateOpen(false)
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
    if (!detail) return
    const current = episodes[epIndex]
    saveWatchHistory({
      id: String(detail.playlet_id || id),
      title: detail.title,
      pic: detail.image_link || current?.first_img || '',
      sub: detail.total_episode_num ? `共 ${detail.total_episode_num} 集` : '短剧',
      episode: current?.sort ? `第 ${current.sort} 集` : undefined,
    })
  }, [detail, epIndex, episodes, id])

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
      if (locked || epPanelOpen || rateOpen) return
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
      if (epPanelOpen || rateOpen) return
      if (Math.abs(e.deltaY) < 8 && Math.abs(e.deltaX) < 8) return
      e.preventDefault()
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        go(e.deltaY > 0 ? 1 : -1)
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      if (epPanelOpen || rateOpen) return
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
  }, [episodes.length, epPanelOpen, rateOpen])

  function pickEpisode(i: number) {
    setEpPanelOpen(false)
    setRateOpen(false)
    // 等面板关掉再滚，避免布局抖动
    requestAnimationFrame(() => scrollToIndex(i, 'auto'))
  }

  function enterClean() {
    setClean(true)
    setEpPanelOpen(false)
    setRateOpen(false)
  }

  function toggleRatePanel() {
    setRateOpen((o) => !o)
    setEpPanelOpen(false)
  }

  function pickRate(next: number) {
    setRate(next)
    setRateOpen(false)
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
    <Page className={clean ? 'is-clean' : undefined}>
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
              clean={clean}
              rate={rate}
              onTap={() => setClean(false)}
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
            className="tool-fab"
            onClick={enterClean}
            aria-label="清屏"
            title="清屏"
          >
            <svg className="tool-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M3 5h4V3H1v6h2V5zm16 0v2h2V3h-6v2h4zM5 19H3v-4H1v6h6v-2H5zm16-4h2v6h-6v-2h4v-4zM8 8h8v8H8V8z"
              />
            </svg>
          </button>

          <div className={`rate-wrap${rateOpen ? ' open' : ''}`}>
            {rateOpen ? (
              <div className="rate-menu" role="listbox" aria-label="播放速度">
                {PLAY_RATES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="option"
                    aria-selected={rate === r}
                    className={rate === r ? 'on' : ''}
                    onClick={() => pickRate(r)}
                  >
                    {r === 1 ? '1x' : `${r}x`}
                  </button>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              className={`tool-fab rate-fab${rate !== 1 ? ' on' : ''}`}
              onClick={toggleRatePanel}
              aria-expanded={rateOpen}
              aria-label={`倍速 ${rate}x`}
              title="倍速"
            >
              <span className="rate-label">{rate === 1 ? '倍速' : `${rate}x`}</span>
            </button>
          </div>

          <button
            type="button"
            className={`ep-fab${epPanelOpen ? ' on' : ''}`}
            onClick={() => {
              setEpPanelOpen((o) => !o)
              setRateOpen(false)
            }}
            aria-expanded={epPanelOpen}
            aria-label={`选集，当前第 ${current?.sort ?? epIndex + 1} 集`}
            title="选集"
          >
            <svg className="ep-icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="3.5" width="5" height="5" rx="1.2" fill="currentColor" />
              <rect x="10" y="4.5" width="11" height="3" rx="1" fill="currentColor" opacity="0.9" />
              <rect x="3" y="9.5" width="5" height="5" rx="1.2" fill="currentColor" opacity="0.85" />
              <rect x="10" y="10.5" width="11" height="3" rx="1" fill="currentColor" opacity="0.75" />
              <rect x="3" y="15.5" width="5" height="5" rx="1.2" fill="currentColor" opacity="0.7" />
              <rect x="10" y="16.5" width="11" height="3" rx="1" fill="currentColor" opacity="0.6" />
            </svg>
          </button>
        </aside>
      ) : null}

      {episodes.length > 1 ? <p className="hint">上下滑动切换集数 · 播完自动下一集</p> : null}

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

  .tool-fab,
  .ep-fab {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
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

  .tool-icon,
  .ep-icon {
    width: 22px;
    height: 22px;
    display: block;
  }

  .rate-wrap {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .rate-fab {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.02em;
  }

  .rate-label {
    line-height: 1;
  }

  .rate-menu {
    position: absolute;
    bottom: calc(100% + 10px);
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border-radius: 14px;
    background: rgba(8, 14, 11, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);

    button {
      min-width: 52px;
      min-height: 34px;
      padding: 0 10px;
      border: 0;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.85);
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;

      &:hover {
        color: #3eba7a;
        background: rgba(62, 186, 122, 0.16);
      }

      &.on {
        color: #04120a;
        background: linear-gradient(145deg, #4fd18a, #2f9d5f);
      }
    }
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

  &.is-clean {
    .top-bar,
    .hint,
    .side-actions {
      opacity: 0;
      pointer-events: none;
      visibility: hidden;
    }
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
      height: 48px;
    }

    .tool-fab {
      width: 48px;
      height: 48px;
    }

    .tool-icon,
    .ep-icon {
      width: 24px;
      height: 24px;
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
  overflow: hidden;

  .glass {
    display: block;
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    pointer-events: none;
    background: #0a0a0a;

    img {
      position: absolute;
      inset: -18%;
      width: 136%;
      height: 136%;
      object-fit: cover;
      filter: blur(56px) brightness(0.48) saturate(1.25);
      transform: scale(1.05);
    }

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse 55% 70% at 50% 50%, transparent 35%, rgba(0, 0, 0, 0.35) 100%),
        rgba(0, 0, 0, 0.22);
    }
  }

  video {
    position: absolute;
    inset: 0;
    z-index: 1;
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: transparent;
    pointer-events: none;
  }

  .shade {
    position: absolute;
    inset: 0;
    z-index: 2;
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.4) 0%,
      transparent 16%,
      transparent 55%,
      rgba(0, 0, 0, 0.7) 100%
    );
    pointer-events: none;
    transition: opacity 0.2s ease;
  }

  .meta {
    position: absolute;
    left: 0;
    right: 84px;
    bottom: 0;
    z-index: 3;
    padding: 20px 20px 36px;
    pointer-events: none;
    transition:
      opacity 0.2s ease,
      visibility 0.2s ease;
  }

  &.is-clean {
    .shade {
      opacity: 0.25;
    }

    .meta {
      opacity: 0;
      visibility: hidden;
    }
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

  @media (max-width: 600px) {
    .meta {
      right: 72px;
      padding: 16px 14px 28px;
    }

    .glass img {
      filter: blur(40px) brightness(0.5) saturate(1.2);
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
