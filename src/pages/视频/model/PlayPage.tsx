import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import Hls from 'hls.js'
import styled from 'styled-components'
import VodCard from './VodCard'
import { fetchDetailItem, listVideos } from '../utils/server'
import { loadMergedEntries, saveMergedEntries } from '../utils/merge'
import { scoreOf, stripHtml } from '../utils/parse'
import type { MergedEntry, VodItem } from '../utils/types'

function entryKey(entry: MergedEntry) {
  return `${entry.source}::${entry.vod_id}`
}

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

type LocationState = {
  mirrors?: MergedEntry[]
}

export default function PlayPage() {
  const { source: sourceParam = '', id = '' } = useParams()
  const source = decodeURIComponent(sourceParam)
  const navigate = useNavigate()
  const location = useLocation()

  const [mirrors, setMirrors] = useState<MergedEntry[]>(() => [{ source, vod_id: id }])
  const [cache, setCache] = useState<Record<string, VodItem>>({})
  const [related, setRelated] = useState<VodItem[]>([])
  const [lineIndex, setLineIndex] = useState(0)
  const [episodeIndex, setEpisodeIndex] = useState(0)
  const [error, setError] = useState('')
  const [playError, setPlayError] = useState('')
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [mediaReady, setMediaReady] = useState(false)
  const [pipSupported, setPipSupported] = useState(false)
  const [inPip, setInPip] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const relatedFor = useRef('')

  const activeKey = entryKey({ source, vod_id: id })
  const item = cache[activeKey] ?? null
  const displayRef = useRef<VodItem | null>(null)
  if (item) displayRef.current = item
  const display = item ?? (switching ? displayRef.current : null)

  useEffect(() => {
    const fromState = (location.state as LocationState | null)?.mirrors
    const list = loadMergedEntries(source, id, fromState)
    saveMergedEntries(list)
    setMirrors(list)
  }, [source, id, location.state])

  useEffect(() => {
    let cancelled = false
    const key = entryKey({ source, vod_id: id })

    if (cache[key]) {
      setLoading(false)
      setError('')
      setLineIndex(0)
      setEpisodeIndex(0)
      setSwitching(false)
      return
    }

    setLoading(true)
    setError('')
    setLineIndex(0)
    setEpisodeIndex(0)

    fetchDetailItem(id, source)
      .then((data) => {
        if (cancelled) return
        if (!data) {
          setError('未找到影片')
          return
        }
        setCache((prev) => ({ ...prev, [key]: data }))
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败')
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setSwitching(false)
        }
      })

    return () => {
      cancelled = true
    }
    // cache intentionally omitted — avoid refetch loops; miss checked inside
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, id])

  // Prefetch other merged sources in background
  useEffect(() => {
    let cancelled = false
    const pending = mirrors.filter((entry) => !cache[entryKey(entry)])
    if (!pending.length) return

    ;(async () => {
      await Promise.all(
        pending.map(async (entry) => {
          try {
            const data = await fetchDetailItem(entry.vod_id, entry.source)
            if (cancelled || !data) return
            setCache((prev) => {
              const key = entryKey(entry)
              if (prev[key]) return prev
              return { ...prev, [key]: data }
            })
          } catch {
            /* 单源失败忽略 */
          }
        }),
      )
    })()

    return () => {
      cancelled = true
    }
    // only re-run when mirrors list identity for missing keys changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mirrors])

  useEffect(() => {
    if (!item) return
    const tag = `${item.source}::${item.type_id}`
    if (relatedFor.current === tag) return
    relatedFor.current = tag
    let cancelled = false
    listVideos(item.type_id, 1, item.source)
      .then((rel) => {
        if (cancelled) return
        setRelated(
          rel.list.filter((v) => String(v.vod_id) !== String(item.vod_id)).slice(0, 12),
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [item])

  const lines = item?.playSources || []
  const currentLine = lines[lineIndex] || lines[0]
  const currentEp = currentLine?.episodes[episodeIndex] || currentLine?.episodes[0]

  useEffect(() => {
    const video = videoRef.current
    if (!video || !currentEp?.url) return

    setPlayError('')
    setMediaReady(false)
    hlsRef.current?.destroy()
    hlsRef.current = null

    const onReady = () => setMediaReady(true)
    video.addEventListener('playing', onReady)
    video.addEventListener('loadeddata', onReady)

    const playUrl = currentEp.url
    const isHls = playUrl.includes('.m3u8')

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false })
      hlsRef.current = hls
      hls.loadSource(playUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setPlayError('播放失败，请尝试切换线路或资源')
      })
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playUrl
    } else {
      video.src = playUrl
    }

    void video.play().catch(() => {})

    return () => {
      video.removeEventListener('playing', onReady)
      video.removeEventListener('loadeddata', onReady)
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
  }, [currentEp?.url, episodeIndex, lineIndex, activeKey])

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
  }, [activeKey, currentEp?.url])

  async function togglePip() {
    const video = videoRef.current
    if (!video || !supportsPip(video)) return

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

  const availableMirrors = useMemo(() => {
    return mirrors.map((entry) => ({
      ...entry,
      ready: !!cache[entryKey(entry)],
      active: entryKey(entry) === activeKey,
    }))
  }, [mirrors, cache, activeKey])

  function switchMirror(entry: MergedEntry) {
    if (entryKey(entry) === activeKey) return
    saveMergedEntries(mirrors)
    setSwitching(true)
    setLineIndex(0)
    setEpisodeIndex(0)
    navigate(`/video/play/${encodeURIComponent(entry.source)}/${entry.vod_id}`, {
      replace: true,
      state: { mirrors },
    })
  }

  function goBack() {
    const idx = (window.history.state as { idx?: number } | null)?.idx
    if (typeof idx === 'number' && idx > 0) navigate(-1)
    else navigate('/video')
  }

  if (loading && !display) {
    return (
      <Status>
        <button type="button" className="back" onClick={goBack}>
          ← 返回
        </button>
        加载中…
      </Status>
    )
  }
  if ((error || !display) && !switching) {
    return (
      <Status className="err">
        <button type="button" className="back" onClick={goBack}>
          ← 返回
        </button>
        {error || '未找到影片'}
      </Status>
    )
  }
  if (!display) {
    return (
      <Status>
        <button type="button" className="back" onClick={goBack}>
          ← 返回
        </button>
        切换资源中…
      </Status>
    )
  }

  const score = scoreOf(display)
  const actors = display.vod_actor
    .split(/[,，、/|]/)
    .map((s) => s.trim())
    .filter(Boolean)

  const displayLines = display.playSources || []
  const displayLine = item ? currentLine : displayLines[0]
  const displayEps = displayLine?.episodes || []

  return (
    <Page>
      <div className="container">
        <div className="main-row">
          <div className="player-wrap">
            <div className="player-inner">
              <video ref={videoRef} controls playsInline />
              {pipSupported && mediaReady ? (
                <button
                  type="button"
                  className={`pip-btn${inPip ? ' is-active' : ''}`}
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
                  <span>{inPip ? '退出画中画' : '画中画'}</span>
                </button>
              ) : null}
              {!mediaReady && !playError ? (
                <div className="placeholder">
                  <span className="brand">铭视频</span>
                  <span className="hint">为您加载中</span>
                </div>
              ) : null}
              {playError && <p className="play-err">{playError}</p>}
              {switching && !item && <p className="play-err">切换资源中…</p>}
            </div>
          </div>

          <aside className="side">
            <header className="meta">
              <button type="button" className="back" onClick={goBack}>
                ← 返回
              </button>
              <h1>{display.vod_name}</h1>
              <p>
                {[
                  display.source,
                  display.type_name,
                  display.vod_year,
                  display.vod_area,
                  score > 0 ? `豆瓣 ${score.toFixed(1)}` : '',
                  display.vod_remarks,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </header>

            {availableMirrors.length > 1 && (
              <section className="block">
                <h2>资源</h2>
                <div className="chips">
                  {availableMirrors.map((entry) => (
                    <button
                      key={entryKey(entry)}
                      type="button"
                      className={entry.active ? 'is-active' : ''}
                      title={entry.ready ? entry.source : `${entry.source}（加载中）`}
                      onClick={() => switchMirror(entry)}
                    >
                      {entry.source}
                      {!entry.ready && !entry.active ? '…' : ''}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {displayLines.length > 0 && (
              <section className="block">
                <h2>播放线路</h2>
                <div className="chips">
                  {displayLines.map((s, i) => (
                    <button
                      key={`${s.title}-${i}`}
                      type="button"
                      className={item && i === lineIndex ? 'is-active' : !item && i === 0 ? 'is-active' : ''}
                      onClick={() => {
                        if (!item) return
                        setLineIndex(i)
                        setEpisodeIndex(0)
                      }}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="block info">
              {display.vod_director && (
                <p>
                  <em>导演</em>
                  {display.vod_director}
                </p>
              )}
              {actors.length > 0 && (
                <p className="actors">
                  <em>演员</em>
                  {actors.map((name) => (
                    <Link key={name} to={`/video/search?q=${encodeURIComponent(name)}`}>
                      {name}
                    </Link>
                  ))}
                </p>
              )}
              {(display.vod_content || display.vod_blurb) && (
                <p className="blurb">
                  <em>简介</em>
                  {stripHtml(display.vod_content || display.vod_blurb)}
                </p>
              )}
            </section>
          </aside>
        </div>

        {displayEps.length > 0 && (
          <section className="block">
            <h2>分集</h2>
            <div className="eps">
              {displayEps.map((ep, i) => (
                <button
                  key={`${ep.title}-${i}`}
                  type="button"
                  className={item && i === episodeIndex ? 'is-active' : !item && i === 0 ? 'is-active' : ''}
                  onClick={() => {
                    if (!item) return
                    setEpisodeIndex(i)
                  }}
                >
                  {ep.title}
                </button>
              ))}
            </div>
          </section>
        )}

        {related.length > 0 && (
          <section className="block">
            <h2>猜你喜欢</h2>
            <div className="grid">
              {related.map((v) => (
                <VodCard key={`${v.source}-${v.vod_id}`} item={v} />
              ))}
            </div>
          </section>
        )}
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

    .pip-btn {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 4;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 36px;
      padding: 0 12px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 10px;
      background: rgba(0, 0, 0, 0.55);
      color: #fff;
      font-size: 13px;
      letter-spacing: 0.02em;
      cursor: pointer;
      backdrop-filter: blur(8px);
      transition: background 0.2s, border-color 0.2s, color 0.2s;

      &:hover {
        background: rgba(0, 0, 0, 0.72);
        border-color: rgba(232, 165, 75, 0.55);
        color: #e8a54b;
      }

      &.is-active {
        border-color: rgba(232, 165, 75, 0.7);
        color: #e8a54b;
      }
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
        font-family: ui-serif, "Songti SC", "STSong", "SimSun", serif;
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
      margin: 0 0 12px;
      padding: 0;
      border: 0;
      background: transparent;
      color: rgba(245, 242, 234, 0.55);
      font-size: 13px;
      letter-spacing: 0.02em;
      cursor: pointer;
      transition: color 0.2s;

      &:hover {
        color: #e8a54b;
      }
    }

    h1 {
      margin: 0;
      font-family: ui-serif, "Songti SC", "STSong", "SimSun", serif;
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

  .chips,
  .eps {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    button {
      min-width: 72px;
      height: 36px;
      padding: 0 12px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.04);
      color: rgba(245, 242, 234, 0.8);
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
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

  .eps button {
    min-width: 88px;
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

    .actors a {
      display: inline-block;
      margin: 0 10px 6px 0;
      color: #e8a54b;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
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

  .grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 16px 12px;
  }

  @media (max-width: 1100px) {
    .main-row {
      grid-template-columns: minmax(0, 1fr) minmax(220px, 280px);
      gap: 18px;
    }

    .grid {
      grid-template-columns: repeat(4, 1fr);
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

    .player-inner .pip-btn span {
      display: none;
    }

    .player-inner .pip-btn {
      width: 36px;
      padding: 0;
      justify-content: center;
    }

    .grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 480px) {
    .grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
`

const Status = styled.div`
  width: 90%;
  margin: 48px auto;
  color: rgba(245, 242, 234, 0.55);
  font-size: 14px;

  .back {
    display: block;
    margin: 0 0 16px;
    padding: 0;
    border: 0;
    background: transparent;
    color: rgba(245, 242, 234, 0.55);
    font-size: 13px;
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: #e8a54b;
    }
  }

  &.err {
    color: #e07070;
  }
`
