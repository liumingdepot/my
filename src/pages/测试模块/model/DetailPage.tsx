import Hls from 'hls.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import styled from 'styled-components'
import {
  fetchDramaDetail,
  resolvePlayback,
  sortEpisodes,
  type DramaDetail,
  type DramaEpisode,
  type PlaybackPlan,
} from '../utils/server'

export default function DetailPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const source = params.get('source') || 'hongguo'
  const dramaId = decodeURIComponent(id)

  const [detail, setDetail] = useState<DramaDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [plan, setPlan] = useState<PlaybackPlan | null>(null)
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState('')

  const episodes = useMemo(
    () => (detail ? sortEpisodes(detail.play_list || []) : []),
    [detail],
  )

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
      setPlan(null)
      try {
        const data = await fetchDramaDetail(source, dramaId, ac.signal)
        if (cancelled) return
        setDetail(data)
        const sorted = sortEpisodes(data.play_list || [])
        if (sorted[0]) {
          setActiveIdx(0)
          setResolving(true)
          try {
            const next = await resolvePlayback(source, data, sorted[0], ac.signal)
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
  }, [dramaId, source])

  async function playEpisode(ep: DramaEpisode, index: number) {
    if (!detail) return
    setResolveError('')
    setActiveIdx(index)
    setResolving(true)
    setPlan(null)
    try {
      const next = await resolvePlayback(source, detail, ep)
      setPlan(next)
    } catch (e) {
      setResolveError(e instanceof Error ? e.message : '取流失败')
    } finally {
      setResolving(false)
    }
  }

  const sourceLabel = source === 'huangju' ? '剧果' : source === 'hongguo' ? '红果' : source

  if (loading) {
    return (
      <Style>
        <p className="status">加载详情…</p>
      </Style>
    )
  }

  if (error || !detail) {
    return (
      <Style>
        <p className="status err">{error || '未找到短剧'}</p>
        <Link className="back" to={`/test?source=${encodeURIComponent(source)}`}>
          ← 返回流程首页
        </Link>
      </Style>
    )
  }

  return (
    <Style>
      <Link className="back" to={`/test?source=${encodeURIComponent(source)}`}>
        ← 返回流程首页
      </Link>

      <section className="hero">
        <div className="cover">
          {detail.image_link ? (
            <img src={detail.image_link} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span>无封面</span>
          )}
        </div>
        <div className="info">
          <p className="source">站源 · {sourceLabel}</p>
          <h1>{detail.title}</h1>
          <p className="meta">
            {detail.total_episode_num ? `共 ${detail.total_episode_num} 集` : ''}
            {detail.is_over === '1' || detail.release_status === 'completed'
              ? ' · 已完结'
              : detail.is_over === '0' || detail.release_status === 'ongoing'
                ? ' · 连载中'
                : ''}
            {detail.tags ? ` · ${detail.tags}` : ''}
          </p>
          {detail.intro ? <p className="intro">{detail.intro}</p> : null}
          <ol className="flow-mini">
            <li className="done">站源</li>
            <li className="done">搜索</li>
            <li className="on">详情</li>
            <li className={plan ? 'on' : ''}>播放</li>
          </ol>
        </div>
      </section>

      <section className="player-block">
        <h2>播放</h2>
        {resolving ? <p className="status">正在取流…</p> : null}
        {resolveError ? <p className="err">{resolveError}</p> : null}
        {plan ? (
          <>
            <Player plan={plan} />
            <p className="plan">
              取流成功
              {plan.proxy ? ' · 本机代理（防盗链）' : ' · 直链'}
              {plan.mediaType ? ` · ${plan.mediaType.toUpperCase()}` : ''}
              {plan.quality ? ` · ${plan.quality}` : ''}
              {' · '}第 {plan.episode.sort || activeIdx + 1} 集
            </p>
          </>
        ) : !resolving ? (
          <p className="status">选择分集后解析播放地址</p>
        ) : null}
      </section>

      <section className="episodes">
        <h2>分集（{episodes.length}）</h2>
        <div className="list">
          {episodes.map((ep, index) => (
            <button
              key={ep.video_id || `${ep.sort}-${index}`}
              type="button"
              className={index === activeIdx ? 'active' : ''}
              disabled={ep.playable === false || resolving}
              onClick={() => void playEpisode(ep, index)}
            >
              第 {ep.sort || index + 1} 集
              {ep.duration ? <span>{ep.duration}</span> : null}
            </button>
          ))}
        </div>
        {!episodes.length ? <p className="status">暂无分集</p> : null}
      </section>
    </Style>
  )
}

function Player({ plan }: { plan: PlaybackPlan }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [playError, setPlayError] = useState('')

  useEffect(() => {
    const video = videoRef.current
    if (!video || !plan.url) return

    setPlayError('')
    hlsRef.current?.destroy()
    hlsRef.current = null

    const isHls =
      plan.mediaType === 'hls' ||
      plan.originUrl?.includes('.m3u8') === true ||
      (plan.url.includes('.m3u8') && !plan.proxy)

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        maxBufferLength: 30,
        // 代理地址同源，xhr 走本机 /api/test/stream
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
      // MP4 / 代理直链：video 请求同源代理，由服务端带 Referer 拉 CDN
      video.src = plan.url
      void video.play().catch(() => {
        setPlayError('播放失败，可换一集重试')
      })
    }

    return () => {
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
  }, [plan.url])

  return (
    <div className="player">
      <video
        ref={videoRef}
        controls
        playsInline
        poster={plan.episode.first_img || undefined}
      />
      {playError ? <p className="err">{playError}</p> : null}
    </div>
  )
}

const Style = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;

  .back {
    display: inline-flex;
    width: fit-content;
    font-size: 13px;
    color: rgba(232, 238, 248, 0.55);

    &:hover {
      color: #fff;
    }
  }

  h1,
  h2 {
    margin: 0;
  }

  h1 {
    font-size: clamp(20px, 3vw, 26px);
  }

  h2 {
    font-size: 15px;
    margin-bottom: 12px;
    color: rgba(232, 238, 248, 0.75);
  }

  .status {
    margin: 0;
    color: rgba(232, 238, 248, 0.45);
    font-size: 14px;
  }

  .err {
    margin: 0 0 10px;
    color: #f07178;
    font-size: 13px;
  }

  .hero {
    display: grid;
    grid-template-columns: 160px 1fr;
    gap: 20px;
    padding: 18px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);

    @media (max-width: 640px) {
      grid-template-columns: 110px 1fr;
      gap: 14px;
      padding: 14px;
    }
  }

  .cover {
    aspect-ratio: 2 / 3;
    border-radius: 10px;
    overflow: hidden;
    background: #151b28;
    display: grid;
    place-items: center;
    color: rgba(255, 255, 255, 0.25);
    font-size: 12px;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .source {
    margin: 0 0 6px;
    font-size: 12px;
    color: #7eb6ff;
    letter-spacing: 0.04em;
  }

  .meta {
    margin: 8px 0 0;
    font-size: 13px;
    color: rgba(232, 238, 248, 0.5);
  }

  .intro {
    margin: 12px 0 0;
    font-size: 13px;
    line-height: 1.65;
    color: rgba(232, 238, 248, 0.62);
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .flow-mini {
    list-style: none;
    margin: 16px 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    li {
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 11px;
      color: rgba(232, 238, 248, 0.35);

      &.done,
      &.on {
        color: #cfe3ff;
        border-color: rgba(79, 156, 245, 0.4);
        background: rgba(79, 156, 245, 0.1);
      }
    }
  }

  .player-block,
  .episodes {
    padding: 18px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
  }

  .player {
    aspect-ratio: 16 / 9;
    max-height: 70vh;
    background: #000;
    border-radius: 10px;
    overflow: hidden;

    video {
      width: 100%;
      height: 100%;
      display: block;
      background: #000;
    }
  }

  .plan {
    margin: 10px 0 0;
    font-size: 12px;
    color: rgba(232, 238, 248, 0.4);
  }

  .list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 8px;
  }

  .list button {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 13px;
    text-align: left;

    span {
      font-size: 11px;
      color: rgba(232, 238, 248, 0.4);
    }

    &.active {
      border-color: rgba(79, 156, 245, 0.55);
      background: rgba(79, 156, 245, 0.14);
    }

    &:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    &:not(:disabled):hover {
      border-color: rgba(255, 255, 255, 0.3);
    }
  }
`
