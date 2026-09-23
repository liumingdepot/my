import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { fetchPlaylistSongs, fetchPlaylists, formatListenCnt } from '../utils/server'
import { useMusic } from '../utils/MusicContext'
import type { PlaylistCard, Song } from '../utils/types'

type Order = 'new' | 'hot'

export default function PlaylistsPage() {
  const { play } = useMusic()
  const [order, setOrder] = useState<Order>('new')
  const [list, setList] = useState<PlaylistCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<{ card: PlaylistCard; songs: Song[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setDetail(null)
    ;(async () => {
      try {
        const res = await fetchPlaylists(order, 1, 30)
        if (!cancelled) setList(res.list)
      } catch {
        if (!cancelled) setError('歌单加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [order])

  async function openPlaylist(card: PlaylistCard) {
    setLoading(true)
    setError('')
    try {
      const res = await fetchPlaylistSongs(card.id)
      setDetail({ card, songs: res.list })
    } catch {
      setError('歌单详情加载失败')
    } finally {
      setLoading(false)
    }
  }

  if (detail) {
    return (
      <Style>
        <button type="button" className="back" onClick={() => setDetail(null)}>
          ← {detail.card.name}
        </button>
        <div className="detail-head">
          <span className="cover-lg" style={{ backgroundImage: detail.card.img ? `url(${detail.card.img})` : undefined }} />
          <div>
            <h1>{detail.card.name}</h1>
            <p>播放量 {formatListenCnt(detail.card.listencnt)}</p>
            <button
              type="button"
              className="play-all"
              disabled={!detail.songs.length}
              onClick={() => play(detail.songs, 0)}
            >
              ▶ 播放全部
            </button>
          </div>
        </div>
        <div className="table">
          <div className="tr head-row">
            <span className="c-idx">序号</span>
            <span className="c-song">歌曲</span>
            <span className="c-artist">歌手</span>
            <span className="c-time">时长</span>
          </div>
          {detail.songs.map((song, i) => (
            <button
              key={`${song.id}-${i}`}
              type="button"
              className="tr row"
              onClick={() => play(detail.songs, i)}
            >
              <span className="c-idx">{i + 1}</span>
              <span className="c-song">
                <span className="song-title">{song.title}</span>
                {song.lossless && <em className="tag tag-hq">无损</em>}
                {song.hasMv && <em className="tag tag-mv">MV</em>}
              </span>
              <span className="c-artist">{song.artist}</span>
              <span className="c-time">{song.duration || '—'}</span>
            </button>
          ))}
        </div>
      </Style>
    )
  }

  return (
    <Style>
      <header className="bar">
        <button type="button" className="cat">
          精选歌单 <span aria-hidden>▾</span>
        </button>
        <div className="order">
          <button type="button" className={order === 'new' ? 'is-active' : ''} onClick={() => setOrder('new')}>
            最新
          </button>
          <button type="button" className={order === 'hot' ? 'is-active' : ''} onClick={() => setOrder('hot')}>
            最热
          </button>
        </div>
      </header>

      {error && <p className="state">{error}</p>}
      {loading && !list.length && <p className="state">加载中…</p>}

      <div className="grid">
        {list.map((card) => (
          <button key={String(card.id)} type="button" className="card" onClick={() => void openPlaylist(card)}>
            <span className="cover" style={{ backgroundImage: card.img ? `url(${card.img})` : undefined }} />
            <span className="name">{card.name}</span>
            <span className="listen">
              <i aria-hidden>▶</i>
              {formatListenCnt(card.listencnt)}
            </span>
          </button>
        ))}
      </div>
    </Style>
  )
}

const Style = styled.div`
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 22px;
    gap: 12px;
  }

  .cat {
    border: 0;
    background: transparent;
    font-size: 20px;
    font-weight: 800;
    color: var(--ink);
    padding: 0;
    cursor: default;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    letter-spacing: 0.04em;

    span {
      font-size: 12px;
      color: var(--muted);
    }
  }

  .order {
    display: flex;
    gap: 18px;

    button {
      border: 0;
      background: transparent;
      padding: 6px 2px;
      font-size: 14px;
      color: var(--muted);
      cursor: pointer;
      position: relative;

      &.is-active {
        color: var(--ink);
        font-weight: 700;

        &::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 2px;
          background: var(--purple);
          border-radius: 1px;
        }
      }
    }
  }

  .state {
    color: var(--muted);
    font-size: 14px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 22px 16px;
  }

  .card {
    display: grid;
    gap: 8px;
    border: 0;
    background: transparent;
    padding: 0;
    text-align: left;
    cursor: pointer;
    color: inherit;

    &:hover .cover {
      transform: translateY(-3px);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
      border-color: rgba(124, 92, 252, 0.35);
    }
  }

  .cover {
    aspect-ratio: 1;
    border-radius: 8px;
    background: var(--bg-elev) center / cover no-repeat;
    border: 1px solid rgba(255, 255, 255, 0.06);
    transition:
      transform 0.25s ease,
      box-shadow 0.25s ease,
      border-color 0.25s ease;
  }

  .name {
    font-size: 13px;
    color: var(--ink);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .listen {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--muted);

    i {
      font-style: normal;
      font-size: 9px;
    }
  }

  .back {
    border: 0;
    background: transparent;
    color: var(--text-soft);
    font-size: 14px;
    font-weight: 600;
    padding: 0;
    margin-bottom: 20px;
    cursor: pointer;

    &:hover {
      color: var(--purple);
    }
  }

  .detail-head {
    display: flex;
    gap: 24px;
    margin-bottom: 28px;

    .cover-lg {
      width: 160px;
      height: 160px;
      border-radius: 10px;
      flex-shrink: 0;
      background: var(--bg-elev) center / cover no-repeat;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
    }

    h1 {
      margin: 0 0 8px;
      font-size: 24px;
      line-height: 1.3;
      color: var(--ink);
    }

    p {
      margin: 0 0 16px;
      color: var(--muted);
      font-size: 13px;
    }
  }

  .play-all {
    height: 34px;
    padding: 0 18px;
    border: 0;
    border-radius: 999px;
    background: var(--grad-btn);
    color: #fff;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }

  .table {
    display: grid;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .tr {
    display: grid;
    grid-template-columns: 64px minmax(160px, 2.4fr) minmax(100px, 1.2fr) 72px;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    min-width: 0;
  }

  .head-row {
    color: var(--muted);
    font-size: 12px;
    letter-spacing: 0.04em;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .row {
    border: 0;
    background: transparent;
    width: 100%;
    text-align: left;
    cursor: pointer;
    font: inherit;
    color: inherit;
    transition: background 0.15s;

    &:nth-child(odd) {
      background: rgba(255, 255, 255, 0.03);
    }

    &:nth-child(even) {
      background: transparent;
    }

    &:hover {
      background: var(--accent-soft);
    }
  }

  .c-idx {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-soft);
  }

  .row .c-idx {
    color: var(--ink);
  }

  .c-song {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .song-title {
    font-size: 14px;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .tag {
    flex-shrink: 0;
    font-style: normal;
    font-size: 10px;
    line-height: 1;
    padding: 3px 5px;
    border-radius: 3px;
  }

  .tag-hq {
    color: var(--purple);
    border: 1px solid rgba(124, 92, 252, 0.55);
    background: var(--accent-soft);
    font-weight: 600;
  }

  .tag-mv {
    color: var(--text-soft);
    background: rgba(255, 255, 255, 0.12);
    font-weight: 600;
  }

  .c-artist,
  .c-time {
    font-size: 13px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .c-time {
    text-align: left;
  }

  @media (max-width: 1100px) {
    .grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (max-width: 800px) {
    .grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .detail-head {
      flex-direction: column;
    }

    .tr {
      grid-template-columns: 48px minmax(0, 1.6fr) minmax(80px, 1fr) 56px;
      padding: 12px 12px;
      gap: 8px;
    }
  }

  @media (max-width: 520px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px 10px;
    }

    .c-artist {
      display: none;
    }

    .tr {
      grid-template-columns: 40px minmax(0, 1fr) 52px;
    }
  }
`
