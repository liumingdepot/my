import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import styled from 'styled-components'
import { api, catDots, fmtW, imgUrl, type MacEpisode, type MacMeta } from '../utils/server'
import { favs, hist } from '../utils/history'
import { PINK } from '../utils/theme'
import { Empty, Loading } from './shared'

const DetailPage = () => {
  const { sid = '' } = useParams()
  const nav = useNavigate()
  const [meta, setMeta] = useState<MacMeta | null>(null)
  const [episodes, setEpisodes] = useState<MacEpisode[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [isFav, setIsFav] = useState(false)
  const [clamp, setClamp] = useState(true)
  const rec = hist.get(sid)

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
        setIsFav(favs.has(sid))
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
  }, [sid])

  if (loading) return <Loading />
  if (err || !meta) return <Empty>{err || '加载失败'}</Empty>

  const cat = catDots(meta.category, 4)

  const toggleFav = () => {
    const on = favs.toggle({ sid, title: meta.title, cover: meta.cover })
    setIsFav(on)
  }

  return (
    <Style>
      <div className="hero">
        <img
          className="hposter"
          src={imgUrl(meta.cover)}
          alt=""
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.visibility = 'hidden'
          }}
        />
        <div className="hinfo">
          <h1>{meta.title}</h1>
          <div className="hmeta">
            {meta.score ? (
              <>
                <span>
                  <b>{meta.score}分</b>
                </span>
                <span className="sep">|</span>
              </>
            ) : null}
            <span>全 {meta.episode_cnt} 集</span>
            <span className="sep">|</span>
            <span>{fmtW(meta.play_cnt)}次播放</span>
            {meta.followed_cnt ? (
              <>
                <span className="sep">|</span>
                <span>{fmtW(meta.followed_cnt)}收藏</span>
              </>
            ) : null}
            {meta.status ? (
              <>
                <span className="sep">|</span>
                <span>{meta.status}</span>
              </>
            ) : null}
          </div>
          {cat ? <div className="hmeta" style={{ marginTop: 8 }}>{cat}</div> : null}
          <div className={`hintro ${clamp ? 'clamp' : ''}`}>
            {meta.intro || ''}
            {(meta.intro || '').length > 90 ? (
              <span className="more" onClick={() => setClamp((c) => !c)}>
                {clamp ? '展开' : '收起'}
              </span>
            ) : null}
          </div>
          <div className="hbtns">
            {rec ? (
              <button className="btn-pink" type="button" onClick={() => nav(`/test/watch/${sid}/${rec.ep}`)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff">
                  <path d="M8 5.5v13c0 .8.9 1.3 1.6.9l10.2-6.5c.6-.4.6-1.4 0-1.8L9.6 4.6c-.7-.4-1.6.1-1.6.9z" />
                </svg>
                继续看 第{rec.ep}集
              </button>
            ) : null}
            <button
              type="button"
              className={rec ? 'btn-line' : 'btn-pink'}
              onClick={() => nav(`/test/watch/${sid}/1`)}
            >
              {rec ? '从头看' : '播放第1集'}
            </button>
            <button type="button" className={`btn-line ${isFav ? 'on' : ''}`} onClick={toggleFav}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill={isFav ? PINK : 'none'}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              >
                <path d="M6 4h12v17l-6-4.2L6 21V4z" />
              </svg>
              {isFav ? '已收藏' : '收藏'}
            </button>
          </div>
        </div>
      </div>
      <div className="epswrap">
        <h3>选集（{episodes.length}）</h3>
        <div className="eps">
          {episodes.map((e) => {
            const seen =
              rec &&
              (e.index < rec.ep || (e.index === rec.ep && rec.pos > (rec.dur || 1e9) * 0.9))
            return (
              <div
                key={e.index}
                className={`ep ${seen ? 'seen' : ''}`}
                onClick={() => nav(`/test/watch/${sid}/${e.index}`)}
              >
                {e.index}
              </div>
            )
          })}
        </div>
      </div>
    </Style>
  )
}

export default DetailPage

const Style = styled.div`
  .hero {
    display: flex;
    gap: 26px;
    background: #fff;
    border-radius: 14px;
    padding: 24px;
  }
  .hposter {
    width: 212px;
    flex: none;
    aspect-ratio: 7/10;
    border-radius: 10px;
    object-fit: cover;
    background: #e8e9ee;
  }
  .hinfo {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .hinfo h1 {
    font-size: 23px;
    font-weight: 800;
    margin: 0;
  }
  .hmeta {
    display: flex;
    flex-wrap: wrap;
    gap: 7px 0;
    margin-top: 10px;
    font-size: 13px;
    color: var(--txt2);
  }
  .hmeta b {
    color: var(--pink);
    font-weight: 700;
  }
  .hmeta .sep {
    margin: 0 10px;
    color: #d8dae0;
  }
  .hintro {
    margin-top: 14px;
    font-size: 13.5px;
    color: #4c5162;
    line-height: 1.75;
  }
  .hintro.clamp {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .hintro .more {
    color: var(--pink);
    cursor: pointer;
    white-space: nowrap;
    margin-left: 6px;
  }
  .hbtns {
    margin-top: auto;
    padding-top: 18px;
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .btn-pink {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: var(--pink);
    color: #fff;
    border: 0;
    border-radius: 10px;
    padding: 10px 24px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }
  .btn-pink:hover {
    filter: brightness(1.06);
  }
  .btn-line {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: #fff;
    color: #333;
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 10px 18px;
    font-size: 14px;
    cursor: pointer;
    font-family: inherit;
  }
  .btn-line.on {
    color: var(--pink);
    border-color: var(--pink-border);
    background: var(--pink-soft);
  }
  .epswrap {
    background: #fff;
    border-radius: 14px;
    padding: 20px 24px 24px;
    margin-top: 16px;
  }
  .epswrap h3 {
    font-size: 16px;
    font-weight: 700;
    margin: 0 0 14px;
  }
  .eps {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
    gap: 10px;
  }
  .ep {
    height: 38px;
    border-radius: 9px;
    background: #f6f7f9;
    border: 1px solid transparent;
    display: grid;
    place-items: center;
    font-size: 13px;
    cursor: pointer;
    color: #333;
  }
  .ep:hover {
    border-color: var(--pink-border);
    color: var(--pink);
  }
  .ep.seen {
    color: #a7acb9;
  }

  @media (max-width: 720px) {
    .hero {
      flex-direction: column;
    }
    .hposter {
      width: 140px;
    }
  }
`
