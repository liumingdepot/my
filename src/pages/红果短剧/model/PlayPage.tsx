import Hls from 'hls.js'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import styled from 'styled-components'
import { saveWatchHistory } from '../utils/history'
import {
  fetchDramaDetail,
  fetchRecommend,
  prefetchNextEpisodes,
  prefetchPlayback,
  resolvePlayback,
  sortEpisodes,
  type DramaDetail,
  type DramaEpisode,
  type DramaListItem,
  type PlaybackPlan,
} from '../utils/server'

const PLAY_FROM_KEY = 'hongguo-play-from'
const EP_PAGE_SIZE = 21
const ACCENT = '#fa7705'
const PLAY_RATES = [0.75, 1, 1.25, 1.5, 2] as const
const HIDE_CTRL_MS = 2800

type VideoWithPip = HTMLVideoElement & {
  webkitSetPresentationMode?: (mode: 'inline' | 'picture-in-picture' | 'fullscreen') => void
  webkitPresentationMode?: 'inline' | 'picture-in-picture' | 'fullscreen'
}

function supportsPip(video: HTMLVideoElement | null) {
  if (!video) return false
  const v = video as VideoWithPip
  if (document.pictureInPictureEnabled && !video.disablePictureInPicture) return true
  return typeof v.webkitSetPresentationMode === 'function'
}

function isInPip(video: HTMLVideoElement | null) {
  if (!video) return false
  if (document.pictureInPictureElement === video) return true
  return (video as VideoWithPip).webkitPresentationMode === 'picture-in-picture'
}

type PlayLocationState = {
  from?: string
}

function resolveBack(from: string | null | undefined) {
  const path = (from || '').trim()
  if (!path.startsWith('/hongguo')) return '/hongguo'
  if (path === '/hongguo' || path === '/hongguo/' || path.startsWith('/hongguo/play')) return '/hongguo'
  return path
}

function splitTags(raw: string) {
  return raw
    .split(/[,，、|/\\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 6)
}

function epRanges(total: number) {
  if (total <= 0) return [] as { start: number; end: number; label: string }[]
  const ranges = []
  for (let start = 1; start <= total; start += EP_PAGE_SIZE) {
    const end = Math.min(start + EP_PAGE_SIZE - 1, total)
    ranges.push({ start, end, label: `${start}-${end}` })
  }
  return ranges
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const total = Math.floor(sec)
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function PlayPage() {
  const { id = '' } = useParams()
  const dramaId = decodeURIComponent(id)
  const navigate = useNavigate()
  const location = useLocation()

  const [detail, setDetail] = useState<DramaDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [plan, setPlan] = useState<PlaybackPlan | null>(null)
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState('')
  const [playError, setPlayError] = useState('')
  const [mediaReady, setMediaReady] = useState(false)
  const [pipSupported, setPipSupported] = useState(false)
  const [inPip, setInPip] = useState(false)
  const [introOpen, setIntroOpen] = useState(false)
  const [epRangeIdx, setEpRangeIdx] = useState(0)
  const [recommend, setRecommend] = useState<DramaListItem[]>([])
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [rate, setRate] = useState(1)
  const [rateOpen, setRateOpen] = useState(false)
  const [ctrlVisible, setCtrlVisible] = useState(true)
  const [muted, setMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const playerInnerRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const hideTimerRef = useRef(0)
  const seekingRef = useRef(false)
  const rateOpenRef = useRef(false)
  const rateRef = useRef(1)
  const activeIdxRef = useRef(0)
  const episodesRef = useRef<DramaEpisode[]>([])
  const playEpisodeRef = useRef<(ep: DramaEpisode, index: number) => Promise<void>>(async () => {})

  const episodes = useMemo(
    () => (detail ? sortEpisodes(detail.play_list || []) : []),
    [detail],
  )

  const ranges = useMemo(() => epRanges(episodes.length), [episodes.length])

  const backTo = useMemo(() => {
    const stateFrom = (location.state as PlayLocationState | null)?.from
    if (stateFrom && stateFrom.startsWith('/hongguo')) {
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
  }, [location.state, dramaId])

  const activeEp = episodes[activeIdx]
  const epLabel = activeEp ? `第${activeEp.sort || activeIdx + 1}集` : ''
  const tags = useMemo(() => splitTags(detail?.tags || ''), [detail?.tags])
  const glassCover =
    plan?.episode.first_img || activeEp?.first_img || detail?.image_link || ''
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0
  const bufferRatio = duration > 0 ? Math.min(1, buffered / duration) : 0

  activeIdxRef.current = activeIdx
  episodesRef.current = episodes
  rateOpenRef.current = rateOpen
  rateRef.current = rate

  function bumpControls() {
    setCtrlVisible(true)
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(() => {
      if (seekingRef.current || rateOpenRef.current) return
      const v = videoRef.current
      if (v && !v.paused) setCtrlVisible(false)
    }, HIDE_CTRL_MS)
  }

  useEffect(() => {
    if (!dramaId) {
      setLoading(false)
      setError('缺少短剧 id')
      return
    }

    let cancelled = false
    const ac = new AbortController()
    ;(async () => {
      setLoading(true)
      setError('')
      setDetail(null)
      setPlan(null)
      setActiveIdx(0)
      setEpRangeIdx(0)
      setResolveError('')
      setIntroOpen(false)
      try {
        const data = await fetchDramaDetail(dramaId, ac.signal)
        if (cancelled) return
        setDetail(data)
        const sorted = sortEpisodes(data.play_list || [])
        if (sorted[0]) {
          setActiveIdx(0)
          // 详情就绪即预热第 1、2 集解密/切片，减轻穿透首播等待
          prefetchPlayback(sorted[0].video_id)
          prefetchNextEpisodes(sorted, 0, 1)
          setResolving(true)
          try {
            const next = await resolvePlayback(data, sorted[0], ac.signal)
            if (!cancelled) setPlan(next)
          } catch (e) {
            if (!cancelled) setResolveError(e instanceof Error ? e.message : '取流失败')
          } finally {
            if (!cancelled) setResolving(false)
          }
        }
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return
        setError(err instanceof Error ? err.message : '加载详情失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [dramaId])

  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()
    fetchRecommend(12, ac.signal)
      .then((list) => {
        if (!cancelled) setRecommend(list.filter((x) => String(x.id) !== dramaId))
      })
      .catch(() => {
        if (!cancelled) setRecommend([])
      })
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [dramaId])

  useEffect(() => {
    if (!detail || !plan) return
    saveWatchHistory({
      id: detail.playlet_id || dramaId,
      title: detail.title,
      pic: detail.image_link || '',
      sub: detail.tags || (detail.total_episode_num ? `共 ${detail.total_episode_num} 集` : ''),
      episode: `第 ${plan.episode.sort || activeIdx + 1} 集`,
    })
  }, [detail, plan, dramaId, activeIdx])

  useEffect(() => {
    if (!ranges.length) return
    const n = activeIdx + 1
    const idx = ranges.findIndex((r) => n >= r.start && n <= r.end)
    if (idx >= 0) setEpRangeIdx(idx)
  }, [activeIdx, ranges])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !plan?.url) return

    setPlayError('')
    setMediaReady(false)
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setBuffered(0)
    setRateOpen(false)
    setCtrlVisible(true)
    hlsRef.current?.destroy()
    hlsRef.current = null

    const onReady = () => {
      setMediaReady(true)
      video.playbackRate = rateRef.current
    }
    const syncTime = () => {
      if (!seekingRef.current) setCurrentTime(video.currentTime || 0)
      const d = video.duration
      if (Number.isFinite(d) && d > 0) setDuration(d)
    }
    const syncBuffered = () => {
      try {
        if (video.buffered.length > 0) {
          setBuffered(video.buffered.end(video.buffered.length - 1))
        }
      } catch {
        /* ignore */
      }
    }
    const onPlay = () => {
      setPlaying(true)
      bumpControls()
    }
    const onPause = () => {
      setPlaying(false)
      setCtrlVisible(true)
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    }
    const onEnded = () => {
      setPlaying(false)
      setCtrlVisible(true)
      const idx = activeIdxRef.current
      const list = episodesRef.current
      const nextIdx = idx + 1
      const next = list[nextIdx]
      if (!next || next.playable === false) return
      void playEpisodeRef.current(next, nextIdx)
    }

    video.addEventListener('playing', onReady)
    video.addEventListener('loadeddata', onReady)
    video.addEventListener('timeupdate', syncTime)
    video.addEventListener('durationchange', syncTime)
    video.addEventListener('progress', syncBuffered)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('ended', onEnded)
    video.playbackRate = rateRef.current
    video.muted = muted

    const isHls =
      plan.mediaType === 'hls' ||
      plan.url.includes('.m3u8') ||
      plan.url.includes('seg=index.m3u8') ||
      plan.originUrl?.includes('.m3u8') === true

    if (isHls && Hls.isSupported()) {
      // Cloudflare Tunnel 等高 RTT：多分片 + 更大缓冲，单片失败可重试
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        maxBufferSize: 60 * 1000 * 1000,
        fragLoadingTimeOut: 90_000,
        manifestLoadingTimeOut: 45_000,
        fragLoadingMaxRetry: 6,
        manifestLoadingMaxRetry: 4,
        startFragPrefetch: true,
        xhrSetup(xhr) {
          xhr.withCredentials = false
        },
      })
      hlsRef.current = hls
      hls.loadSource(plan.url)
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setPlayError('播放失败，可换一集重试')
      })
      void video.play().catch(() => {})
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = plan.url
      void video.play().catch(() => {})
    } else {
      video.src = plan.url
      void video.play().catch(() => {
        setPlayError('播放失败，可换一集重试')
      })
    }

    bumpControls()

    return () => {
      video.removeEventListener('playing', onReady)
      video.removeEventListener('loadeddata', onReady)
      video.removeEventListener('timeupdate', syncTime)
      video.removeEventListener('durationchange', syncTime)
      video.removeEventListener('progress', syncBuffered)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('ended', onEnded)
      hlsRef.current?.destroy()
      hlsRef.current = null
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.url])

  useEffect(() => {
    const video = videoRef.current
    if (video) video.playbackRate = rate
  }, [rate])

  useEffect(() => {
    const video = videoRef.current
    if (video) video.muted = muted
  }, [muted])

  useEffect(() => {
    if (rateOpen) {
      setCtrlVisible(true)
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    } else {
      bumpControls()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateOpen])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const sync = () => {
      setPipSupported(supportsPip(video))
      setInPip(isInPip(video))
    }
    sync()

    const onEnter = () => setInPip(true)
    const onLeave = () => setInPip(false)
    video.addEventListener('enterpictureinpicture', onEnter)
    video.addEventListener('leavepictureinpicture', onLeave)
    video.addEventListener('webkitpresentationmodechanged', sync)

    return () => {
      video.removeEventListener('enterpictureinpicture', onEnter)
      video.removeEventListener('leavepictureinpicture', onLeave)
      video.removeEventListener('webkitpresentationmodechanged', sync)
    }
  }, [plan?.url])

  useEffect(() => {
    const onFs = () => {
      const el = playerInnerRef.current
      setIsFullscreen(Boolean(el && document.fullscreenElement === el))
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  async function togglePlay() {
    const video = videoRef.current
    if (!video || !plan?.url) return
    setRateOpen(false)
    bumpControls()
    if (video.paused) await video.play().catch(() => {})
    else video.pause()
  }

  function seekTo(ratio: number) {
    const video = videoRef.current
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return
    const next = Math.min(1, Math.max(0, ratio)) * video.duration
    video.currentTime = next
    setCurrentTime(next)
  }

  function onSeekPointer(e: ReactPointerEvent<HTMLDivElement>) {
    const bar = e.currentTarget
    const rect = bar.getBoundingClientRect()
    if (rect.width <= 0) return
    seekingRef.current = true
    bumpControls()
    seekTo((e.clientX - rect.left) / rect.width)

    const onMove = (ev: PointerEvent) => {
      const r = bar.getBoundingClientRect()
      if (r.width <= 0) return
      seekTo((ev.clientX - r.left) / r.width)
    }
    const onUp = () => {
      seekingRef.current = false
      bumpControls()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function pickRate(next: number) {
    setRate(next)
    setRateOpen(false)
    bumpControls()
  }

  async function togglePip() {
    const video = videoRef.current
    if (!video || !supportsPip(video)) return
    bumpControls()

    const v = video as VideoWithPip
    try {
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture()
        return
      }
      if (v.webkitPresentationMode === 'picture-in-picture') {
        v.webkitSetPresentationMode?.('inline')
        return
      }
      if (document.pictureInPictureEnabled) {
        if (video.paused) await video.play().catch(() => {})
        await video.requestPictureInPicture()
        return
      }
      v.webkitSetPresentationMode?.('picture-in-picture')
    } catch {
      setPlayError('当前浏览器暂不支持画中画')
    }
  }

  async function toggleFullscreen() {
    const el = playerInnerRef.current
    if (!el) return
    bumpControls()
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen()
      } else {
        await el.requestFullscreen()
      }
    } catch {
      /* ignore */
    }
  }

  async function playEpisode(ep: DramaEpisode, index: number) {
    if (!detail) return
    if (ep.playable === false) {
      setActiveIdx(index)
      setPlan(null)
      const n = detail.accessible_episode_cnt
      setResolveError(
        n && n > 0
          ? `红果网页仅开放试看前 ${n} 集，第 ${ep.sort || index + 1} 集暂无法公开取流`
          : '该集超出网页试看范围，暂无法公开取流',
      )
      setPlayError('')
      return
    }
    setResolveError('')
    setPlayError('')
    setActiveIdx(index)
    prefetchNextEpisodes(episodesRef.current, index, 1)
    setResolving(true)
    setPlan(null)
    try {
      const next = await resolvePlayback(detail, ep)
      setPlan(next)
    } catch (e) {
      setResolveError(e instanceof Error ? e.message : '取流失败')
    } finally {
      setResolving(false)
    }
  }

  playEpisodeRef.current = playEpisode

  if (loading && !detail) {
    return (
      <Page>
        <div className="stage">
          <div className="player-area">
            <div className="player-inner is-empty">
              <div className="placeholder">
                <span className="hint">加载中…</span>
              </div>
            </div>
          </div>
          <aside className="side" />
        </div>
      </Page>
    )
  }

  if (error || !detail) {
    return (
      <Page>
        <div className="stage">
          <div className="player-area">
            <nav className="crumbs">
              <Link to="/hongguo">首页</Link>
              <span>/</span>
              <span>未找到</span>
            </nav>
            <div className="player-inner is-empty">
              <div className="placeholder">
                <span className="hint err">{error || '未找到短剧'}</span>
                <button type="button" className="back-link" onClick={() => navigate(backTo)}>
                  返回
                </button>
              </div>
            </div>
          </div>
          <aside className="side" />
        </div>
      </Page>
    )
  }

  const range = ranges[epRangeIdx] || ranges[0]
  const visibleEps = range ? episodes.slice(range.start - 1, range.end) : episodes
  const showCtrl = ctrlVisible || !playing || rateOpen

  return (
    <Page>
      <div className="stage">
        <div className="player-area">
          <nav className={`crumbs${showCtrl ? '' : ' is-hidden'}`}>
            <Link to="/hongguo">首页</Link>
            <span>/</span>
            <Link to={backTo}>{detail.title}</Link>
            <span>/</span>
            <span className="current">{epLabel || '播放'}</span>
          </nav>

          <div className="player-wrap">
            <div
              ref={playerInnerRef}
              className={`player-inner${showCtrl ? ' show-ctrl' : ''}${isFullscreen ? ' is-fs' : ''}`}
              onMouseMove={bumpControls}
              onPointerDown={bumpControls}
            >
              <div className="glass" aria-hidden="true">
                {glassCover ? (
                  <img src={glassCover} alt="" draggable={false} referrerPolicy="no-referrer" />
                ) : null}
              </div>

              <video
                ref={videoRef}
                playsInline
                poster={glassCover || undefined}
                onClick={() => void togglePlay()}
              />

              {mediaReady && !playing ? (
                <button
                  type="button"
                  className="center-play"
                  aria-label="播放"
                  onClick={() => void togglePlay()}
                >
                  <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true">
                    <path fill="currentColor" d="M8 5.5v13l11-6.5-11-6.5z" />
                  </svg>
                </button>
              ) : null}

              <div
                className={`ctrl-layer${showCtrl ? ' is-on' : ''}`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="ctrl-top">
                  <span className="ep-chip">{epLabel}</span>
                </div>

                <div className="ctrl-bottom">
                  <div
                    className="seek"
                    role="slider"
                    aria-label="进度"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress * 100)}
                    onPointerDown={onSeekPointer}
                  >
                    <div className="seek-track">
                      <div className="seek-buf" style={{ width: `${bufferRatio * 100}%` }} />
                      <div className="seek-played" style={{ width: `${progress * 100}%` }} />
                      <div className="seek-thumb" style={{ left: `${progress * 100}%` }} />
                    </div>
                  </div>

                  <div className="ctrl-row">
                    <div className="ctrl-left">
                      <button
                        type="button"
                        className="ctrl-btn"
                        aria-label={playing ? '暂停' : '播放'}
                        onClick={() => void togglePlay()}
                      >
                        {playing ? (
                          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                            <path fill="currentColor" d="M7 5h3.5v14H7V5zm6.5 0H17v14h-3.5V5z" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                            <path fill="currentColor" d="M8 5.5v13l11-6.5-11-6.5z" />
                          </svg>
                        )}
                      </button>

                      <button
                        type="button"
                        className="ctrl-btn"
                        aria-label={muted ? '取消静音' : '静音'}
                        onClick={() => {
                          setMuted((m) => !m)
                          bumpControls()
                        }}
                      >
                        {muted ? (
                          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                            <path
                              fill="currentColor"
                              d="M4.3 3.2 3.2 4.3 8.9 10H4v4h4l4 4v-5.1l5.7 5.7 1.1-1.1L4.3 3.2zM14 7.2v-.8l-2.1 2.1L14 7.2zm2.5 2.2-1.1 1.1A3.98 3.98 0 0 1 16 12c0 .6-.1 1.1-.3 1.6l1.2 1.2c.5-.8.7-1.8.7-2.8 0-1.5-.5-2.8-1.3-3.8l-.8.2z"
                            />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                            <path
                              fill="currentColor"
                              d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.8-1-3.3-2.5-4v8c1.5-.7 2.5-2.2 2.5-4z"
                            />
                          </svg>
                        )}
                      </button>

                      <span className="time">
                        {formatTime(currentTime)}
                        <i>/</i>
                        {formatTime(duration)}
                      </span>
                    </div>

                    <div className="ctrl-right">
                      <div className={`rate-pop${rateOpen ? ' open' : ''}`}>
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
                                {r === 1 ? '1.0x' : `${r}x`}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <button
                          type="button"
                          className={`ctrl-btn rate-btn${rate !== 1 ? ' on' : ''}`}
                          aria-expanded={rateOpen}
                          aria-label={`倍速 ${rate}x`}
                          onClick={() => {
                            setRateOpen((o) => !o)
                            bumpControls()
                          }}
                        >
                          {rate === 1 ? '倍速' : `${rate}x`}
                        </button>
                      </div>

                      {pipSupported ? (
                        <button
                          type="button"
                          className={`ctrl-btn${inPip ? ' on' : ''}`}
                          aria-label={inPip ? '退出画中画' : '画中画'}
                          title={inPip ? '退出画中画' : '画中画'}
                          onClick={() => void togglePip()}
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                            <path
                              fill="currentColor"
                              d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"
                            />
                          </svg>
                        </button>
                      ) : null}

                      <button
                        type="button"
                        className="ctrl-btn"
                        aria-label={isFullscreen ? '退出全屏' : '全屏'}
                        onClick={() => void toggleFullscreen()}
                      >
                        {isFullscreen ? (
                          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                            <path
                              fill="currentColor"
                              d="M7 14H5v5h5v-2H7v-3zm12 0h-2v3h-3v2h5v-5zM7 7h3V5H5v5h2V7zm12-2h-5v2h3v3h2V5z"
                            />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                            <path
                              fill="currentColor"
                              d="M7 14H5v5h5v-2H7v-3zm0-4h2V7h3V5H5v5zm12 9h-5v2h5v-5h-2v3zm0-14h-5v2h3v3h2V5z"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {!mediaReady && !playError && !resolveError ? (
                <div className="placeholder">
                  <span className="spinner" aria-hidden />
                  <span className="hint">{resolving ? '正在取流…' : '为您加载中'}</span>
                </div>
              ) : null}
              {playError ? <p className="play-err">{playError}</p> : null}
              {resolveError ? <p className="play-err">{resolveError}</p> : null}
            </div>
          </div>
        </div>

        <aside className="side">
          <div className="side-scroll">
            <div className="meta-top">
              <div className="poster">
                {detail.image_link ? (
                  <img src={detail.image_link} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <div className="poster-ph" />
                )}
              </div>
              <div className="meta-text">
                <h1>{detail.title}</h1>
                {tags.length > 0 ? (
                  <div className="tags">
                    {tags.map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {detail.intro ? (
              <section className="block">
                <div className="block-title">简介</div>
                <div className={`intro ${introOpen ? 'is-open' : ''}`}>
                  <p>{detail.intro}</p>
                  {!introOpen ? (
                    <button type="button" className="intro-more" onClick={() => setIntroOpen(true)}>
                      ...展开
                    </button>
                  ) : (
                    <button type="button" className="intro-more" onClick={() => setIntroOpen(false)}>
                      收起
                    </button>
                  )}
                </div>
              </section>
            ) : null}

            {episodes.length > 0 ? (
              <section className="block eps-block">
                <div className="block-title row">
                  <span>选集</span>
                  {ranges.length > 1 ? (
                    <div className="segs">
                      {ranges.map((r, i) => (
                        <button
                          key={r.label}
                          type="button"
                          className={i === epRangeIdx ? 'is-active' : ''}
                          onClick={() => setEpRangeIdx(i)}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="eps">
                  {visibleEps.map((ep) => {
                    const i = episodes.indexOf(ep)
                    const locked = ep.playable === false
                    const num = ep.sort || i + 1
                    const active = i === activeIdx
                    return (
                      <button
                        key={ep.video_id || `${ep.sort}-${i}`}
                        type="button"
                        className={[active ? 'is-active' : '', locked ? 'is-locked' : '']
                          .filter(Boolean)
                          .join(' ')}
                        disabled={resolving}
                        title={locked ? '超出试看范围' : `第 ${num} 集`}
                        onClick={() => void playEpisode(ep, i)}
                      >
                        <span className="num">{num}</span>
                        {active && !locked ? <span className="playing" aria-hidden /> : null}
                        {locked ? <span className="lock" aria-hidden /> : null}
                      </button>
                    )
                  })}
                </div>
              </section>
            ) : (
              <section className="block">
                <p className="empty">暂无分集</p>
              </section>
            )}

            {recommend.length > 0 ? (
              <section className="block rec-block">
                <div className="block-title">推荐短剧</div>
                <div className="recs">
                  {recommend.map((item) => (
                    <Link
                      key={String(item.id)}
                      className="rec"
                      to={`/hongguo/play/${encodeURIComponent(String(item.id))}`}
                      state={{ from: backTo }}
                    >
                      <div className="rec-poster">
                        {item.image_link ? (
                          <img src={item.image_link} alt="" loading="lazy" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="poster-ph" />
                        )}
                      </div>
                      <div className="rec-info">
                        <div className="rec-title">{item.title}</div>
                        <div className="rec-sub">
                          {[item.sub_title, item.total_num ? `${item.total_num}集` : '']
                            .filter(Boolean)
                            .join(' · ') || '短剧'}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </aside>
      </div>
    </Page>
  )
}

const Page = styled.div`
  height: 100%;
  min-height: 480px;
  margin: 0;
  background: #000;
  color: rgba(255, 255, 255, 0.9);

  @media (max-width: 900px) {
    height: auto;
    min-height: 70vh;
  }

  .stage {
    display: flex;
    align-items: stretch;
    height: 100%;
    min-height: inherit;
    overflow: hidden;
  }

  .player-area {
    position: relative;
    flex: 0 0 auto;
    align-self: stretch;
    /* PC：高 = 视口高 - 顶栏64；宽 = 高 / 1080 * 1920（16:9） */
    height: calc(100vh - 64px);
    width: calc((100vh - 64px) / 1080 * 1920);
    max-height: 100%;
    display: flex;
    flex-direction: column;
    background: #000;
  }

  .crumbs {
    position: absolute;
    top: 12px;
    left: 16px;
    z-index: 6;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 13px;
    line-height: 1.4;
    color: rgba(255, 255, 255, 0.45);
    pointer-events: none;
    transition: opacity 0.25s;

    &.is-hidden {
      opacity: 0;
    }

    a,
    .current {
      pointer-events: auto;
      color: rgba(255, 255, 255, 0.55);
      text-decoration: none;
    }

    a:hover {
      color: rgba(255, 255, 255, 0.9);
    }

    .current {
      color: rgba(255, 255, 255, 0.75);
    }
  }

  .player-wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
  }

  .player-inner {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #000;
    cursor: pointer;

    &.is-empty {
      min-height: 360px;
      cursor: default;
    }

    &.is-fs {
      background: #000;
    }

    .glass {
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
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      display: block;
      background: transparent;
      object-fit: contain;
    }

    .center-play {
      position: absolute;
      left: 50%;
      top: 50%;
      z-index: 4;
      transform: translate(-50%, -50%);
      width: 72px;
      height: 72px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.45);
      color: #fff;
      cursor: pointer;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
      transition:
        transform 0.2s,
        background 0.2s;

      svg {
        margin-left: 3px;
      }

      &:hover {
        background: rgba(250, 119, 5, 0.85);
        transform: translate(-50%, -50%) scale(1.05);
      }
    }

    .ctrl-layer {
      position: absolute;
      inset: 0;
      z-index: 5;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.28s ease;

      &.is-on {
        opacity: 1;
        pointer-events: none;

        .ctrl-bottom,
        .ctrl-top,
        .ctrl-btn,
        .seek,
        .rate-menu {
          pointer-events: auto;
        }
      }

      &::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(
          180deg,
          rgba(0, 0, 0, 0.45) 0%,
          transparent 28%,
          transparent 58%,
          rgba(0, 0, 0, 0.72) 100%
        );
        pointer-events: none;
      }
    }

    .ctrl-top {
      position: relative;
      z-index: 1;
      display: flex;
      justify-content: flex-end;
      padding: 14px 16px 0;
    }

    .ep-chip {
      display: inline-flex;
      align-items: center;
      height: 28px;
      padding: 0 10px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: rgba(255, 255, 255, 0.85);
      font-size: 12px;
      letter-spacing: 0.04em;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    .ctrl-bottom {
      position: relative;
      z-index: 1;
      padding: 0 14px 12px;
    }

    .seek {
      padding: 10px 2px 8px;
      cursor: pointer;
      touch-action: none;

      &:hover .seek-track {
        height: 5px;
      }

      &:hover .seek-thumb {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
    }

    .seek-track {
      position: relative;
      height: 3px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.22);
      transition: height 0.15s;
    }

    .seek-buf,
    .seek-played {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      border-radius: inherit;
      pointer-events: none;
    }

    .seek-buf {
      background: rgba(255, 255, 255, 0.28);
    }

    .seek-played {
      background: linear-gradient(90deg, #ff9a3c, ${ACCENT});
    }

    .seek-thumb {
      position: absolute;
      top: 50%;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(250, 119, 5, 0.35);
      transform: translate(-50%, -50%) scale(0.6);
      opacity: 0;
      transition:
        opacity 0.15s,
        transform 0.15s;
      pointer-events: none;
    }

    .ctrl-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .ctrl-left,
    .ctrl-right {
      display: flex;
      align-items: center;
      gap: 4px;
      min-width: 0;
    }

    .ctrl-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      height: 36px;
      padding: 0 8px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: rgba(255, 255, 255, 0.92);
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
      cursor: pointer;
      transition:
        background 0.15s,
        color 0.15s;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }

      &.on {
        color: ${ACCENT};
      }
    }

    .rate-btn {
      min-width: 48px;
      font-variant-numeric: tabular-nums;
    }

    .time {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: 4px;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      color: rgba(255, 255, 255, 0.72);
      white-space: nowrap;

      i {
        font-style: normal;
        color: rgba(255, 255, 255, 0.35);
      }
    }

    .rate-pop {
      position: relative;
    }

    .rate-menu {
      position: absolute;
      right: 0;
      bottom: calc(100% + 8px);
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 84px;
      padding: 6px;
      border-radius: 12px;
      background: rgba(18, 18, 20, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);

      button {
        height: 34px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: rgba(255, 255, 255, 0.78);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;

        &:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        &.on {
          background: rgba(250, 119, 5, 0.16);
          color: ${ACCENT};
        }
      }
    }

    .placeholder {
      position: absolute;
      inset: 0;
      z-index: 3;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      pointer-events: none;
      background: rgba(10, 10, 12, 0.45);

      .spinner {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.18);
        border-top-color: ${ACCENT};
        animation: hg-spin 0.8s linear infinite;
      }

      .hint {
        font-size: 14px;
        letter-spacing: 0.12em;
        color: rgba(255, 255, 255, 0.45);

        &.err {
          color: #e07070;
          letter-spacing: 0;
        }
      }

      .back-link {
        pointer-events: auto;
        margin-top: 4px;
        padding: 6px 14px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: transparent;
        color: rgba(255, 255, 255, 0.7);
        font-size: 13px;
        cursor: pointer;
      }
    }

    .play-err {
      position: absolute;
      left: 50%;
      bottom: 22%;
      z-index: 6;
      transform: translateX(-50%);
      margin: 0;
      padding: 8px 16px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.75);
      color: #e07070;
      font-size: 13px;
      white-space: nowrap;
      max-width: 90%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  @keyframes hg-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .side {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: #181a1a;
    border-left: 1px solid rgba(255, 255, 255, 0.04);
  }

  .side-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 16px 16px 24px;

    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-thumb {
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.12);
    }
  }

  .meta-top {
    display: flex;
    gap: 12px;
    margin-bottom: 18px;
  }

  .poster {
    width: 84px;
    height: 118px;
    flex-shrink: 0;
    border-radius: 6px;
    overflow: hidden;
    background: #2a2a2e;

    img,
    .poster-ph {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }
  }

  .meta-text {
    min-width: 0;
    flex: 1;

    h1 {
      margin: 0 0 10px;
      font-size: 18px;
      font-weight: 600;
      line-height: 1.35;
      color: rgba(255, 255, 255, 0.95);
    }
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(224, 224, 224, 0.06);
    color: rgba(255, 255, 255, 0.65);
    font-size: 12px;
    line-height: 1.3;
  }

  .block {
    margin-bottom: 20px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .block-title {
    margin: 0 0 10px;
    font-size: 15px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);

    &.row {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
    }
  }

  .intro {
    position: relative;

    p {
      margin: 0;
      font-size: 13px;
      line-height: 1.65;
      color: rgba(255, 255, 255, 0.45);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    &.is-open p {
      display: block;
      -webkit-line-clamp: unset;
      overflow: visible;
    }

    .intro-more {
      margin-top: 4px;
      padding: 0;
      border: 0;
      background: none;
      color: rgba(255, 255, 255, 0.55);
      font-size: 13px;
      cursor: pointer;

      &:hover {
        color: ${ACCENT};
      }
    }
  }

  .segs {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 14px;

    button {
      padding: 0;
      border: 0;
      background: none;
      color: rgba(255, 255, 255, 0.4);
      font-size: 14px;
      font-weight: 400;
      cursor: pointer;

      &.is-active {
        color: rgba(255, 255, 255, 0.9);
        font-weight: 500;
      }

      &:hover {
        color: rgba(255, 255, 255, 0.75);
      }
    }
  }

  .eps {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 8px;

    button {
      position: relative;
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
      font-size: 15px;
      cursor: pointer;
      transition: background 0.15s;

      &:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.12);
      }

      &:disabled {
        opacity: 0.5;
        cursor: default;
      }

      .num {
        position: relative;
        z-index: 1;
      }

      &.is-active {
        background: rgba(250, 119, 5, 0.12);

        .num {
          color: ${ACCENT};
        }
      }

      &.is-locked {
        .num {
          opacity: 0.55;
        }
      }

      .playing {
        position: absolute;
        right: 5px;
        bottom: 5px;
        width: 8px;
        height: 8px;
        background: ${ACCENT};
        border-radius: 1px;
        box-shadow:
          -4px 0 0 -1px ${ACCENT},
          4px 0 0 -2px ${ACCENT};
        opacity: 0.95;
      }

      .lock {
        position: absolute;
        top: 4px;
        left: 5px;
        width: 8px;
        height: 10px;
        border: 1.5px solid rgba(255, 255, 255, 0.55);
        border-radius: 2px 2px 1px 1px;
        opacity: 0.7;

        &::before {
          content: '';
          position: absolute;
          top: -5px;
          left: 0.5px;
          width: 5px;
          height: 5px;
          border: 1.5px solid rgba(255, 255, 255, 0.55);
          border-bottom: 0;
          border-radius: 5px 5px 0 0;
        }
      }
    }
  }

  .empty {
    margin: 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.35);
  }

  .recs {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .rec {
    display: flex;
    gap: 10px;
    text-decoration: none;
    color: inherit;
    min-width: 0;

    &:hover .rec-title {
      color: ${ACCENT};
    }
  }

  .rec-poster {
    width: 64px;
    height: 90px;
    flex-shrink: 0;
    border-radius: 6px;
    overflow: hidden;
    background: #2a2a2e;

    img,
    .poster-ph {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }
  }

  .rec-info {
    min-width: 0;
    flex: 1;
    padding-top: 2px;
  }

  .rec-title {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
    color: rgba(255, 255, 255, 0.9);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .rec-sub {
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.4;
    color: rgba(255, 255, 255, 0.4);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  @media (max-width: 900px) {
    .stage {
      flex-direction: column;
      height: auto;
    }

    .player-area {
      width: 100%;
      height: auto;
      max-width: none;
      min-height: 56vw;
    }

    .player-inner {
      aspect-ratio: 16 / 9;
      height: auto;

      .glass img {
        filter: blur(40px) brightness(0.5) saturate(1.2);
      }

      .center-play {
        width: 60px;
        height: 60px;

        svg {
          width: 30px;
          height: 30px;
        }
      }

      .ctrl-bottom {
        padding: 0 10px 10px;
      }

      .time {
        font-size: 11px;
      }
    }

    .side {
      flex: none;
      width: 100%;
      border-left: 0;
      border-top: 1px solid rgba(255, 255, 255, 0.04);
      max-height: none;
    }

    .side-scroll {
      max-height: none;
      overflow: visible;
    }

    .crumbs {
      position: static;
      padding: 10px 12px 0;

      &.is-hidden {
        opacity: 1;
      }
    }
  }
`
