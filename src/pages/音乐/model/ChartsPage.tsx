import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import styled from 'styled-components'
import { RankBadge } from './RankBadge'
import { fetchCharts, fetchChartSongs } from '../utils/server'
import { useMusic } from '../utils/MusicContext'
import type { ChartGroup, ChartItem, Song } from '../utils/types'

export default function ChartsPage() {
  const { play, player } = useMusic()
  const [params, setParams] = useSearchParams()
  const [groups, setGroups] = useState<ChartGroup[]>([])
  const [tab, setTab] = useState(0)
  const [activeId, setActiveId] = useState('')
  const [songs, setSongs] = useState<Song[]>([])
  const [pub, setPub] = useState('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const currentGroup = groups[tab]
  const charts = useMemo(() => currentGroup?.child || [], [currentGroup])
  const hasDock = Boolean(player.current)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetchCharts()
        if (cancelled) return
        setGroups(res.list)
        const qid = params.get('id') || ''
        let foundTab = 0
        let foundId = qid
        if (qid) {
          res.list.forEach((g, gi) => {
            if ((g.child || []).some((c) => String(c.sourceid) === qid)) foundTab = gi
          })
        } else {
          foundId = String(res.list[0]?.child?.[0]?.sourceid || '')
        }
        setTab(foundTab)
        setActiveId(foundId)
      } catch {
        if (!cancelled) setError('排行榜加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!activeId) return
    let cancelled = false
    setLoading(true)
    setError('')
    const chart = charts.find((c) => String(c.sourceid) === activeId)
    setTitle(chart?.disname || chart?.name || '榜单')
    ;(async () => {
      try {
        const res = await fetchChartSongs(activeId, 100) // worker 按页 rn≤30 聚合
        if (cancelled) return
        setSongs(res.list)
        setPub(res.pub || chart?.pubTime || '')
      } catch {
        if (!cancelled) setError('榜单详情加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeId, charts])

  function selectChart(item: ChartItem) {
    const id = String(item.sourceid || '')
    if (!id) return
    setActiveId(id)
    setParams({ id })
  }

  return (
    <Style data-dock={hasDock ? '1' : '0'}>
      <aside className="side">
        <div className="tabs">
          {groups.map((g, i) => (
            <button
              key={g.disname || g.name || i}
              type="button"
              className={tab === i ? 'is-active' : ''}
              onClick={() => {
                setTab(i)
                const first = g.child?.[0]
                if (first?.sourceid) {
                  setActiveId(String(first.sourceid))
                  setParams({ id: String(first.sourceid) })
                }
              }}
            >
              {(g.disname || g.name || '').replace(/榜$/, '')}
            </button>
          ))}
        </div>
        <ul className="chart-nav">
          {charts.map((item) => {
            const id = String(item.sourceid || '')
            const cover = item.pic2 || item.pic || item.pic5 || ''
            return (
              <li key={id}>
                <button
                  type="button"
                  className={activeId === id ? 'is-active' : ''}
                  onClick={() => selectChart(item)}
                >
                  <span className="thumb" style={{ backgroundImage: cover ? `url(${cover})` : undefined }} />
                  <span className="info">
                    <span className="name">{item.disname || item.name}</span>
                    <span className="sub">{item.pubTime ? '今日更新' : '每日更新'}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      <section className="detail">
        <header className="head">
          <div className="head-top">
            <h1>{title}</h1>
            {pub && <span className="pub">更新时间：{pub}</span>}
          </div>
          <div className="actions">
            <button type="button" className="primary" disabled={!songs.length} onClick={() => play(songs, 0)}>
              ▶ 播放全部
            </button>
            <button type="button" className="ghost" disabled={!songs.length} onClick={() => play(songs, 0)}>
              + 添加
            </button>
            <button type="button" className="ghost" disabled>
              ♡ 收藏
            </button>
          </div>
        </header>

        {error && <p className="state">{error}</p>}
        {loading && !songs.length && <p className="state">加载中…</p>}

        <div className="table">
          <div className="tr head-row">
            <span className="c-idx">序号</span>
            <span className="c-song">歌曲</span>
            <span className="c-artist">歌手</span>
            <span className="c-time">时长</span>
          </div>
          {songs.map((song, i) => (
            <button key={`${song.id}-${i}`} type="button" className="tr row" onClick={() => play(songs, i)}>
              <span className="c-idx">
                <RankBadge rank={i + 1} />
              </span>
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
      </section>
    </Style>
  )
}

/* 高度对齐 Layout main：padding 80+40 / 播放中 80+120；仅列表区内滚，避免整页滑动 */
const Style = styled.div`
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 32px;
  height: calc(100dvh - 120px);
  overflow: hidden;
  min-height: 0;

  &[data-dock='1'] {
    height: calc(100dvh - 200px);
  }

  .side {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    border-right: 1px solid var(--line);
    padding-right: 16px;
  }

  .tabs {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
    margin-bottom: 14px;
    border-bottom: 1px solid var(--line);

    button {
      flex: 1;
      border: 0;
      background: transparent;
      padding: 12px 8px;
      font-size: 15px;
      color: var(--muted);
      cursor: pointer;
      position: relative;

      &.is-active {
        color: var(--ink);
        font-weight: 700;

        &::after {
          content: '';
          position: absolute;
          left: 18%;
          right: 18%;
          bottom: -1px;
          height: 2px;
          background: var(--purple);
          border-radius: 1px;
        }
      }
    }
  }

  .chart-nav {
    list-style: none;
    margin: 0;
    padding: 0 4px 0 0;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;

    button {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 12px;
      border: 0;
      background: transparent;
      border-radius: 12px;
      cursor: pointer;
      text-align: left;
      transition: background 0.2s;

      &.is-active,
      &:hover {
        background: var(--accent-soft);
      }
    }

    .thumb {
      width: 56px;
      height: 56px;
      border-radius: 10px;
      flex-shrink: 0;
      background: var(--bg-elev) center / cover no-repeat;
      box-shadow: var(--shadow-soft);
    }

    .info {
      min-width: 0;
      display: grid;
      gap: 4px;
    }

    .name {
      font-size: 15px;
      font-weight: 650;
      color: var(--ink);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sub {
      font-size: 13px;
      color: var(--muted);
    }
  }

  .detail {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .head {
    flex-shrink: 0;
  }

  .head-top {
    display: flex;
    align-items: baseline;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 16px;

    h1 {
      margin: 0;
      font-size: 32px;
      font-weight: 800;
      color: var(--ink);
      letter-spacing: -0.02em;
    }

    .pub {
      font-size: 14px;
      color: var(--muted);
    }
  }

  .actions {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;

    button {
      height: 40px;
      padding: 0 20px;
      border-radius: 999px;
      border: 0;
      font-size: 14px;
      cursor: pointer;
    }

    .primary {
      background: var(--grad-btn);
      color: #fff;
      font-weight: 700;
    }

    .ghost {
      background: var(--bg-elev);
      color: var(--text-soft);
      border: 1px solid var(--line);
    }

    button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }

  .state {
    color: var(--muted);
    font-size: 15px;
    flex-shrink: 0;
  }

  .table {
    display: grid;
    align-content: start;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 4px;
  }

  .tr {
    display: grid;
    grid-template-columns: 64px minmax(200px, 2.2fr) minmax(110px, 1fr) minmax(110px, 1.2fr) 72px;
    align-items: center;
    gap: 10px;
    padding: 12px 8px;
    border-bottom: 1px solid var(--line);
  }

  .head-row {
    position: sticky;
    top: 0;
    z-index: 1;
    color: var(--muted);
    font-size: 13px;
    padding-top: 0;
    padding-bottom: 10px;
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    backdrop-filter: blur(8px);
  }

  .row {
    border: 0;
    background: transparent;
    width: 100%;
    text-align: left;
    cursor: pointer;
    font: inherit;
    color: inherit;
    border-radius: 10px;
    transition: background 0.2s;

    &:hover {
      background: var(--accent-soft);
    }
  }

  .c-song {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .cover {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    flex-shrink: 0;
    background: var(--bg-elev) center / cover no-repeat;
  }

  .song-meta {
    min-width: 0;
  }

  .song-title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 550;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    max-width: 100%;
  }

  .tag {
    font-style: normal;
    font-size: 11px;
    padding: 2px 5px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .tag-hq {
    background: var(--grad-btn);
    color: #fff;
    font-weight: 700;
  }

  .tag-mv {
    background: var(--accent-soft);
    color: var(--text-soft);
  }

  .c-artist,
  .c-album,
  .c-time {
    font-size: 14px;
    color: var(--text-soft);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .c-album,
  .c-time {
    color: var(--muted);
  }

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
    height: calc(100dvh - 144px);

    &[data-dock='1'] {
      height: calc(100dvh - 240px);
    }

    .side {
      border-right: 0;
      padding-right: 0;
      border-bottom: 1px solid var(--line);
      padding-bottom: 12px;
      overflow: visible;
      flex: none;
    }

    .chart-nav {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      overflow-y: hidden;
      flex: none;
      padding-bottom: 4px;

      li {
        flex: 0 0 auto;
      }

      button {
        width: 200px;
        padding: 12px;
      }

      .thumb {
        width: 48px;
        height: 48px;
      }
    }

    .c-album {
      display: none;
    }

    .tr {
      grid-template-columns: 52px minmax(0, 1.6fr) minmax(90px, 1fr) 60px;
    }
  }

  @media (max-width: 560px) {
    .c-artist {
      display: none;
    }

    .tr {
      grid-template-columns: 44px minmax(0, 1fr) 56px;
    }

    .head-top h1 {
      font-size: 24px;
    }
  }
`
