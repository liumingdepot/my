import { Link } from 'react-router'
import styled from 'styled-components'
import type { VodItem } from '../utils/types'
import { saveMergedEntries } from '../utils/merge'
import { scoreOf } from '../utils/parse'

type Props = {
  item: VodItem
  rank?: number
  /** 点击时回调（如搜索页中断后续请求），在写入 mirrors 之后触发 */
  onSelect?: (item: VodItem) => void
}

export default function VodCard({ item, rank, onSelect }: Props) {
  const score = scoreOf(item)
  const to = `/video/play/${encodeURIComponent(item.source)}/${item.vod_id}`
  const entries = item.mergedEntries?.length
    ? item.mergedEntries
    : [{ source: item.source, vod_id: item.vod_id }]
  const sources = item.mergedSources?.length
    ? item.mergedSources
    : entries.map((e) => e.source)
  const sourceLabel = sources.length > 1 ? `${sources.length} 源` : sources[0]

  return (
    <Card
      to={to}
      state={{ mirrors: entries }}
      onClick={() => {
        saveMergedEntries(entries)
        onSelect?.(item)
      }}
    >
      <div className="poster">
        {item.vod_pic ? (
          <img src={item.vod_pic} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <div className="placeholder" />
        )}
        {rank != null && <span className="rank">{rank}</span>}
        {score > 0 && <span className="score">{score.toFixed(1)}</span>}
        {item.vod_remarks && <span className="remarks">{item.vod_remarks}</span>}
      </div>
      <h3 title={item.vod_name}>{item.vod_name}</h3>
      <p title={sources.join(' · ')}>
        {[item.vod_year, item.type_name, sourceLabel].filter(Boolean).join(' · ')}
      </p>
    </Card>
  )
}

const Card = styled(Link)`
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  text-decoration: none;
  color: inherit;
  -webkit-tap-highlight-color: transparent;

  @media (hover: hover) {
    transition: transform 0.25s ease;

    &:hover {
      transform: translateY(-4px);

      .poster {
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(232, 165, 75, 0.35);
      }

      h3 {
        color: #e8a54b;
      }
    }
  }

  .poster {
    position: relative;
    width: 100%;
    /* 2:3，用 padding 兜底，避免部分浏览器被大图撑破 */
    aspect-ratio: 2 / 3;
    height: 0;
    padding-bottom: 150%;
    border-radius: 10px;
    overflow: hidden;
    background: #1a1a1f;
    transition: box-shadow 0.25s ease;

    @supports (aspect-ratio: 2 / 3) {
      height: auto;
      padding-bottom: 0;
    }

    img,
    .placeholder {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
      border: 0;
    }

    img {
      object-fit: cover;
      object-position: center center;
    }

    .placeholder {
      background: linear-gradient(160deg, #1e1e24, #121216);
    }
  }

  .rank {
    position: absolute;
    z-index: 1;
    top: 8px;
    left: 8px;
    min-width: 26px;
    height: 26px;
    padding: 0 6px;
    display: grid;
    place-items: center;
    border-radius: 6px;
    background: rgba(10, 10, 12, 0.85);
    color: #e8a54b;
    font-weight: 700;
    font-size: 13px;
  }

  .score {
    position: absolute;
    z-index: 1;
    top: 8px;
    right: 8px;
    padding: 3px 7px;
    border-radius: 6px;
    background: rgba(232, 165, 75, 0.92);
    color: #0a0a0c;
    font-size: 12px;
    font-weight: 700;
  }

  .remarks {
    position: absolute;
    z-index: 1;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 20px 8px 8px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.85));
    font-size: 12px;
    color: #f5f2ea;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  h3 {
    margin: 10px 0 4px;
    height: 1.35em;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.35;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.2s;
  }

  p {
    margin: 0;
    height: 1.3em;
    font-size: 12px;
    line-height: 1.3;
    color: rgba(245, 242, 234, 0.45);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-width: 600px) {
    .poster {
      border-radius: 8px;
    }

    h3 {
      margin-top: 8px;
      font-size: 13px;
    }

    p {
      font-size: 11px;
    }
  }
`
