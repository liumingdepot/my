import Hls from 'hls.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import styled from 'styled-components'
import { saveWatchHistory } from '../utils/history'
import {
  fetchDramaDetail,
  resolvePlayback,
  sortEpisodes,
  type DramaDetail,
  type DramaEpisode,
  type PlaybackPlan,
} from '../utils/server'

const PLAY_FROM_KEY = 'hongguo-play-from'

type PlayLocationState = {
  from?: string
}

function resolveBack(from: string | null | undefined) {
  const path = (from || '').trim()
  if (!path.startsWith('/hongguo')) {
    return { to: '/hongguo', label: '← 返回' }
  }
  if (path === '/hongguo' || path === '/hongguo/' || path.startsWith('/hongguo/play')) {
    return { to: '/hongguo', label: '← 返回' }
  }
  return { to: path, label: '← 返回' }
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

  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)

  const episodes = useMemo(
    () => (detail ? sortEpisodes(detail.play_list || []) : []),
    [detail],
  )

  const back = useMemo(() => {
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
      setResolveError('')
      try {
        const data = await fetchDramaDetail(dramaId, ac.signal)
        if (cancelled) return
        setDetail(data)
        const sorted = sortEpisodes(data.play_list || [])
        if (sorted[0]) {
          setActiveIdx(0)
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
    const video = videoRef.current
    if (!video || !plan?.url) return

    setPlayError('')
    setMediaReady(false)
    hlsRef.current?.destroy()
    hlsRef.current = null

    const onReady = () => setMediaReady(true)
    video.addEventListener('playing', onReady)
    video.addEventListener('loadeddata', onReady)

    const isHls =
      plan.mediaType === 'hls' ||
      plan.originUrl?.includes('.m3u8') === true ||
      (plan.url.includes('.m3u8') && !plan.proxy)

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        maxBufferLength: 30,
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

    return () => {
      video.removeEventListener('playing', onReady)
      video.removeEventListener('loadeddata', onReady)
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
  }, [plan?.url])

  async function playEpisode(ep: DramaEpisode, index: number) {
    if (!detail) return
    setResolveError('')
    setPlayError('')
    setActiveIdx(index)
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

  function goBack() {
    navigate(back.to)
  }

  if (loading && !detail) {
    return (
      <Status>
        <button type="button" className="back" onClick={goBack}>
          {back.label}
        </button>
        加载中…
      </Status>
    )
  }

  if (error || !detail) {
    return (
      <Status className="err">
        <button type="button" className="back" onClick={goBack}>
          {back.label}
        </button>
        {error || '未找到短剧'}
      </Status>
    )
  }

  const meta = [
    detail.total_episode_num ? `共 ${detail.total_episode_num} 集` : '',
    detail.is_over === '1' || detail.release_status === 'completed'
      ? '已完结'
      : detail.is_over === '0' || detail.release_status === 'ongoing'
        ? '连载中'
        : '',
    detail.tags,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Page>
      <div className="container">
        <div className="main-row">
          <div className="player-wrap">
            <div className="player-inner">
              <video
                ref={videoRef}
                controls
                playsInline
                poster={plan?.episode.first_img || detail.image_link || undefined}
              />
              {!mediaReady && !playError && !resolveError ? (
                <div className="placeholder">
                  <span className="brand">红果短剧</span>
                  <span className="hint">{resolving ? '正在取流…' : '为您加载中'}</span>
                </div>
              ) : null}
              {playError ? <p className="play-err">{playError}</p> : null}
              {resolveError ? <p className="play-err">{resolveError}</p> : null}
            </div>
          </div>

          <aside className="side">
            <header className="meta">
              <button type="button" className="back" onClick={goBack}>
                {back.label}
              </button>
              <h1>{detail.title}</h1>
              {meta ? <p>{meta}</p> : null}
            </header>

            {detail.intro ? (
              <section className="block info">
                <p className="blurb">
                  <em>简介</em>
                  {detail.intro}
                </p>
              </section>
            ) : null}

            {episodes.length > 0 ? (
              <section className="block">
                <h2>分集（{episodes.length}）</h2>
                <div className="eps">
                  {episodes.map((ep, i) => (
                    <button
                      key={ep.video_id || `${ep.sort}-${i}`}
                      type="button"
                      className={i === activeIdx ? 'is-active' : ''}
                      disabled={ep.playable === false || resolving}
                      onClick={() => void playEpisode(ep, i)}
                    >
                      第 {ep.sort || i + 1} 集
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              <section className="block">
                <p className="empty">暂无分集</p>
              </section>
            )}
          </aside>
        </div>
      </div>
    </Page>
  )
}

const Page = styled.div`
  .container {
    width: 90%;
    max-width: none;
    margin: 0 auto;
    padding: 24px 0 32px;
  }

  .main-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
    gap: 24px;
    align-items: stretch;
    margin-bottom: 32px;
  }

  .player-wrap {
    background: #000;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .player-inner {
    position: relative;
    aspect-ratio: 16 / 9;
    background: #0a0a0c;

    video {
      width: 100%;
      height: 100%;
      display: block;
      background: #000;
    }

    .placeholder {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      pointer-events: none;
      background:
        radial-gradient(ellipse 70% 55% at 50% 40%, rgba(232, 165, 75, 0.12), transparent 70%),
        linear-gradient(160deg, #141418 0%, #0a0a0c 55%, #121214 100%);

      .brand {
        font-family: ui-serif, 'Songti SC', 'STSong', 'SimSun', serif;
        font-size: 36px;
        font-weight: 700;
        letter-spacing: 0.18em;
        color: #e8a54b;
      }

      .hint {
        font-size: 15px;
        letter-spacing: 0.2em;
        color: rgba(245, 242, 234, 0.55);
      }
    }

    .play-err {
      position: absolute;
      left: 50%;
      bottom: 20%;
      z-index: 3;
      transform: translateX(-50%);
      margin: 0;
      padding: 8px 16px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.75);
      color: #e07070;
      font-size: 13px;
    }
  }

  .side {
    min-width: 0;
    height: 0;
    min-height: 100%;
    overflow-y: auto;
    padding-right: 4px;

    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-thumb {
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.15);
    }
  }

  .meta {
    margin-bottom: 20px;

    .back {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin: 0 0 14px;
      min-height: 34px;
      padding: 0 14px;
      border-radius: 999px;
      border: 1px solid rgba(232, 165, 75, 0.45);
      background: rgba(232, 165, 75, 0.14);
      color: #e8a54b;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
      cursor: pointer;
      transition:
        border-color 0.2s,
        background 0.2s,
        color 0.2s;

      &:hover {
        border-color: #e8a54b;
        background: #e8a54b;
        color: #0a0a0c;
      }
    }

    h1 {
      margin: 0;
      font-family: ui-serif, 'Songti SC', 'STSong', 'SimSun', serif;
      font-size: clamp(20px, 2.2vw, 28px);
      font-weight: 700;
      line-height: 1.35;
    }

    p {
      margin: 10px 0 0;
      font-size: 13px;
      line-height: 1.5;
      color: rgba(245, 242, 234, 0.55);
    }
  }

  .block {
    margin-bottom: 28px;

    h2 {
      margin: 0 0 14px;
      font-size: 16px;
      font-weight: 600;
      color: rgba(245, 242, 234, 0.9);
    }

    &:last-child {
      margin-bottom: 0;
    }
  }

  .side .block {
    margin-bottom: 20px;
  }

  .eps {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    button {
      min-width: 88px;
      height: 36px;
      padding: 0 12px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.04);
      color: rgba(245, 242, 234, 0.8);
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover:not(:disabled) {
        border-color: rgba(232, 165, 75, 0.45);
        color: #e8a54b;
      }

      &:disabled {
        opacity: 0.45;
        cursor: default;
      }

      &.is-active {
        background: #e8a54b;
        border-color: #e8a54b;
        color: #0a0a0c;
        font-weight: 600;
      }
    }
  }

  .info {
    p {
      margin: 0 0 12px;
      font-size: 14px;
      line-height: 1.7;
      color: rgba(245, 242, 234, 0.7);

      em {
        display: inline-block;
        min-width: 42px;
        margin-right: 10px;
        font-style: normal;
        color: rgba(245, 242, 234, 0.4);
      }
    }

    .blurb {
      color: rgba(245, 242, 234, 0.55);
      display: -webkit-box;
      -webkit-line-clamp: 8;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }

  .empty {
    margin: 0;
    font-size: 13px;
    color: rgba(245, 242, 234, 0.45);
  }

  @media (max-width: 1100px) {
    .main-row {
      grid-template-columns: minmax(0, 1fr) minmax(220px, 280px);
      gap: 18px;
    }
  }

  @media (max-width: 860px) {
    .main-row {
      grid-template-columns: 1fr;
    }

    .side {
      height: auto;
      min-height: 0;
      overflow: visible;
      padding-right: 0;
    }

    .player-inner .placeholder .brand {
      font-size: 28px;
    }
  }
`

const Status = styled.div`
  width: 90%;
  margin: 48px auto;
  color: rgba(245, 242, 234, 0.55);
  font-size: 14px;

  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin: 0 0 16px;
    min-height: 34px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid rgba(232, 165, 75, 0.45);
    background: rgba(232, 165, 75, 0.14);
    color: #e8a54b;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition:
      border-color 0.2s,
      background 0.2s,
      color 0.2s;

    &:hover {
      border-color: #e8a54b;
      background: #e8a54b;
      color: #0a0a0c;
    }
  }

  &.err {
    color: #e07070;
  }
`
