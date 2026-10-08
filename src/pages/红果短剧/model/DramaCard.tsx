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
    <Card to={`/hongguo/play/${encodeURIComponent(String(item.id))}`} state={{ from }}>
      <div className="poster">
        {item.image_link ? (
          <img src={item.image_link} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <div className="placeholder" />
        )}
        {item.total_num ? <span className="remarks">共 {item.total_num} 集</span> : null}
      </div>
      <h3 title={item.title}>{item.title}</h3>
      <p title={item.sub_title || item.hot_value || ''}>
        {[item.sub_title, item.hot_value].filter(Boolean).join(' · ') || '短剧'}
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
        box-shadow:
          0 12px 32px rgba(0, 0, 0, 0.45),
          0 0 0 1px rgba(232, 165, 75, 0.35);
      }

      h3 {
        color: #e8a54b;
      }
    }
  }

  .poster {
    position: relative;
    width: 100%;
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
