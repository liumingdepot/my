import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import styled from 'styled-components'
import { api, fmtT, prefetch, streamUrl, type MacEpisode, type MacMeta } from '../utils/server'
import { hist } from '../utils/history'
import { PINK } from '../utils/theme'
import { Empty, Loading } from './shared'

const SPEEDS = [2, 1.5, 1.25, 1, 0.75]
const ICON_PLAY =
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13c0 .8.9 1.3 1.6.9l10.2-6.5c.6-.4.6-1.4 0-1.8L9.6 4.6c-.7-.4-1.6.1-1.6.9z"/></svg>'
const ICON_PAUSE =
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>'

const PlayPage = () => {
  const { sid = '', ep: epParam = '1' } = useParams()
  const nav = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [meta, setMeta] = useState<MacMeta | null>(null)
  const [episodes, setEpisodes] = useState<MacEpisode[]>([])
  const [ep, setEp] = useState(Math.max(1, parseInt(epParam, 10) || 1))
  const [loading, setLoading] = useState(true)
  const [vload, setVload] = useState(true)
  const [vtip, setVtip] = useState('')
  const [err, setErr] = useState('')
  const [playing, setPlaying] = useState(false)
  const [auto, setAuto] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [showSpeed, setShowSpeed] = useState(false)
  const [progress, setProgress] = useState(0)
  const [timeLabel, setTimeLabel] = useState('0:00 / 0:00')
  const [hideCtrl, setHideCtrl] = useState(false)
  const [fs, setFs] = useState(false)
  const pfRef = useRef(0)
  const saveTRef = useRef(0)
  const hideTRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr('')
    api
      .episodes(sid)
      .then((d) => {
        if (cancelled) return
        setMeta(d.meta)
        setEpisodes(d.episodes || [])
        const n = Math.min(Math.max(1, parseInt(epParam, 10) || 1), d.episodes.length || 1)
        setEp(n)
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sid, epParam])

  const save = useCallback(
    (finished = false) => {
      const v = videoRef.current
      if (!v || !sid || !meta) return
      const dur = v.duration || 0
      const pos = v.currentTime || 0
      if (!dur) return
      hist.put({
        sid,
        title: meta.title || '',
        cover: meta.cover || '',
        ep,
        epCnt: episodes.length,
        pos: finished ? 0 : pos,
        dur,
      })
    },
    [sid, meta, ep, episodes.length],
  )

  useEffect(() => {
    if (!episodes.length) return
    const v = videoRef.current
    if (!v) return
    setVload(true)
    setVtip(`正在加载 第${ep}集 · 首次播放约需几秒`)
    pfRef.current = 0
    v.src = streamUrl(sid, ep)
    v.load()
    document.title = `${meta?.title || '测试短剧'} 第${ep}集`
  }, [sid, ep, episodes.length, meta?.title])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    const onPlay = () => setPlaying(true)
    const onPause = () => {
      setPlaying(false)
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
      v.play().catch(() => setVtip('点击画面开始播放'))
    }
    const onTime = () => {
      if (!v.duration) return
      setProgress((v.currentTime / v.duration) * 100)
      setTimeLabel(`${fmtT(v.currentTime)} / ${fmtT(v.duration)}`)
      if (!saveTRef.current || Date.now() - saveTRef.current > 3000) {
        saveTRef.current = Date.now()
        save()
      }
      const n = ep + 1
      if (n <= episodes.length && pfRef.current !== n) {
        const remain = v.duration ? (v.duration - v.currentTime) / (v.playbackRate || 1) : 1e9
        if (remain <= 60) {
          pfRef.current = n
          void prefetch(sid, n)
        }
      }
    }
    const onEnded = () => {
      save(true)
      if (auto && ep < episodes.length) setEp(ep + 1)
    }
    const onError = () => {
      setVload(true)
      setVtip('本集加载失败，点右侧重试或换一集')
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
  }, [sid, ep, episodes.length, auto, speed, save])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      const v = videoRef.current
      if (!v) return
      if (e.code === 'Space') {
        e.preventDefault()
        v.paused ? void v.play() : v.pause()
      } else if (e.key === 'ArrowRight') v.currentTime += 5
      else if (e.key === 'ArrowLeft') v.currentTime -= 5
      else if (e.key === 'Escape' && fs) setFs(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [fs])

  useEffect(() => () => save(), [save])

  if (loading) return <Loading />
  if (err) return <Empty>{err}</Empty>

  const cur = episodes[ep - 1] || episodes[0]
  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    v.paused ? void v.play() : v.pause()
  }

  const seek = (clientX: number, bar: HTMLElement) => {
    const v = videoRef.current
    if (!v?.duration) return
    const r = bar.getBoundingClientRect()
    const x = clientX - r.left
    v.currentTime = Math.max(0, Math.min(1, x / r.width)) * v.duration
  }

  return (
    <Style className={fs ? 'fs-root' : ''}>
      <div className="watch">
        <div
          className={`stage ${hideCtrl ? 'hidecursor' : ''} ${fs ? 'fs' : ''}`}
          onMouseMove={() => {
            setHideCtrl(false)
            window.clearTimeout(hideTRef.current)
            hideTRef.current = window.setTimeout(() => {
              if (videoRef.current && !videoRef.current.paused) setHideCtrl(true)
            }, 2600)
          }}
        >
          <video
            ref={videoRef}
            playsInline
            onClick={togglePlay}
            onDoubleClick={() => {
              const st = document.getElementById('test-stage')
              if (document.fullscreenElement) {
                void document.exitFullscreen()
                return
              }
              if (st?.requestFullscreen) {
                void st.requestFullscreen().catch(() => setFs((f) => !f))
              } else setFs((f) => !f)
            }}
            id="test-stage"
          />
          <div className="wtop">
            <button type="button" className="back" onClick={() => nav(`/test/detail/${sid}`)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <div className="wt">
              {(cur?.title || `第${ep}集`).length > 40
                ? (cur?.title || '').slice(0, 40) + '…'
                : cur?.title || `第${ep}集`}
            </div>
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
              onPointerDown={(e) => {
                const bar = e.currentTarget
                bar.setPointerCapture(e.pointerId)
                seek(e.clientX, bar)
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
                type="button"
                className="cbtn"
                dangerouslySetInnerHTML={{ __html: playing ? ICON_PAUSE : ICON_PLAY }}
                onClick={togglePlay}
              />
              <button type="button" className="cbtn" title="上一集" onClick={() => ep > 1 && setEp(ep - 1)}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 6h2v12H7zm3.5 6l8.5-6v12z" />
                </svg>
              </button>
              <button
                type="button"
                className="cbtn"
                title="下一集"
                onClick={() => ep < episodes.length && setEp(ep + 1)}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15 6h2v12h-2zM5 6l8.5 6L5 18z" />
                </svg>
              </button>
              <span className="tm">{timeLabel}</span>
              <div className="cspace" />
              <div style={{ position: 'relative' }}>
                <button type="button" className="spd" onClick={() => setShowSpeed((s) => !s)}>
                  {speed === 1 ? '倍速' : `${speed}x`}
                </button>
                {showSpeed ? (
                  <div className="speedmenu show">
                    {SPEEDS.map((s) => (
                      <div
                        key={s}
                        className={s === speed ? 'on' : ''}
                        onClick={() => {
                          setSpeed(s)
                          if (videoRef.current) videoRef.current.playbackRate = s
                          setShowSpeed(false)
                        }}
                      >
                        {s}x
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className={`autoc ${auto ? 'on' : ''}`}
                onClick={() => setAuto((a) => !a)}
              >
                自动连播
              </button>
              <button
                type="button"
                className="cbtn"
                title="全屏"
                onClick={() => {
                  const st = videoRef.current?.parentElement
                  if (document.fullscreenElement) {
                    void document.exitFullscreen()
                    return
                  }
                  if (st?.requestFullscreen) {
                    void st.requestFullscreen().catch(() => setFs((f) => !f))
                  } else setFs((f) => !f)
                }}
              >
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
                className={`ditem ${e.index === ep ? 'cur' : ''}`}
                onClick={() => setEp(e.index)}
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

export default PlayPage

const Style = styled.div`
  margin: -18px -26px -70px;
  &.fs-root {
    position: fixed;
    inset: 0;
    z-index: 300;
    margin: 0;
  }
  .watch {
    display: flex;
    gap: 0;
    height: calc(100vh - 60px);
    background: #000;
  }
  .stage {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
  }
  .stage video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #000;
  }
  .stage.fs {
    position: fixed;
    inset: 0;
    z-index: 300;
    flex: none;
  }
  .vload {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
    align-items: center;
    justify-content: center;
    color: #fff;
    background: rgba(0, 0, 0, 0.5);
    z-index: 6;
  }
  .vload .spin {
    width: 22px;
    height: 22px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: ${PINK};
    border-radius: 50%;
    animation: test-rot 0.8s linear infinite;
  }
  @keyframes test-rot {
    to {
      transform: rotate(360deg);
    }
  }
  .vload .tip {
    font-size: 13px;
    color: #d8dae0;
  }
  .ctrl {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 7;
    padding: 30px 18px 12px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.72));
    transition: opacity 0.2s;
  }
  .stage.hidecursor .ctrl,
  .stage.hidecursor .wtop {
    opacity: 0;
  }
  .pbar {
    height: 4px;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 2px;
    cursor: pointer;
    position: relative;
  }
  .pbar:hover {
    height: 6px;
  }
  .pbar .cur {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: var(--pink);
    border-radius: 2px;
  }
  .pbar .dot {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    transform: translate(-50%, -50%);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  }
  .crow2 {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 10px;
    color: #fff;
  }
  .cbtn {
    background: none;
    border: 0;
    color: #fff;
    cursor: pointer;
    display: grid;
    place-items: center;
    padding: 4px;
    border-radius: 6px;
  }
  .cbtn:hover {
    background: rgba(255, 255, 255, 0.14);
  }
  .cbtn svg {
    width: 21px;
    height: 21px;
  }
  .tm {
    font-size: 12px;
    color: #d8dae0;
    font-variant-numeric: tabular-nums;
  }
  .cspace {
    flex: 1;
  }
  .spd,
  .autoc {
    font-size: 12.5px;
    color: #fff;
    background: rgba(255, 255, 255, 0.14);
    border: 0;
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
  }
  .autoc.on {
    background: var(--pink);
  }
  .speedmenu {
    position: absolute;
    right: 0;
    bottom: 40px;
    background: rgba(20, 20, 24, 0.92);
    border-radius: 10px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    z-index: 9;
  }
  .speedmenu div {
    color: #fff;
    font-size: 13px;
    padding: 7px 22px;
    border-radius: 7px;
    cursor: pointer;
    text-align: center;
  }
  .speedmenu div:hover {
    background: rgba(255, 255, 255, 0.12);
  }
  .speedmenu div.on {
    color: var(--pink);
    font-weight: 700;
  }
  .epdrawer {
    width: 292px;
    flex: none;
    background: #fff;
    display: flex;
    flex-direction: column;
    border-left: 1px solid #eee;
  }
  .epdrawer .dh {
    padding: 14px 16px 10px;
    font-size: 14px;
    font-weight: 700;
    border-bottom: 1px solid #f2f3f5;
  }
  .epdrawer .dlist {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }
  .ditem {
    display: flex;
    gap: 8px;
    padding: 8px;
    border-radius: 9px;
    cursor: pointer;
    align-items: center;
  }
  .ditem:hover {
    background: #f6f7f9;
  }
  .ditem.cur {
    background: var(--pink-soft);
  }
  .ditem .no {
    width: 20px;
    text-align: center;
    color: #9298a5;
    font-size: 12px;
    flex: none;
  }
  .ditem.cur .no {
    color: var(--pink);
    font-weight: 700;
  }
  .ditem .dt {
    flex: 1;
    font-size: 12.5px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .wtop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 7;
    padding: 14px 16px;
    background: linear-gradient(rgba(0, 0, 0, 0.6), transparent);
    color: #fff;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: opacity 0.2s;
  }
  .wtop .back {
    background: none;
    border: 0;
    color: #fff;
    cursor: pointer;
    display: grid;
    place-items: center;
  }
  .wtop .wt {
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-width: 900px) {
    .epdrawer {
      display: none;
    }
  }
`
