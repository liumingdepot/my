import Hls from 'hls.js'
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router'
import styled from 'styled-components'
import { fetchFeed, type FeedItem } from '../utils/server'

function pickUrl(ep: FeedItem['episode']) {
  return ep.video_url || ep.video_h265_url || ''
}

function feedKey(item: FeedItem, i: number) {
  return `${item.drama.playlet_id}-${item.episode.video_id || item.episode.sort}-${i}`
}

type SlideProps = {
  item: FeedItem
  active: boolean
  onEnded: () => void
}

function FeedSlide({ item, active, onEnded }: SlideProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [muted, setMuted] = useState(true)
  const [playError, setPlayError] = useState('')
  const playUrl = pickUrl(item.episode)

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
        if (data.fatal) setPlayError('播放失败，上滑换下一部')
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
        poster={item.episode.first_img || item.drama.image_link}
        onEnded={onEnded}
      />
      <div className="shade" />
      <div className="meta">
        <p className="cat">{item.category}</p>
        <h2>{item.drama.title}</h2>
        <p className="ep">
          第 {item.episode.sort} 集
          {item.drama.total_episode_num ? ` / 共 ${item.drama.total_episode_num} 集` : ''}
          {item.drama.tags ? ` · ${item.drama.tags}` : ''}
        </p>
        {item.drama.intro ? <p className="intro">{item.drama.intro}</p> : null}
        {playError ? <p className="err">{playError}</p> : null}
        <Link
          className="more"
          to={`/short/play/${item.drama.id}`}
          state={{ from: '/short' }}
          onClick={(e) => e.stopPropagation()}
        >
          看全集 →
        </Link>
      </div>
      <button type="button" className="mute" onClick={toggleMute} aria-label={muted ? '取消静音' : '静音'}>
        {muted ? '🔇' : '🔊'}
      </button>
    </Slide>
  )
}

const PREFETCH = 3

export default function HomePage() {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [items, setItems] = useState<FeedItem[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const loadingMoreRef = useRef(false)
  const itemsRef = useRef<FeedItem[]>([])
  itemsRef.current = items

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const exclude = itemsRef.current.map((it) => it.drama.id)
      const data = await fetchFeed({ count: 2, exclude })
      const next = data.list || []
      if (next.length) setItems((prev) => [...prev, ...next])
    } catch {
      /* 追加失败不打断当前播放 */
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await fetchFeed({ count: PREFETCH, signal: ac.signal })
        if (cancelled) return
        const list = data.list || []
        setItems(list)
        if (!list.length) setError('暂无推荐内容')
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [])

  useEffect(() => {
    if (activeIdx >= items.length - 2 && items.length > 0) {
      void loadMore()
    }
  }, [activeIdx, items.length, loadMore])

  useEffect(() => {
    const root = scrollerRef.current
    if (!root) return

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
        if (best && best.ratio >= 0.55) setActiveIdx(best.idx)
      },
      { root, threshold: [0.55, 0.75, 0.9] },
    )

    slides.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [items.length])

  const activeIdxRef = useRef(0)
  activeIdxRef.current = activeIdx

  function scrollToIndex(idx: number) {
    const root = scrollerRef.current
    const max = itemsRef.current.length - 1
    const next = Math.max(0, Math.min(max, idx))
    const el = root?.querySelector<HTMLElement>(`[data-slide="${next}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /** PC 滚轮 / 拖拽：按页切换（触摸仍走原生滑动） */
  useEffect(() => {
    const root = scrollerRef.current
    if (!root) return

    let locked = false
    let unlockTimer = 0
    let dragStartY: number | null = null
    let dragMoved = false

    const go = (dir: 1 | -1) => {
      if (locked) return
      const cur = activeIdxRef.current
      const max = itemsRef.current.length - 1
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
      if (Math.abs(e.deltaY) < 8 && Math.abs(e.deltaX) < 8) return
      e.preventDefault()
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        go(e.deltaY > 0 ? 1 : -1)
      }
    }

    const onPointerDown = (e: PointerEvent) => {
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
        // 拖拽后吞掉 click，避免误暂停
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
  }, [items.length])

  return (
    <Page>
      {loading && !items.length ? <Status>加载中…</Status> : null}
      {error && !items.length ? <Status className="err">{error}</Status> : null}

      <div className="feed" ref={scrollerRef}>
        {items.map((item, i) => (
          <div key={feedKey(item, i)} className="slot" data-slide={i}>
            <FeedSlide
              item={item}
              active={i === activeIdx}
              onEnded={() => {
                if (i < items.length - 1) scrollToIndex(i + 1)
                else void loadMore()
              }}
            />
          </div>
        ))}
        {loadingMore ? (
          <div className="slot tip">
            <p>加载更多…</p>
          </div>
        ) : null}
      </div>

      <p className="hint">
        {items.length > 1 ? <span>滚轮或上下滑动切换</span> : null}
        <span className="better">移动端访问更佳</span>
      </p>
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

  .hint {
    position: absolute;
    right: 14px;
    bottom: 28px;
    z-index: 5;
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    writing-mode: vertical-rl;
    font-size: 11px;
    letter-spacing: 0.18em;
    color: rgba(255, 255, 255, 0.35);
    pointer-events: none;

    .better {
      color: rgba(79, 209, 138, 0.55);
    }
  }

  @media (max-width: 900px) {
    .hint {
      display: none;
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
    /* 让滚轮/拖拽落到外层 feed，避免 video 劫持 PC 交互 */
    pointer-events: none;
  }

  .shade {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.45) 0%,
      transparent 18%,
      transparent 52%,
      rgba(0, 0, 0, 0.72) 100%
    );
    pointer-events: none;
  }

  .meta {
    position: absolute;
    left: 0;
    right: 72px;
    bottom: 0;
    z-index: 2;
    padding: 20px 20px 36px;
    pointer-events: none;

    a {
      pointer-events: auto;
    }
  }

  .cat {
    margin: 0 0 6px;
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(62, 186, 122, 0.85);
    color: #04120a;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
  }

  h2 {
    margin: 0 0 8px;
    font-family: ui-serif, 'Songti SC', 'STSong', 'SimSun', serif;
    font-size: clamp(18px, 3.2vw, 26px);
    font-weight: 700;
    line-height: 1.25;
    color: #fff;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.55);
  }

  .ep {
    margin: 0 0 8px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.78);
  }

  .intro {
    margin: 0 0 12px;
    max-width: 36em;
    font-size: 12px;
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.55);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .err {
    margin: 0 0 8px;
    font-size: 12px;
    color: #e07070;
  }

  .more {
    display: inline-flex;
    align-items: center;
    min-height: 32px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.28);
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    text-decoration: none;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    backdrop-filter: blur(8px);

    &:hover {
      background: rgba(62, 186, 122, 0.35);
      border-color: rgba(62, 186, 122, 0.55);
    }
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
      right: 56px;
      padding: 16px 14px 28px;
    }

    .mute {
      right: 12px;
      bottom: 100px;
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
  margin: 0;
  background: #0a120e;
  color: rgba(232, 245, 238, 0.55);
  font-size: 14px;

  &.err {
    color: #e07070;
  }
`
