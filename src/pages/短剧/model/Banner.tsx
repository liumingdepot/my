import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import styled from 'styled-components'
import type { DramaListItem } from '../utils/server'

type Props = {
  items: DramaListItem[]
  eyebrow?: string
}

export default function Banner({ items, eyebrow = '热门短剧' }: Props) {
  const location = useLocation()
  const from = `${location.pathname}${location.search}`
  const slides = items.filter((i) => i.image_link).slice(0, 6)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [items])

  useEffect(() => {
    if (slides.length <= 1) return
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length)
    }, 5500)
    return () => window.clearInterval(timer)
  }, [slides.length])

  if (!slides.length) return null
  const current = slides[index]!

  return (
    <Hero>
      {slides.map((item, i) => (
        <div
          key={`${item.id}-${i}`}
          className={`bg ${i === index ? 'is-active' : ''}`}
          style={{ backgroundImage: `url(${item.image_link})` }}
        />
      ))}
      <div className="veil" />
      <div className="content">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{current.title}</h1>
        {current.sub_title ? <p className="meta">{current.sub_title}</p> : null}
        <Link className="cta" to={`/short/play/${current.id}`} state={{ from }}>
          立即播放
        </Link>
      </div>
      {slides.length > 1 && (
        <div className="dots">
          {slides.map((item, i) => (
            <button
              key={`${item.id}-dot-${i}`}
              type="button"
              className={i === index ? 'is-active' : ''}
              aria-label={`第 ${i + 1} 张`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </Hero>
  )
}

const Hero = styled.section`
  position: relative;
  width: 100%;
  aspect-ratio: 1080 / 607;
  min-height: 420px;
  max-height: min(86vh, 900px);
  overflow: hidden;
  margin-bottom: 0;

  .bg {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center top;
    opacity: 0;
    transform: scale(1.04);
    transition:
      opacity 0.8s ease,
      transform 6s ease;

    &.is-active {
      opacity: 1;
      transform: scale(1);
    }
  }

  .veil {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(90deg, rgba(10, 10, 12, 0.88) 0%, rgba(10, 10, 12, 0.45) 48%, rgba(10, 10, 12, 0.2) 100%),
      linear-gradient(0deg, rgba(10, 10, 12, 0.92) 0%, transparent 42%);
    pointer-events: none;
  }

  .content {
    position: absolute;
    z-index: 2;
    left: 0;
    right: 0;
    bottom: 18%;
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 20px;
  }

  .eyebrow {
    margin: 0 0 10px;
    font-size: 13px;
    letter-spacing: 0.18em;
    color: #3eba7a;
    text-transform: uppercase;
  }

  h1 {
    margin: 0 0 12px;
    max-width: 14em;
    font-family: ui-serif, 'Songti SC', 'STSong', 'SimSun', serif;
    font-size: clamp(28px, 4.2vw, 48px);
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: 0.04em;
    text-shadow: 0 2px 24px rgba(0, 0, 0, 0.45);
  }

  .meta {
    margin: 0 0 22px;
    max-width: 28em;
    font-size: 14px;
    line-height: 1.5;
    color: rgba(232, 245, 238, 0.72);
  }

  .cta {
    display: inline-flex;
    align-items: center;
    min-height: 42px;
    padding: 0 22px;
    border-radius: 999px;
    background: linear-gradient(145deg, #4fd18a, #3eba7a);
    color: #04120a;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-decoration: none;
    transition: opacity 0.2s;

    &:hover {
      opacity: 0.92;
    }
  }

  .dots {
    position: absolute;
    z-index: 2;
    left: 50%;
    bottom: 28px;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
  }

  .dots button {
    width: 8px;
    height: 8px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.35);
    cursor: pointer;

    &.is-active {
      background: #3eba7a;
      width: 20px;
      border-radius: 4px;
    }
  }

  @media (max-width: 900px) {
    min-height: 320px;
    aspect-ratio: 3 / 4;
    max-height: 72vh;

    .content {
      bottom: 14%;
      padding: 0 14px;
    }

    h1 {
      font-size: 26px;
    }

    .meta {
      font-size: 13px;
      margin-bottom: 16px;
    }

    .dots {
      bottom: 16px;
    }
  }
`
