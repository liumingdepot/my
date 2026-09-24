import Hls from 'hls.js'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import styled from 'styled-components'
import { fetchDramaDetail, type DramaDetail, type DramaEpisode } from '../utils/server'

function sortEpisodes(list: DramaEpisode[]) {
  return [...list].sort((a, b) => Number(a.sort) - Number(b.sort))
}

function pickUrl(ep: DramaEpisode) {
  return ep.video_url || ep.video_h265_url || ''
}

export default function DetailPage() {
  const { id = '' } = useParams()
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)

  const [detail, setDetail] = useState<DramaDetail | null>(null)
  const [episodes, setEpisodes] = useState<DramaEpisode[]>([])
  const [epIndex, setEpIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [playError, setPlayError] = useState('')

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

  const current = episodes[epIndex]
  const playUrl = current ? pickUrl(current) : ''

  useEffect(() => {
    const video = videoRef.current
    if (!video || !playUrl) return

    setPlayError('')
    hlsRef.current?.destroy()
    hlsRef.current = null

    const isHls = playUrl.includes('.m3u8')
    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false })
      hlsRef.current = hls
      hls.loadSource(playUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setPlayError('播放失败，可换一集试试')
      })
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playUrl
    } else {
      video.src = playUrl
    }

    void video.play().catch(() => {})

    return () => {
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
  }, [playUrl, epIndex])

  if (loading) return <Style><p className="status">加载中…</p></Style>
  if (error) {
    return (
      <Style>
        <p className="status err">{error}</p>
        <Link className="back-link" to="/test">
          返回搜索
        </Link>
      </Style>
    )
  }
  if (!detail) return null

  return (
    <Style>
      <Link className="back-link" to="/test">
        ← 返回搜索
      </Link>

      <section className="head">
        <img className="cover" src={detail.image_link} alt="" />
        <div className="info">
          <h1>{detail.title}</h1>
          <p className="meta">
            {detail.tags || '—'}
            {detail.total_episode_num ? ` · ${detail.total_episode_num} 集` : ''}
            {detail.is_over === '1' ? ' · 已完结' : ''}
          </p>
          {detail.intro ? <p className="intro">{detail.intro}</p> : null}
        </div>
      </section>

      <section className="player">
        <video ref={videoRef} controls playsInline />
        {playError ? <p className="status err">{playError}</p> : null}
        {current ? (
          <p className="now">
            正在播放第 {current.sort} 集
            {current.duration ? ` · ${current.duration}s` : ''}
          </p>
        ) : (
          <p className="status">暂无分集</p>
        )}
      </section>

      <section className="eps">
        <h2>分集列表（{episodes.length}）</h2>
        <div className="grid">
          {episodes.map((ep, i) => (
            <button
              key={ep.video_id || `${ep.sort}-${i}`}
              type="button"
              className={i === epIndex ? 'on' : ''}
              onClick={() => setEpIndex(i)}
            >
              {ep.sort}
            </button>
          ))}
        </div>
      </section>
    </Style>
  )
}

const Style = styled.div`
  .back-link {
    display: inline-block;
    margin-bottom: 16px;
    color: var(--muted);
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;

    &:hover {
      color: var(--accent);
    }
  }

  .head {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 16px;
    margin-bottom: 20px;

    @media (max-width: 560px) {
      grid-template-columns: 88px 1fr;
    }
  }

  .cover {
    width: 100%;
    aspect-ratio: 3 / 4;
    object-fit: cover;
    border-radius: 10px;
    background: var(--bg-elev);
  }

  .info {
    min-width: 0;

    h1 {
      margin: 0 0 8px;
      font-size: 20px;
      font-weight: 750;
      line-height: 1.3;
    }
  }

  .meta {
    margin: 0 0 10px;
    color: var(--muted);
    font-size: 13px;
  }

  .intro {
    margin: 0;
    color: color-mix(in srgb, var(--text) 82%, var(--muted));
    font-size: 13px;
    line-height: 1.6;
    display: -webkit-box;
    -webkit-line-clamp: 5;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .player {
    margin-bottom: 22px;

    video {
      display: block;
      width: 100%;
      max-height: 70vh;
      background: #000;
      border-radius: 12px;
      border: 1px solid var(--line);
      aspect-ratio: 9 / 16;
      object-fit: contain;
    }
  }

  .now {
    margin: 10px 0 0;
    font-size: 13px;
    color: var(--muted);
  }

  .status {
    margin: 12px 0;
    color: var(--muted);
    font-size: 13px;

    &.err {
      color: #f07178;
    }
  }

  .eps {
    h2 {
      margin: 0 0 12px;
      font-size: 15px;
      font-weight: 700;
    }
  }

  .grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    button {
      min-width: 44px;
      min-height: 36px;
      padding: 0 10px;
      border-radius: 8px;
      border: 1px solid var(--line);
      background: var(--bg-elev);
      color: var(--text);
      font: inherit;
      font-size: 13px;
      cursor: pointer;

      &.on {
        color: #041016;
        background: var(--accent);
        border-color: transparent;
        font-weight: 700;
      }
    }
  }
`
