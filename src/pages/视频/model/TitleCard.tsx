import { Link } from 'react-router'
import styled from 'styled-components'
import { matchPath } from '../utils/match'
import type { QqTitle } from '../utils/types'

type Props = {
  item: QqTitle
}

/** 手动搜索用；片库点击请用 matchPath */
export function searchPath(title: string) {
  return `/video/search?q=${encodeURIComponent(title)}`
}

export default function TitleCard({ item }: Props) {
  return (
    <Card to={matchPath(item)}>
      <div className="poster">
        {item.pic ? (
          <img src={item.pic} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <div className="placeholder" />
        )}
        <span className="badge">智能匹配</span>
        {item.sub && <span className="remarks">{item.sub}</span>}
      </div>
      <h3 title={item.title}>{item.title}</h3>
      <p>匹配全网播放源</p>
    </Card>
  )
}

const Card = styled(Link)`
  display: block;
  width: 100%;
  min-width: 0;
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
    aspect-ratio: 1080 / 607;
    border-radius: 10px;
    overflow: hidden;
    background: #1a1a1f;
    contain: layout paint;
    transition: box-shadow 0.25s ease;

    img,
    .placeholder {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
    }

    img {
      object-fit: cover;
      object-position: center center;
    }

    .placeholder {
      background: linear-gradient(160deg, #1e1e24, #121216);
    }
  }

  .badge {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 3px 7px;
    border-radius: 6px;
    background: rgba(232, 165, 75, 0.92);
    color: #0a0a0c;
    font-size: 11px;
    font-weight: 700;
  }

  .remarks {
    position: absolute;
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

  @media (max-width: 900px) {
    .poster {
      border-radius: 8px;
    }

    .badge {
      top: 6px;
      right: 6px;
      padding: 2px 5px;
      font-size: 10px;
    }

    .remarks {
      display: none;
    }

    h3 {
      margin: 8px 0 2px;
      font-size: 13px;
    }

    p {
      font-size: 11px;
    }
  }
`
