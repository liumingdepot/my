import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import styled from 'styled-components'
import { searchMusic } from '../utils/server'
import { useMusic } from '../utils/MusicContext'
import type { Song } from '../utils/types'

export default function SearchPage() {
  const { play } = useMusic()
  const [params] = useSearchParams()
  const query = params.get('q')?.trim() || '周杰伦'
  const [pn, setPn] = useState(0)
  const [list, setList] = useState<Song[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load(q: string, page: number, append = false) {
    setLoading(true)
    setError('')
    try {
      const res = await searchMusic(q, page)
      setList((prev) => (append ? [...prev, ...res.list] : res.list))
      setPn(page)
    } catch {
      setError('搜索失败，请稍后再试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setList([])
    void load(query, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  return (
    <Style>
      <div className="detail-head">
        <span
          className="cover-lg"
          style={{ backgroundImage: list[0]?.cover ? `url(${list[0].cover})` : undefined }}
        />
        <div>
          <p className="eyebrow">搜索结果</p>
          <h1>{query}</h1>
          <p className="count">{list.length ? `已加载 ${list.length} 首` : loading ? '加载中…' : '暂无结果'}</p>
          <button type="button" className="play-all" disabled={!list.length} onClick={() => play(list, 0)}>
            ▶ 播放全部
          </button>
        </div>
      </div>

      {error && <p className="state">{error}</p>}

      {list.length > 0 && (
        <div className="table">
          <div className="tr head-row">
            <span className="c-idx">序号</span>
            <span className="c-song">歌曲</span>
            <span className="c-artist">歌手</span>
            <span className="c-time">时长</span>
          </div>
          {list.map((song, i) => (
            <button key={`${song.id}-${i}`} type="button" className="tr row" onClick={() => play(list, i)}>
              <span className="c-idx">{i + 1}</span>
              <span className="c-song">
                <span className="cover" style={{ backgroundImage: song.cover ? `url(${song.cover})` : undefined }} />
                <span className="song-title">{song.title}</span>
                {song.lossless && <em className="tag tag-hq">无损</em>}
                {song.hasMv && <em className="tag tag-mv">MV</em>}
              </span>
              <span className="c-artist">{song.artist}</span>
              <span className="c-time">{song.duration || '—'}</span>
            </button>
          ))}
        </div>
      )}

      {!loading && !error && !list.length && <p className="state">没有找到相关歌曲</p>}

      {list.length > 0 && (
        <button
          type="button"
          className="more"
          disabled={loading}
          onClick={() => void load(query, pn + 1, true)}
        >
          {loading ? '加载中…' : '加载更多'}
        </button>
      )}
    </Style>
  )
}

const Style = styled.div`
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

    .eyebrow {
      margin: 0 0 6px;
      font-size: 12px;
      letter-spacing: 0.08em;
      color: var(--muted);
      text-transform: uppercase;
    }

    h1 {
      margin: 0 0 8px;
      font-size: 24px;
      line-height: 1.3;
      color: var(--ink);
    }

    .count {
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

  .state {
    color: var(--muted);
    font-size: 14px;
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
    padding: 12px 18px;
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
    gap: 10px;
    min-width: 0;
  }

  .cover {
    width: 40px;
    height: 40px;
    border-radius: 6px;
    flex-shrink: 0;
    background: var(--bg-elev) center / cover no-repeat;
    border: 1px solid rgba(255, 255, 255, 0.06);
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

  .more {
    display: block;
    margin: 18px auto 0;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(245, 242, 234, 0.65);
    border-radius: 999px;
    padding: 8px 20px;
    cursor: pointer;

    &:hover {
      border-color: rgba(124, 92, 252, 0.4);
      color: var(--purple);
    }

    &:disabled {
      opacity: 0.6;
    }
  }

  @media (max-width: 800px) {
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
    .detail-head .cover-lg {
      width: 120px;
      height: 120px;
    }

    .c-artist {
      display: none;
    }

    .tr {
      grid-template-columns: 40px minmax(0, 1fr) 52px;
    }

    .cover {
      width: 36px;
      height: 36px;
    }
  }
`
