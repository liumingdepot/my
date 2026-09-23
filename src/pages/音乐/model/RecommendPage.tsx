import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import styled from 'styled-components'
import Banner, { type BannerSlide } from './Banner'
import { RankBadge } from './RankBadge'
import {
  fetchArtistSongs,
  fetchArtists,
  fetchCharts,
  fetchChartSongs,
  fetchPlaylistSongs,
  fetchPlaylists,
  formatListenCnt,
} from '../utils/server'
import { useMusic } from '../utils/MusicContext'
import type { ChartItem, PlaylistCard, Song } from '../utils/types'

type Board = {
  chart: ChartItem
  songs: Song[]
}

export default function RecommendPage() {
  const { play } = useMusic()
  const navigate = useNavigate()
  const [banners, setBanners] = useState<BannerSlide[]>([])
  const [boards, setBoards] = useState<Board[]>([])
  const [playlists, setPlaylists] = useState<PlaylistCard[]>([])
  const [loading, setLoading] = useState(true)
  const [plLoading, setPlLoading] = useState(true)
  const [error, setError] = useState('')
  const [plError, setPlError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetchCharts()
        const official = res.list.find((g) => (g.disname || g.name || '').includes('官方')) || res.list[0]
        const charts = (official?.child || []).slice(0, 5)
        const boardsRes = await Promise.all(
          charts.map(async (chart) => {
            const id = chart.sourceid
            if (!id) return { chart, songs: [] as Song[] }
            try {
              const songs = await fetchChartSongs(id, 5)
              return { chart, songs: songs.list.slice(0, 5) }
            } catch {
              return { chart, songs: [] as Song[] }
            }
          }),
        )
        if (!cancelled) setBoards(boardsRes)

        // banner：热歌 + 著名歌手
        const hotChart =
          charts.find((c) => /热歌|飙升|新歌|流行/.test(c.disname || c.name || '')) || charts[0]
        const slides: BannerSlide[] = []

        if (hotChart?.sourceid) {
          try {
            const hot = await fetchChartSongs(hotChart.sourceid, 8)
            hot.list.slice(0, 3).forEach((song, i) => {
              if (!song.cover) return
              slides.push({
                id: song.id,
                title: song.title,
                subtitle: song.artist,
                cover: song.cover,
                songs: hot.list,
                songIndex: i,
                kind: 'song',
              })
            })
          } catch {
            /* ignore */
          }
        }

        try {
          const artists = await fetchArtists({ category: 0, pn: 1, rn: 8 })
          const top = artists.list.filter((a) => a.cover).slice(0, 3)
          const artistSlides = await Promise.all(
            top.map(async (artist) => {
              try {
                const songs = await fetchArtistSongs(artist.id, 1, 20)
                return {
                  id: artist.id,
                  title: artist.name,
                  subtitle: `${artist.musicNum || songs.list.length} 首热门作品`,
                  cover: artist.cover,
                  songs: songs.list,
                  songIndex: 0,
                  kind: 'artist' as const,
                }
              } catch {
                return null
              }
            }),
          )
          for (const s of artistSlides) {
            if (s?.songs.length) slides.push(s)
          }
        } catch {
          /* ignore */
        }

        if (!cancelled) setBanners(slides.slice(0, 6))
      } catch {
        if (!cancelled) setError('排行榜加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetchPlaylists('hot', 1, 15)
        if (!cancelled) setPlaylists(res.list)
      } catch {
        if (!cancelled) setPlError('歌单加载失败')
      } finally {
        if (!cancelled) setPlLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function openPlaylist(card: PlaylistCard) {
    try {
      const res = await fetchPlaylistSongs(card.id)
      if (res.list.length) play(res.list, 0)
    } catch {
      /* ignore */
    }
  }

  return (
    <Style>
      <Banner items={banners} onPlay={play} />

      <section className="sec">
        <header className="sec-head">
          <h2>排行榜</h2>
          <Link to="/music/charts" className="more">
            更多 &gt;
          </Link>
        </header>

        {error && <p className="state">{error}</p>}
        {loading && !boards.length && <p className="state">加载中…</p>}

        <div className="boards">
          {boards.map(({ chart, songs }, bi) => {
            const id = String(chart.sourceid ?? '')
            const title = chart.disname || chart.name || '榜单'
            const cover = chart.pic5 || chart.pic2 || chart.pic || ''
            return (
              <article key={id || title} className="board">
                <button
                  type="button"
                  className="board-cover"
                  style={{ backgroundImage: cover ? `url(${cover})` : undefined }}
                  onClick={() => id && navigate(`/music/charts?id=${encodeURIComponent(id)}`)}
                >
                  <span className="board-cover__title">{title.replace(/^酷我/, '')}</span>
                  {bi === 0 && songs.length > 0 && (
                    <span
                      className="board-cover__play"
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        play(songs, 0)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.stopPropagation()
                          play(songs, 0)
                        }
                      }}
                      aria-label="播放"
                    >
                      ▶
                    </span>
                  )}
                </button>
                <ul className="board-list">
                  {songs.map((song, i) => (
                    <li key={song.id}>
                      <button type="button" onClick={() => play(songs, i)}>
                        <RankBadge rank={i + 1} />
                        <span className="meta">
                          <span className="title">{song.title}</span>
                          <span className="artist">{song.artist}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </article>
            )
          })}
        </div>
      </section>

      <section className="sec">
        <header className="sec-head">
          <h2>精选歌单</h2>
          <Link to="/music/playlists" className="more">
            更多 &gt;
          </Link>
        </header>

        {plError && <p className="state">{plError}</p>}
        {plLoading && !playlists.length && <p className="state">加载中…</p>}

        <div className="pl-grid">
          {playlists.map((card) => (
            <button key={String(card.id)} type="button" className="pl-card" onClick={() => void openPlaylist(card)}>
              <span className="pl-cover" style={{ backgroundImage: card.img ? `url(${card.img})` : undefined }} />
              <span className="pl-name">{card.name}</span>
              <span className="pl-listen">
                <i aria-hidden>▶</i>
                {formatListenCnt(card.listencnt)}
              </span>
            </button>
          ))}
        </div>
      </section>
    </Style>
  )
}

const Style = styled.div`
  .sec {
    margin-bottom: 40px;
  }

  .sec-head {
    display: flex;
    align-items: baseline;
    gap: 14px;
    margin-bottom: 22px;

    h2 {
      margin: 0;
      font-size: 26px;
      font-weight: 800;
      color: var(--ink);
      letter-spacing: 0.04em;
    }

    .more {
      font-size: 13px;
      color: var(--muted);
      text-decoration: none;
      transition: color 0.2s;

      &:hover {
        color: var(--purple);
      }
    }
  }

  .state {
    color: var(--muted);
    font-size: 14px;
  }

  .boards {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 18px;
  }

  .board {
    min-width: 0;
    border-radius: 12px;
    overflow: hidden;
    background: var(--bg-elev);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-soft);
  }

  .board-cover {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 16 / 10;
    border: 0;
    border-radius: 0;
    padding: 0;
    cursor: pointer;
    background: var(--cover) center / cover no-repeat;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.65));
    }
  }

  .board-cover__title {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: #fff;
    font-size: clamp(18px, 1.6vw, 26px);
    font-weight: 800;
    letter-spacing: 0.06em;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.45);
    z-index: 1;
  }

  .board-cover__play {
    position: absolute;
    right: 10px;
    bottom: 10px;
    z-index: 2;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--grad-btn);
    color: #fff;
    display: grid;
    place-items: center;
    font-size: 12px;
    box-shadow: 0 4px 14px rgba(124, 92, 252, 0.35);
  }

  .board-list {
    list-style: none;
    margin: 0;
    padding: 8px 8px 10px;
    background: var(--bg-elev);

    li button {
      width: 100%;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 8px 6px;
      border: 0;
      background: transparent;
      text-align: left;
      cursor: pointer;
      border-radius: 6px;
      transition: background 0.2s;

      &:hover {
        background: var(--accent-soft);
      }
    }
  }

  .meta {
    min-width: 0;
    display: grid;
    gap: 2px;
  }

  .title {
    font-size: 13px;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .artist {
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pl-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 18px 14px;
  }

  .pl-card {
    display: grid;
    gap: 8px;
    border: 0;
    padding: 10px;
    text-align: left;
    cursor: pointer;
    color: inherit;
    background: var(--bg-elev);
    border: 1px solid var(--line);
    border-radius: 12px;
    box-shadow: var(--shadow-soft);
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease,
      border-color 0.2s ease;

    &:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow);
      border-color: color-mix(in srgb, var(--purple) 35%, var(--line));
    }
  }

  .pl-cover {
    aspect-ratio: 1;
    border-radius: 8px;
    background: var(--cover) center / cover no-repeat;
  }

  .pl-name {
    font-size: 13px;
    color: var(--ink);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .pl-listen {
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

  @media (max-width: 1100px) {
    .boards,
    .pl-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 720px) {
    .boards,
    .pl-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .sec-head h2 {
      font-size: 22px;
    }
  }

  @media (max-width: 420px) {
    .boards {
      grid-template-columns: 1fr;
    }
  }
`
