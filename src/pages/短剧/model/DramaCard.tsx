import { Link, useLocation } from 'react-router'
import styled from 'styled-components'
import type { DramaListItem } from '../utils/server'

type Props = {
  item: DramaListItem
}

export default function DramaCard({ item }: Props) {
  const location = useLocation()
  const from = `${location.pathname}${location.search}`

  return (
    <Card to={`/short/play/${item.id}`} state={{ from }}>
      <div className="poster">
        {item.image_link ? (
          <img src={item.image_link} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <div className="placeholder" />
        )}
        {item.total_num ? <span className="badge">{item.total_num}</span> : null}
        {item.hot_value ? <span className="hot">{item.hot_value}</span> : null}
      </div>
      <h3 title={item.title}>{item.title}</h3>
      <p>{item.sub_title || '短剧'}</p>
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
    transition: transform 0.2s;

    &:hover {
      transform: translateY(-3px);

      h3 {
        color: #3eba7a;
      }
    }
  }

  .poster {
    position: relative;
    width: 100%;
    aspect-ratio: 2 / 3;
    border-radius: 8px;
    overflow: hidden;
    background: #1a1a1f;
    contain: layout paint;

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
    z-index: 1;
    top: 6px;
    right: 6px;
    max-width: 46%;
    padding: 2px 5px;
    border-radius: 4px;
    background: #ff650f;
    font-size: 10px;
    font-weight: 700;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hot {
    position: absolute;
    z-index: 1;
    right: 6px;
    bottom: 6px;
    max-width: calc(100% - 12px);
    font-size: 11px;
    font-weight: 700;
    color: #fff;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  h3 {
    margin: 8px 0 3px;
    height: 1.35em;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.35;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.15s;
  }

  p {
    margin: 0;
    height: 1.3em;
    font-size: 11px;
    line-height: 1.3;
    color: rgba(232, 245, 238, 0.45);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-width: 600px) {
    h3 {
      font-size: 12px;
      margin-top: 6px;
    }

    p {
      font-size: 10px;
    }
  }
`
