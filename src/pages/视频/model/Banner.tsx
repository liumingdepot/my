import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import styled from 'styled-components'
import type { QqTitle } from '../utils/types'
import { searchPath } from './TitleCard'

type Props = {
  items: QqTitle[]
  eyebrow?: string
}

export default function Banner({ items, eyebrow = '热播推荐' }: Props) {
  const slides = items.filter((i) => i.pic).slice(0, 6)
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
  const to = searchPath(current.title)

  return (
    <Hero>
      {slides.map((item, i) => (
        <div
          key={`${item.cid || item.title}-${i}`}
          className={`bg ${i === index ? 'is-active' : ''}`}
          style={{ backgroundImage: `url(${item.pic})` }}
        />
      ))}
      <div className="veil" />
      <div className="content">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{current.title}</h1>
        {current.sub ? <p className="meta">{current.sub}</p> : null}
        <Link className="cta" to={to}>
          搜索播放源
        </Link>
      </div>
      {slides.length > 1 && (
        <div className="dots">
          {slides.map((item, i) => (
            <button
              key={`${item.cid || item.title}-dot-${i}`}
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
    background-position: center center;
    opacity: 0;
    transform: scale(1.06);
    transition: opacity 1s ease, transform 6s ease;

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
      linear-gradient(0deg, rgba(10, 10, 12, 0.35) 0%, transparent 38%),
      linear-gradient(180deg, rgba(10, 10, 12, 0.45) 0%, transparent 18%);
  }

  .content {
    position: relative;
    z-index: 2;
    width: min(640px, calc(100% - 40px));
    margin-left: max(20px, calc((100% - 90vw) / 2 + 28px));
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding-bottom: 180px;
  }

  .eyebrow {
    margin: 0 0 10px;
    font-size: 13px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #e8a54b;
  }

  h1 {
    margin: 0;
    font-family: 'Noto Serif SC', 'Songti SC', serif;
    font-size: clamp(32px, 5vw, 52px);
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: 0.04em;
  }

  .meta {
    margin: 14px 0 0;
    font-size: 14px;
    color: rgba(245, 242, 234, 0.7);
  }

  .cta {
    margin-top: 24px;
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    height: 44px;
    padding: 0 28px;
    border-radius: 8px;
    background: #e8a54b;
    color: #0a0a0c;
    font-weight: 700;
    font-size: 15px;
    text-decoration: none;
    transition: transform 0.2s, filter 0.2s;

    &:hover {
      transform: translateY(-1px);
      filter: brightness(1.05);
    }
  }

  .dots {
    position: absolute;
    z-index: 2;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;

    button {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      border: 0;
      padding: 0;
      background: rgba(255, 255, 255, 0.3);
      cursor: pointer;

      &.is-active {
        background: #e8a54b;
        width: 22px;
        border-radius: 4px;
      }
    }
  }

  @media (max-width: 900px) {
    aspect-ratio: auto;
    min-height: 52vw;
    max-height: 62vh;
    height: min(62vh, 480px);

    .veil {
      background:
        linear-gradient(180deg, rgba(10, 10, 12, 0.55) 0%, transparent 28%),
        linear-gradient(0deg, rgba(10, 10, 12, 0.88) 0%, rgba(10, 10, 12, 0.35) 42%, transparent 70%),
        linear-gradient(90deg, rgba(10, 10, 12, 0.55) 0%, transparent 60%);
    }

    .content {
      width: auto;
      max-width: none;
      margin: 0;
      padding: 0 16px 88px;
      justify-content: flex-end;
    }

    .eyebrow {
      margin-bottom: 6px;
      font-size: 11px;
      letter-spacing: 0.16em;
    }

    h1 {
      font-size: clamp(22px, 7vw, 30px);
      line-height: 1.25;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .meta {
      margin-top: 8px;
      font-size: 12px;
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .cta {
      margin-top: 14px;
      height: 40px;
      padding: 0 20px;
      font-size: 14px;
      border-radius: 8px;
    }

    .dots {
      bottom: 16px;
      gap: 6px;

      button {
        width: 6px;
        height: 6px;

        &.is-active {
          width: 16px;
        }
      }
    }
  }
`
