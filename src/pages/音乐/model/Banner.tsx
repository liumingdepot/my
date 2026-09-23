import { useEffect, useState } from 'react'
import styled from 'styled-components'
import type { Song } from '../utils/types'

export type BannerSlide = {
  id: string
  title: string
  subtitle: string
  cover: string
  songs: Song[]
  songIndex: number
  kind: 'song' | 'artist'
}

type Props = {
  items: BannerSlide[]
  onPlay: (songs: Song[], index: number) => void
}

export default function Banner({ items, onPlay }: Props) {
  const slides = items.filter((i) => i.cover).slice(0, 6)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [items])

  useEffect(() => {
    if (slides.length <= 1) return
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [slides.length])

  if (!slides.length) return null
  const current = slides[index]!

  return (
    <Hero>
      {slides.map((item, i) => (
        <div
          key={`${item.kind}-${item.id}-${i}`}
          className={`bg ${i === index ? 'is-active' : ''}`}
          style={{ backgroundImage: `url(${item.cover})` }}
        />
      ))}
      <div className="veil" />
      <div className="content">
        <p className="eyebrow">{current.kind === 'artist' ? '著名歌手' : '精选热歌'}</p>
        <h2>{current.title}</h2>
        <p className="meta">{current.subtitle}</p>
        <button
          type="button"
          className="cta"
          onClick={() => onPlay(current.songs, current.songIndex)}
          disabled={!current.songs.length}
        >
          ▶ 立即播放
        </button>
      </div>
      {slides.length > 1 && (
        <div className="dots">
          {slides.map((item, i) => (
            <button
              key={`${item.kind}-${item.id}-dot-${i}`}
              type="button"
              className={i === index ? 'is-active' : ''}
              aria-label={`第 ${i + 1} 张`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            className="nav prev"
            aria-label="上一张"
            onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
          >
            ‹
          </button>
          <button
            type="button"
            className="nav next"
            aria-label="下一张"
            onClick={() => setIndex((i) => (i + 1) % slides.length)}
          >
            ›
          </button>
        </>
      )}
    </Hero>
  )
}

const Hero = styled.section`
  position: relative;
  width: 100%;
  aspect-ratio: 21 / 9;
  min-height: 220px;
  max-height: 360px;
  margin-bottom: 36px;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  background: var(--cover);

  .bg {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center center;
    opacity: 0;
    transform: scale(1.08);
    transition:
      opacity 0.9s ease,
      transform 5.5s ease;

    &.is-active {
      opacity: 1;
      transform: scale(1);
    }
  }

  .veil {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(90deg, rgba(11, 16, 32, 0.88) 0%, rgba(11, 16, 32, 0.45) 46%, rgba(11, 16, 32, 0.15) 100%),
      linear-gradient(0deg, rgba(11, 16, 32, 0.55) 0%, transparent 42%);
  }

  .content {
    position: relative;
    z-index: 2;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 28px 36px 36px;
    max-width: 560px;
    color: #fff;
  }

  .eyebrow {
    margin: 0 0 8px;
    font-size: 12px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #a5f3fc;
  }

  h2 {
    margin: 0;
    font-family: ui-serif, "Songti SC", "STSong", "SimSun", serif;
    font-size: clamp(24px, 3.2vw, 36px);
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: 0.04em;
    text-shadow: 0 2px 16px rgba(0, 0, 0, 0.35);
  }

  .meta {
    margin: 10px 0 0;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.72);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cta {
    margin-top: 18px;
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 40px;
    padding: 0 22px;
    border: 0;
    border-radius: 999px;
    background: var(--grad-btn);
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.04em;
    cursor: pointer;
    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.35);
    transition:
      transform 0.2s,
      opacity 0.2s;

    &:hover:not(:disabled) {
      transform: translateY(-1px);
      opacity: 0.95;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .dots {
    position: absolute;
    z-index: 3;
    right: 28px;
    bottom: 22px;
    display: flex;
    gap: 7px;

    button {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      border: 0;
      padding: 0;
      background: rgba(255, 255, 255, 0.35);
      cursor: pointer;
      transition:
        width 0.2s,
        background 0.2s,
        border-radius 0.2s;

      &.is-active {
        width: 20px;
        border-radius: 4px;
        background: #fff;
      }
    }
  }

  .nav {
    position: absolute;
    z-index: 3;
    top: 50%;
    transform: translateY(-50%);
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 50%;
    background: rgba(11, 16, 32, 0.45);
    color: #fff;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    display: grid;
    place-items: center;
    opacity: 0;
    transition:
      opacity 0.2s,
      background 0.2s;
    backdrop-filter: blur(8px);

    &:hover {
      background: rgba(11, 16, 32, 0.7);
    }

    &.prev {
      left: 14px;
    }

    &.next {
      right: 14px;
    }
  }

  &:hover .nav {
    opacity: 1;
  }

  @media (max-width: 720px) {
    aspect-ratio: 16 / 10;
    min-height: 180px;
    max-height: 260px;
    margin-bottom: 28px;
    border-radius: 12px;

    .content {
      padding: 18px 18px 28px;
      max-width: none;
    }

    .eyebrow {
      font-size: 11px;
      letter-spacing: 0.14em;
    }

    h2 {
      font-size: clamp(20px, 6vw, 26px);
    }

    .meta {
      font-size: 12px;
      margin-top: 6px;
    }

    .cta {
      margin-top: 12px;
      height: 36px;
      padding: 0 16px;
      font-size: 13px;
    }

    .dots {
      right: 14px;
      bottom: 12px;
    }

    .nav {
      display: none;
    }
  }
`
