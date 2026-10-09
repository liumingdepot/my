import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import styled from 'styled-components'
import {
  fetchEpisodes,
  prefetch,
  streamUrl,
  type MacEpisode,
  type MacMeta,
} from '../utils/server'
import { fmtT } from '../utils/format'
import { hist } from '../utils/storage'
import { Empty, Loading } from './ui'

const SPEEDS = [2, 1.5, 1.25, 1, 0.75]
const ICON_PLAY =
  'M8 5.5v13c0 .8.9 1.3 1.6.9l10.2-6.5c.6-.4.6-1.4 0-1.8L9.6 4.6c-.7-.4-1.6.1-1.6.9z'
const ICON_PAUSE = 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z'

export default function WatchPage() {
  const { sid = '', ep: epParam = '1' } = useParams()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const saveTimer = useRef(0)
  const pfRef = useRef(0)
  const [meta, setMeta] = useState<MacMeta | null>(null)
  const [episodes, setEpisodes] = useState<MacEpisode[]>([])
  const [ep, setEp] = useState(Math.max(1, Number(epParam) || 1))
  const [loading, setLoading] = useState(true)
  const [vload, setVload] = useState(true)
  const [vtip, setVtip] = useState('')
  const [err, setErr] = useState('')
  const [paused, setPaused] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [auto, setAuto] = useState(true)
  const [speedOpen, setSpeedOpen] = useState(false)
  const [fs, setFs] = useState(false)
  const [progress, setProgress] = useState(0)
  const [timeText, setTimeText] = useState('0:00 / 0:00')

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    fetchEpisodes(sid, ac.signal)
      .then((d) => {
        setMeta(d.meta)
        setEpisodes(d.episodes || [])
        const n = Math.min(Math.max(1, Number(epParam) || 1), d.episodes.length || 1)
        setEp(n)
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setErr(e.message || '加载失败')
      })
      .finally(() => setLoading(false))
    return () => ac.abort()
  }, [sid, epParam])

  const cur = episodes[ep - 1]
  const title = meta?.title || ''

  const save = useCallback(
    (finished = false) => {
      const v = videoRef.current
      if (!v || !sid || !v.duration) return
      hist.put({
        sid,
        title,
        cover: meta?.cover || '',
        ep,
        epCnt: episodes.length,
        pos: finished ? 0 : v.currentTime || 0,
        dur: v.duration || 0,
      })
    },
    [sid, title, meta?.cover, ep, episodes.length],
  )

  const loadEp = useCallback(
    (n: number) => {
      const max = episodes.length || 1
      const next = Math.min(Math.max(1, n), max)
      setEp(next)
      navigate(`/test/watch/${sid}/${next}`, { replace: true })
      setVload(true)
      setVtip(`正在加载 第${next}集 · 请稍候`)
      pfRef.current = 0
      const v = videoRef.current
      if (v) {
        v.src = streamUrl(sid, next)
        v.load()
      }
    },
    [episodes.length, navigate, sid],
  )

  useEffect(() => {
    if (!episodes.length) return
    const v = videoRef.current
    if (!v) return
    setVload(true)
    setVtip(`正在加载 第${ep}集 · 请稍候`)
    v.src = streamUrl(sid, ep)
    v.load()
  }, [episodes.length, sid, ep])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    const onPlay = () => setPaused(false)
    const onPause = () => {
      setPaused(true)
      save()
    }
    const onWaiting = () => setVload(true)
    const onPlaying = () => setVload(false)
    const onMeta = () => {
      v.playbackRate = speed
      const rec = hist.get(sid)
      if (rec && rec.ep === ep && rec.pos > 8 && rec.pos < v.duration - 12) {
        v.currentTime = rec.pos
      }
      v.play().catch(() => {})
    }
    const onTime = () => {
      if (!v.duration) return
      setProgress((v.currentTime / v.duration) * 100)
      setTimeText(`${fmtT(v.currentTime)} / ${fmtT(v.duration)}`)
      if (!saveTimer.current || Date.now() - saveTimer.current > 3000) {
        saveTimer.current = Date.now()
        save()
      }
      const n = ep + 1
      if (n <= episodes.length && pfRef.current !== n) {
        const remain = v.duration ? (v.duration - v.currentTime) / (v.playbackRate || 1) : 1e9
        if (remain <= 60) {
          pfRef.current = n
          prefetch(sid, n)
        }
      }
    }
    const onEnded = () => {
      save(true)
      if (auto && ep < episodes.length) loadEp(ep + 1)
    }
    const onError = () => {
      setVload(true)
      setVtip('本集加载失败，请换一集或稍后重试')
    }

    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('waiting', onWaiting)
    v.addEventListener('playing', onPlaying)
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('ended', onEnded)
    v.addEventListener('error', onError)
    return () => {
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('waiting', onWaiting)
      v.removeEventListener('playing', onPlaying)
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('ended', onEnded)
      v.removeEventListener('error', onError)
    }
  }, [auto, ep, episodes.length, loadEp, save, sid, speed])

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.target as HTMLElement)?.tagName === 'INPUT') return
      const v = videoRef.current
      if (!v) return
      if (ev.code === 'Space') {
        ev.preventDefault()
        v.paused ? v.play() : v.pause()
      } else if (ev.key === 'ArrowRight') v.currentTime += 5
      else if (ev.key === 'ArrowLeft') v.currentTime -= 5
      else if (ev.key === 'Escape' && fs) setFs(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [fs])

  useEffect(() => () => save(), [save])

  if (loading) return <Loading />
  if (err) return <Empty>{err}</Empty>

  const seek = (clientX: number, bar: HTMLElement) => {
    const v = videoRef.current
    if (!v?.duration) return
    const r = bar.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    v.currentTime = x * v.duration
  }

  return (
    <Style data-fs={fs ? '1' : '0'}>
      <div className="watch">
        <div className={`stage${fs ? ' fs' : ''}`} id="stage">
          <video ref={videoRef} playsInline onDoubleClick={() => setFs((x) => !x)} />
          <div className="wtop">
            <button className="back" onClick={() => navigate(`/test/detail/${sid}`)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <div className="wt">{cur?.title || `第${ep}集`}</div>
          </div>
          {vload ? (
            <div className="vload">
              <div className="spin" />
              <div className="tip">{vtip}</div>
            </div>
          ) : null}
          <div className="ctrl">
            <div
              className="pbar"
              onPointerDown={(ev) => {
                const bar = ev.currentTarget
                bar.setPointerCapture(ev.pointerId)
                seek(ev.clientX, bar)
                const mv = (e2: PointerEvent) => seek(e2.clientX, bar)
                const up = () => {
                  bar.removeEventListener('pointermove', mv)
                  bar.removeEventListener('pointerup', up)
                }
                bar.addEventListener('pointermove', mv)
                bar.addEventListener('pointerup', up)
              }}
            >
              <div className="cur" style={{ width: `${progress}%` }} />
              <div className="dot" style={{ left: `${progress}%` }} />
            </div>
            <div className="crow2">
              <button
                className="cbtn"
                onClick={() => {
                  const v = videoRef.current
                  if (!v) return
                  v.paused ? v.play() : v.pause()
                }}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d={paused ? ICON_PLAY : ICON_PAUSE} />
                </svg>
              </button>
              <button className="cbtn" onClick={() => ep > 1 && loadEp(ep - 1)} title="上一集">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 6h2v12H7zm3.5 6l8.5-6v12z" />
                </svg>
              </button>
              <button className="cbtn" onClick={() => ep < episodes.length && loadEp(ep + 1)} title="下一集">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15 6h2v12h-2zM5 6l8.5 6L5 18z" />
                </svg>
              </button>
              <span className="tm">{timeText}</span>
              <div className="cspace" />
              <div style={{ position: 'relative' }}>
                <button className="spd" onClick={() => setSpeedOpen((x) => !x)}>
                  {speed === 1 ? '倍速' : `${speed}x`}
                </button>
                {speedOpen ? (
                  <div className="speedmenu">
                    {SPEEDS.map((s) => (
                      <div
                        key={s}
                        className={s === speed ? 'on' : ''}
                        onClick={() => {
                          setSpeed(s)
                          if (videoRef.current) videoRef.current.playbackRate = s
                          setSpeedOpen(false)
                        }}
                      >
                        {s}x
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <button className={`autoc${auto ? ' on' : ''}`} onClick={() => setAuto((x) => !x)}>
                自动连播
              </button>
              <button className="cbtn" onClick={() => setFs((x) => !x)} title="全屏">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div className="epdrawer">
          <div className="dh">选集（{episodes.length}）</div>
          <div className="dlist">
            {episodes.map((e) => (
              <div
                key={e.index}
                className={`ditem${e.index === ep ? ' cur' : ''}`}
                onClick={() => loadEp(e.index)}
              >
                <span className="no">{e.index}</span>
                <span className="dt">{e.title || ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Style>
  )
}

const Style = styled.div`
  --pink: #ff2e5f;
  margin: -18px -26px -70px;
  background: #0c0d10;
  min-height: calc(100vh - 0px);
  color: #fff;

  .watch {
    display: grid;
    grid-template-columns: 1fr 280px;
    min-height: 100vh;
  }
  .stage {
    position: relative;
    background: #000;
    display: flex;
    flex-direction: column;
  }
  .stage.fs {
    position: fixed;
    inset: 0;
    z-index: 100;
  }
  video {
    width: 100%;
    flex: 1;
    max-height: calc(100vh - 0px);
    background: #000;
    outline: none;
  }
  .wtop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    background: linear-gradient(rgba(0, 0, 0, 0.55), transparent);
    z-index: 5;
  }
  .back {
    border: 0;
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .wt {
    font-size: 15px;
    font-weight: 600;
  }
  .vload {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: rgba(0, 0, 0, 0.35);
    z-index: 4;
  }
  .spin {
    width: 28px;
    height: 28px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: var(--pink);
    border-radius: 50%;
    animation: rot 0.8s linear infinite;
  }
  @keyframes rot {
    to {
      transform: rotate(360deg);
    }
  }
  .tip {
    font-size: 13px;
    color: #ddd;
  }
  .ctrl {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 10px 16px 14px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.72));
    z-index: 5;
  }
  .pbar {
    position: relative;
    height: 4px;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 2px;
    cursor: pointer;
    margin-bottom: 10px;
  }
  .pbar .cur {
    height: 100%;
    background: var(--pink);
    border-radius: 2px;
  }
  .pbar .dot {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    margin: -6px 0 0 -6px;
    border-radius: 50%;
    background: #fff;
  }
  .crow2 {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .cbtn {
    border: 0;
    background: transparent;
    color: #fff;
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .cbtn svg {
    width: 20px;
    height: 20px;
  }
  .tm {
    font-size: 12px;
    color: #ccc;
    min-width: 90px;
  }
  .cspace {
    flex: 1;
  }
  .spd,
  .autoc {
    border: 1px solid rgba(255, 255, 255, 0.25);
    background: transparent;
    color: #fff;
    border-radius: 8px;
    padding: 5px 10px;
    font-size: 12px;
    cursor: pointer;
  }
  .autoc.on {
    border-color: var(--pink);
    color: var(--pink);
  }
  .speedmenu {
    position: absolute;
    bottom: 36px;
    right: 0;
    background: rgba(20, 22, 28, 0.96);
    border-radius: 10px;
    padding: 6px 0;
    min-width: 80px;
    z-index: 8;
  }
  .speedmenu div {
    padding: 8px 14px;
    cursor: pointer;
    font-size: 13px;
  }
  .speedmenu div.on,
  .speedmenu div:hover {
    color: var(--pink);
  }
  .epdrawer {
    background: #15171c;
    border-left: 1px solid #22252c;
    display: flex;
    flex-direction: column;
    max-height: 100vh;
  }
  .dh {
    padding: 16px 18px;
    font-weight: 700;
    border-bottom: 1px solid #22252c;
  }
  .dlist {
    flex: 1;
    overflow: auto;
    padding: 8px;
  }
  .ditem {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 10px 12px;
    border-radius: 8px;
    cursor: pointer;
    color: #c5c8d0;
  }
  .ditem:hover,
  .ditem.cur {
    background: rgba(255, 46, 95, 0.12);
    color: #fff;
  }
  .ditem.cur .no {
    color: var(--pink);
  }
  .no {
    width: 28px;
    font-weight: 700;
    flex: none;
  }
  .dt {
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 900px) {
    .watch {
      grid-template-columns: 1fr;
    }
    .epdrawer {
      max-height: 280px;
      border-left: 0;
      border-top: 1px solid #22252c;
    }
  }
`
