import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { ARTIST_CATEGORIES, ARTIST_LETTERS } from '../utils/categories'
import { fetchArtistSongs, fetchArtists } from '../utils/server'
import { useMusic } from '../utils/MusicContext'
import type { Artist, Song } from '../utils/types'

export default function ArtistsPage() {
  const { play } = useMusic()
  const [prefix, setPrefix] = useState('热门')
  const [category, setCategory] = useState(0)
  const [list, setList] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<{ artist: Artist; songs: Song[] } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setDetail(null)
    ;(async () => {
      try {
        const res = await fetchArtists({
          category,
          prefix: prefix === '热门' ? '' : prefix,
          pn: 1,
          rn: 60,
        })
        if (!cancelled) setList(res.list)
      } catch {
        if (!cancelled) setError('歌手列表加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [prefix, category])

  async function openArtist(artist: Artist) {
    setDetailLoading(true)
    setError('')
    try {
      const res = await fetchArtistSongs(artist.id, 1, 50)
      setDetail({ artist, songs: res.list })
    } catch {
      setError('歌手歌曲加载失败')
    } finally {
      setDetailLoading(false)
    }
  }

  if (detail) {
    return (
      <Style>
        <button type="button" className="back" onClick={() => setDetail(null)}>
          ← {detail.artist.name}
        </button>
        <div className="detail-head">
          <span className="avatar" style={{ backgroundImage: `url(${detail.artist.cover})` }} />
          <div>
            <h1>{detail.artist.name}</h1>
            <p>{detail.artist.musicNum}首歌曲</p>
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
        <ul className="song-list">
          {detail.songs.map((song, i) => (
            <li key={`${song.id}-${i}`}>
              <button type="button" onClick={() => play(detail.songs, i)}>
                <span className="idx">{i + 1}</span>
                <span className="cover" style={{ backgroundImage: song.cover ? `url(${song.cover})` : undefined }} />
                <span className="meta">
                  <span className="title">{song.title}</span>
                  <span className="album">{song.album || song.artist}</span>
                </span>
                <span className="time">{song.duration || ''}</span>
              </button>
            </li>
          ))}
        </ul>
      </Style>
    )
  }

  const featured = list.slice(0, 12)
  const rest = list.slice(12)

  return (
    <Style>
      <div className="filters">
        <div className="row">
          {ARTIST_LETTERS.map((letter) => (
            <button
              key={letter}
              type="button"
              className={prefix === letter ? 'is-active' : ''}
              onClick={() => setPrefix(letter)}
            >
              {letter}
            </button>
          ))}
        </div>
        <div className="row">
          {ARTIST_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={category === c.id ? 'is-active' : ''}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="state">{error}</p>}
      {(loading || detailLoading) && !list.length && <p className="state">加载中…</p>}

      <div className="grid">
        {featured.map((a) => (
          <button key={a.id} type="button" className="card" onClick={() => void openArtist(a)}>
            <span className="avatar" style={{ backgroundImage: a.cover ? `url(${a.cover})` : undefined }} />
            <span className="name">{a.name}</span>
            <span className="cnt">{a.musicNum}首歌曲</span>
          </button>
        ))}
      </div>

      {rest.length > 0 && (
        <div className="list-grid">
          {rest.map((a) => (
            <button key={a.id} type="button" className="list-item" onClick={() => void openArtist(a)}>
              <span className="avatar sm" style={{ backgroundImage: a.cover ? `url(${a.cover})` : undefined }} />
              <span className="name">{a.name}</span>
            </button>
          ))}
        </div>
      )}
    </Style>
  )
}

const Style = styled.div`
  .filters {
    display: grid;
    gap: 12px;
    margin-bottom: 28px;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 4px;

    button {
      border: 0;
      background: transparent;
      color: var(--text-soft);
      font-size: 13px;
      padding: 6px 12px;
      border-radius: 999px;
      cursor: pointer;
      transition:
        background 0.2s,
        color 0.2s;

      &.is-active {
        background: var(--grad-btn);
        color: #fff;
        font-weight: 700;
      }

      &:hover:not(.is-active) {
        background: rgba(255, 255, 255, 0.06);
        color: var(--ink);
      }
    }
  }

  .state {
    color: var(--muted);
    font-size: 14px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 28px 18px;
  }

  .card {
    display: grid;
    justify-items: center;
    gap: 8px;
    border: 0;
    background: transparent;
    padding: 0;
    cursor: pointer;
    color: inherit;

    &:hover .avatar {
      transform: scale(1.04);
      box-shadow: 0 8px 24px var(--accent-soft);
    }
  }

  .avatar {
    width: min(140px, 100%);
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--bg-elev) center / cover no-repeat;
    border: 1px solid rgba(255, 255, 255, 0.08);
    transition:
      transform 0.25s ease,
      box-shadow 0.25s ease;

    &.sm {
      width: 48px;
      height: 48px;
    }
  }

  .name {
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
    text-align: center;
  }

  .cnt {
    font-size: 12px;
    color: var(--muted);
  }

  .list-grid {
    margin-top: 36px;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 16px 12px;
  }

  .list-item {
    display: flex;
    align-items: center;
    gap: 10px;
    border: 0;
    background: transparent;
    padding: 6px;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: background 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.05);
    }

    .name {
      text-align: left;
      font-weight: 500;
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
    align-items: center;
    gap: 24px;
    margin-bottom: 28px;

    .avatar {
      width: 120px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    }

    h1 {
      margin: 0 0 6px;
      font-size: 28px;
      color: var(--ink);
    }

    p {
      margin: 0 0 14px;
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

  .song-list {
    list-style: none;
    margin: 0;
    padding: 0;

    li button {
      width: 100%;
      display: grid;
      grid-template-columns: 36px 44px 1fr auto;
      gap: 12px;
      align-items: center;
      padding: 10px 6px;
      border: 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      background: transparent;
      cursor: pointer;
      text-align: left;
      border-radius: 8px;
      transition: background 0.2s;

      &:hover {
        background: rgba(255, 255, 255, 0.04);
      }
    }

    .idx {
      color: var(--muted);
      font-size: 13px;
      text-align: center;
    }

    .cover {
      width: 44px;
      height: 44px;
      border-radius: 6px;
      background: var(--bg-elev) center / cover no-repeat;
    }

    .meta {
      min-width: 0;
      display: grid;
      gap: 2px;
    }

    .title {
      font-size: 14px;
      color: var(--ink);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .album {
      font-size: 12px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .time {
      font-size: 12px;
      color: var(--muted);
    }
  }

  @media (max-width: 1100px) {
    .grid,
    .list-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (max-width: 720px) {
    .grid,
    .list-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px 10px;
    }

    .detail-head {
      flex-direction: column;
      align-items: flex-start;
    }
  }

  @media (max-width: 480px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .list-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
`
