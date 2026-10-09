import { useNavigate } from 'react-router'
import styled from 'styled-components'
import { catDots, imgUrl, type MacItem } from '../utils/server'
import { favs } from '../utils/history'
import { PINK } from '../utils/theme'
import { useState } from 'react'

type Props = {
  item: MacItem
  rank?: number
}

const DramaCard = ({ item, rank }: Props) => {
  const nav = useNavigate()
  const [isFav, setIsFav] = useState(() => favs.has(item.series_id))
  const cat = catDots(item.category)
  const heat = item.hot || ''

  const onFav = (e: React.MouseEvent) => {
    e.stopPropagation()
    const on = favs.toggle({
      sid: item.series_id,
      title: item.title,
      cover: item.cover,
      cat: catDots(item.category),
    })
    setIsFav(on)
  }

  return (
    <Style
      className="card"
      onClick={() => nav(`/test/detail/${item.series_id}`)}
    >
      <div className="poster">
        {rank ? <div className={`rk ${rank <= 3 ? 'top3' : ''}`}>{rank}</div> : null}
        {item.episode_cnt ? <div className="pill eps">全 {item.episode_cnt} 集</div> : null}
        {heat ? <div className="pill heat">{heat}</div> : null}
        <img
          loading="lazy"
          src={imgUrl(item.cover)}
          alt=""
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.visibility = 'hidden'
          }}
        />
        <div className="playov">
          <div className="cir">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
              <path d="M8 5.5v13c0 .8.9 1.3 1.6.9l10.2-6.5c.6-.4.6-1.4 0-1.8L9.6 4.6c-.7-.4-1.6.1-1.6.9z" />
            </svg>
          </div>
        </div>
      </div>
      <div className="crow">
        <div className="ctitle">{item.title}</div>
        <button
          type="button"
          className={`favbtn ${isFav ? 'on' : ''}`}
          title="收藏"
          onClick={onFav}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill={isFav ? PINK : 'none'}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          >
            <path d="M6 4h12v17l-6-4.2L6 21V4z" />
          </svg>
        </button>
      </div>
      <div className="ctags">{cat || (item.score ? `评分 ${item.score}` : '')}</div>
    </Style>
  )
}

export default DramaCard

const Style = styled.div`
  cursor: pointer;

  .poster {
    position: relative;
    aspect-ratio: 7/10;
    border-radius: 9px;
    overflow: hidden;
    background: linear-gradient(160deg, #e8e9ee, #d9dbe2);
  }
  .poster img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.25s;
  }
  &:hover .poster img {
    transform: scale(1.04);
  }
  .rk {
    position: absolute;
    top: 5px;
    left: 9px;
    font-size: 20px;
    font-weight: 800;
    font-style: italic;
    color: #fff;
    text-shadow: 0 1px 5px rgba(0, 0, 0, 0.55);
    z-index: 2;
  }
  .rk.top3 {
    font-size: 26px;
  }
  .pill {
    position: absolute;
    z-index: 2;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    font-size: 11px;
    padding: 2.5px 8px;
    border-radius: 999px;
    backdrop-filter: blur(2px);
  }
  .pill.eps {
    top: 7px;
    right: 7px;
  }
  .pill.heat {
    bottom: 7px;
    left: 7px;
  }
  .playov {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.12);
    opacity: 0;
    transition: 0.16s;
  }
  &:hover .playov {
    opacity: 1;
  }
  .playov .cir {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: var(--pink);
    display: grid;
    place-items: center;
    box-shadow: 0 4px 14px rgba(255, 46, 95, 0.45);
  }
  .crow {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-top: 9px;
  }
  .ctitle {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.45;
    color: var(--txt);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .favbtn {
    border: 0;
    background: none;
    cursor: pointer;
    color: #b6bac4;
    padding: 2px;
    flex: none;
  }
  .favbtn.on,
  .favbtn:hover {
    color: var(--pink);
  }
  .ctags {
    margin-top: 4px;
    font-size: 12px;
    color: #9298a5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`
