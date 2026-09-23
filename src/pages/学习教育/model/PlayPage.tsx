import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import styled from 'styled-components'
import {
  fetchEducationDetail,
  fetchEducationPlay,
  formatDuration,
  formatPlayCount,
  type EducationDetail,
} from '../utils/server'

export default function PlayPage() {
  const { bvid: bvidParam = '' } = useParams()
  const bvid = decodeURIComponent(bvidParam).trim()
  const navigate = useNavigate()

  const [detail, setDetail] = useState<EducationDetail | null>(null)
  const [episodeIndex, setEpisodeIndex] = useState(0)
  const [playUrl, setPlayUrl] = useState('')
  const [detailLoading, setDetailLoading] = useState(true)
  const [playLoading, setPlayLoading] = useState(false)
  const [error, setError] = useState('')
  const [playError, setPlayError] = useState('')
  const [mediaReady, setMediaReady] = useState(false)
  const [draftQ, setDraftQ] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0a0c10')
  }, [])

  useEffect(() => {
    if (!bvid) {
      setError('无效的视频')
      setDetailLoading(false)
      return
    }

    const ac = new AbortController()
    ;(async () => {
      setDetailLoading(true)
      setError('')
      setDetail(null)
      setEpisodeIndex(0)
      setPlayUrl('')
      try {
        const data = await fetchEducationDetail(bvid, ac.signal)
        if (ac.signal.aborted) return
        setDetail(data)
        document.title = `${data.title} · 铭教育`
      } catch (err) {
        if (!ac.signal.aborted) {
          setError(err instanceof Error ? err.message : '加载失败')
        }
      } finally {
        if (!ac.signal.aborted) setDetailLoading(false)
      }
    })()

    return () => ac.abort()
  }, [bvid])

  const currentPage = detail?.pages[episodeIndex] ?? detail?.pages[0] ?? null

  useEffect(() => {
    if (!detail?.pages.length) return
    const page = detail.pages[episodeIndex] ?? detail.pages[0]
    if (!page) return

    const ac = new AbortController()
    ;(async () => {
      setPlayLoading(true)
      setPlayError('')
      setPlayUrl('')
      setMediaReady(false)
      try {
        const result = await fetchEducationPlay({
          bvid: detail.bvid,
          cid: page.cid,
          signal: ac.signal,
        })
        if (ac.signal.aborted) return
        setPlayUrl(result.playableUrl)
      } catch (err) {
        if (!ac.signal.aborted) {
          setPlayError(err instanceof Error ? err.message : '视频解析失败')
        }
      } finally {
        if (!ac.signal.aborted) setPlayLoading(false)
      }
    })()

    return () => ac.abort()
  }, [detail, episodeIndex])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !playUrl) return

    setMediaReady(false)
    const onReady = () => setMediaReady(true)
    video.addEventListener('playing', onReady)
    video.addEventListener('loadeddata', onReady)
    video.src = playUrl
    void video.play().catch(() => {})

    return () => {
      video.removeEventListener('playing', onReady)
      video.removeEventListener('loadeddata', onReady)
    }
  }, [playUrl])

  function goBack() {
    const idx = (window.history.state as { idx?: number } | null)?.idx
    if (typeof idx === 'number' && idx > 0) navigate(-1)
    else navigate('/education')
  }

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const trimmed = draftQ.trim()
    if (!trimmed) {
      navigate('/education')
      return
    }
    navigate(`/education?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <Style>
      <header className="top">
        <div className="shell top__inner">
          <Link to="/education" className="brand" aria-label="铭教育">
            <span className="brand__mark">教</span>
            <span className="brand__text">铭教育</span>
          </Link>

          <form className="search" onSubmit={onSearch} role="search">
            <svg className="search__icon" viewBox="0 0 24 24" aria-hidden>
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M16.5 16.5L21 21"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <input
              value={draftQ}
              onChange={(e) => setDraftQ(e.target.value)}
              placeholder="搜索课程…"
              aria-label="在教育范围内搜索"
            />
            <button type="submit" className="search__go">
              搜索
            </button>
          </form>
        </div>
      </header>

      <main className="shell main">
        {detailLoading ? (
          <p className="status">
            <button type="button" className="back" onClick={goBack}>
              ← 返回
            </button>
            加载中
          </p>
        ) : error || !detail ? (
          <p className="status status--err">
            <button type="button" className="back" onClick={goBack}>
              ← 返回
            </button>
            {error || '未找到视频'}
          </p>
        ) : (
          <>
            <div className="main-row">
              <div className="player-wrap">
                <div className="player-inner">
                  <video
                    ref={(el) => {
                      videoRef.current = el
                      el?.setAttribute('referrerpolicy', 'no-referrer')
                    }}
                    key={playUrl || currentPage?.cid}
                    controls
                    playsInline
                    poster={detail.pic || undefined}
                  />
                  {(playLoading || (!mediaReady && !playError)) && playUrl === '' ? (
                    <div className="placeholder">
                      <span className="brand-word">铭教育</span>
                      <span className="hint">加载中</span>
                    </div>
                  ) : null}
                  {!playLoading && playError ? (
                    <div className="play-err">
                      <p>{playError}</p>
                      <a href={detail.url} target="_blank" rel="noreferrer">
                        在 B 站打开
                      </a>
                    </div>
                  ) : null}
                  {playUrl && !mediaReady && !playError ? (
                    <div className="placeholder placeholder--soft">
                      <span className="hint">加载中</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <aside className="side">
                <header className="meta">
                  <button type="button" className="back" onClick={goBack}>
                    ← 返回
                  </button>
                  <h1>{detail.title}</h1>
                  <p>
                    {[
                      detail.author,
                      `${formatPlayCount(detail.play)} 播放`,
                      detail.pages.length > 1 ? `${detail.pages.length} 集` : '',
                      currentPage ? formatDuration(currentPage.duration) : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </header>

                <section className="block info">
                  {detail.author ? (
                    <p>
                      <em>UP主</em>
                      {detail.author}
                    </p>
                  ) : null}
                  <p>
                    <em>数据</em>
                    {formatPlayCount(detail.play)} 播放
                    {detail.danmaku > 0 ? ` · ${formatPlayCount(detail.danmaku)} 弹幕` : ''}
                    {detail.like > 0 ? ` · ${formatPlayCount(detail.like)} 点赞` : ''}
                  </p>
                  {detail.desc ? (
                    <p className="blurb">
                      <em>简介</em>
                      {detail.desc}
                    </p>
                  ) : null}
                </section>
              </aside>
            </div>

            {detail.pages.length > 0 ? (
              <section className="block">
                <h2>分集{detail.pages.length > 1 ? `（${detail.pages.length}）` : ''}</h2>
                <div className="eps">
                  {detail.pages.map((ep, i) => (
                    <button
                      key={ep.cid}
                      type="button"
                      className={i === episodeIndex ? 'is-active' : ''}
                      title={formatDuration(ep.duration) || undefined}
                      onClick={() => setEpisodeIndex(i)}
                    >
                      <span className="eps__title">{ep.part}</span>
                      {ep.duration > 0 ? (
                        <span className="eps__dur">{formatDuration(ep.duration)}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>
    </Style>
  )
}

const Style = styled.div`
  --bg: #0a0c10;
  --ink: #f0eee8;
  --muted: rgba(240, 238, 232, 0.52);
  --line: rgba(240, 238, 232, 0.1);
  --gold: #c9a46a;
  --serif: "Songti SC", "STSong", "Noto Serif SC", "Source Han Serif SC", Georgia, serif;
  --sans: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif;

  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  color: var(--ink);
  background:
    radial-gradient(1100px 520px at 8% -8%, rgba(201, 164, 106, 0.14), transparent 55%),
    radial-gradient(900px 480px at 92% 4%, rgba(90, 120, 160, 0.12), transparent 50%),
    linear-gradient(180deg, #12151c 0%, var(--bg) 38%, #06080c 100%);
  font-family: var(--sans);

  .shell {
    width: 90%;
    max-width: 1680px;
    margin-left: auto;
    margin-right: auto;
  }

  .top {
    position: sticky;
    top: 0;
    z-index: 30;
    border-bottom: 1px solid var(--line);
    background: rgba(10, 12, 16, 0.72);
    backdrop-filter: blur(18px) saturate(1.3);
  }

  .top__inner {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.85rem 0;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.7rem;
    color: inherit;
    text-decoration: none;
    flex-shrink: 0;
  }

  .brand__mark {
    width: 2.15rem;
    height: 2.15rem;
    display: grid;
    place-items: center;
    border-radius: 0.55rem;
    background: linear-gradient(145deg, #e2c48a 0%, #c9a46a 48%, #9a7340 100%);
    color: #14110c;
    font-family: var(--serif);
    font-size: 1.05rem;
    font-weight: 700;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.16) inset,
      0 6px 18px rgba(201, 164, 106, 0.22);
  }

  .brand__text {
    font-family: var(--serif);
    font-size: 1.28rem;
    font-weight: 700;
    letter-spacing: 0.12em;
  }

  .search {
    display: flex;
    align-items: center;
    flex: 0 1 18rem;
    min-width: 10rem;
    max-width: 22rem;
    height: 2.35rem;
    margin-left: auto;
    padding: 0 0.2rem 0 0.75rem;
    border-radius: 0.55rem;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.04);
    transition: border-color 0.2s, background 0.2s;

    &:focus-within {
      border-color: rgba(201, 164, 106, 0.55);
      background: rgba(201, 164, 106, 0.08);
    }
  }

  .search__icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    color: var(--muted);
  }

  .search input {
    flex: 1;
    min-width: 0;
    height: 100%;
    margin: 0 0.35rem;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 0.88rem;
    outline: none;

    &::placeholder {
      color: rgba(240, 238, 232, 0.38);
    }
  }

  .search__go {
    flex-shrink: 0;
    height: calc(100% - 0.3rem);
    padding: 0 0.85rem;
    border: 0;
    border-radius: 0.4rem;
    background: linear-gradient(145deg, #e2c48a 0%, #c9a46a 48%, #9a7340 100%);
    color: #14110c;
    font: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: filter 0.2s;

    &:hover {
      filter: brightness(1.06);
    }
  }

  .main {
    padding: 1.5rem 0 3rem;
    flex: 1;
  }

  .status {
    margin: 0;
    padding: 2rem 0;
    color: var(--muted);
  }

  .status--err {
    color: #f0a8a8;
  }

  .back {
    display: inline-flex;
    align-items: center;
    margin: 0 0 0.85rem;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 0.85rem;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: var(--gold);
    }
  }

  .status .back {
    display: block;
  }

  .main-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
    gap: 1.5rem;
    align-items: stretch;
    margin-bottom: 2rem;
  }

  .player-wrap {
    background: #000;
    border-radius: 0.65rem;
    overflow: hidden;
    border: 1px solid var(--line);
  }

  .player-inner {
    position: relative;
    aspect-ratio: 16 / 9;
    background: #0a0c10;

    video {
      width: 100%;
      height: 100%;
      display: block;
      background: #000;
      object-fit: contain;
    }

    .placeholder {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      pointer-events: none;
      background:
        radial-gradient(ellipse 70% 55% at 50% 40%, rgba(201, 164, 106, 0.12), transparent 70%),
        linear-gradient(160deg, #141820 0%, #0a0c10 55%, #12151c 100%);

      .brand-word {
        font-family: var(--serif);
        font-size: 2rem;
        font-weight: 700;
        letter-spacing: 0.18em;
        color: var(--gold);
      }

      .hint {
        font-size: 0.92rem;
        letter-spacing: 0.2em;
        color: var(--muted);
      }
    }

    .placeholder--soft {
      background: rgba(10, 12, 16, 0.45);
    }

    .play-err {
      position: absolute;
      inset: 0;
      z-index: 3;
      display: grid;
      place-content: center;
      gap: 0.6rem;
      padding: 1rem;
      text-align: center;
      background: rgba(4, 6, 10, 0.72);

      p {
        margin: 0;
        color: #f0a8a8;
        font-size: 0.92rem;
      }

      a {
        color: var(--gold);
        text-decoration: none;
      }
    }
  }

  .side {
    min-width: 0;
    height: 0;
    min-height: 100%;
    overflow-y: auto;
    padding-right: 0.25rem;

    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-thumb {
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.15);
    }
  }

  .meta {
    margin-bottom: 1.25rem;

    h1 {
      margin: 0;
      font-family: var(--serif);
      font-size: clamp(1.2rem, 2.2vw, 1.65rem);
      font-weight: 700;
      line-height: 1.35;
      letter-spacing: 0.02em;
    }

    p {
      margin: 0.65rem 0 0;
      font-size: 0.82rem;
      line-height: 1.5;
      color: var(--muted);
    }
  }

  .block {
    margin-bottom: 1.75rem;

    h2 {
      margin: 0 0 0.85rem;
      font-size: 1rem;
      font-weight: 600;
    }

    &:last-child {
      margin-bottom: 0;
    }
  }

  .side .block {
    margin-bottom: 1.25rem;
  }

  .info {
    p {
      margin: 0 0 0.75rem;
      font-size: 0.88rem;
      line-height: 1.7;
      color: rgba(240, 238, 232, 0.72);

      em {
        display: inline-block;
        min-width: 2.6rem;
        margin-right: 0.65rem;
        font-style: normal;
        color: rgba(240, 238, 232, 0.4);
      }

      a {
        color: var(--gold);
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }
    }

    .blurb {
      color: var(--muted);
      display: -webkit-box;
      -webkit-line-clamp: 10;
      -webkit-box-orient: vertical;
      overflow: hidden;
      white-space: pre-wrap;
    }
  }

  .eps {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.5rem;

    button {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      width: 100%;
      min-width: 0;
      min-height: 2.5rem;
      padding: 0.45rem 0.65rem;
      border-radius: 0.5rem;
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.035);
      color: rgba(240, 238, 232, 0.82);
      font: inherit;
      font-size: 0.88rem;
      text-align: left;
      cursor: pointer;
      transition: border-color 0.2s, color 0.2s, background 0.2s;

      &:hover {
        border-color: rgba(201, 164, 106, 0.45);
        color: var(--gold);
      }

      &.is-active {
        background: linear-gradient(145deg, #e2c48a, #c9a46a);
        border-color: transparent;
        color: #14110c;
        font-weight: 600;
      }
    }

    .eps__title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: 1.35;
    }

    .eps__dur {
      flex-shrink: 0;
      font-size: 0.78rem;
      opacity: 0.65;
      letter-spacing: 0.02em;
    }

    button.is-active .eps__dur {
      opacity: 0.8;
    }
  }

  @media (max-width: 1100px) {
    .main-row {
      grid-template-columns: minmax(0, 1fr) minmax(220px, 280px);
      gap: 1.1rem;
    }

    .eps {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 860px) {
    .shell {
      width: calc(100% - 1.5rem);
    }

    .search {
      flex: 1 1 auto;
      min-width: 0;
      max-width: none;
    }

    .main-row {
      grid-template-columns: 1fr;
    }

    .side {
      height: auto;
      min-height: 0;
      overflow: visible;
      padding-right: 0;
    }

    .player-inner .placeholder .brand-word {
      font-size: 1.6rem;
    }

    .eps {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
`
