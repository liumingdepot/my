import { useEffect, useLayoutEffect, useState } from 'react'
import { Link } from 'react-router'
import styled from 'styled-components'
import DomainSelect from './DomainSelect'
import { WORKS_PATH } from './works'

const TYPE_PHRASES = ['你好', '欢迎访问', 'Hello', 'Welcome'] as const

function useTypeCycle(phrases: readonly string[]) {
  const [text, setText] = useState('')

  useEffect(() => {
    let cancelled = false
    let timer = 0

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timer = window.setTimeout(resolve, ms)
      })

    const run = async () => {
      while (!cancelled) {
        for (const phrase of phrases) {
          for (let i = 1; i <= phrase.length; i++) {
            if (cancelled) return
            setText(phrase.slice(0, i))
            await wait(120)
          }
          await wait(1400)
          for (let i = phrase.length - 1; i >= 0; i--) {
            if (cancelled) return
            setText(phrase.slice(0, i))
            await wait(60)
          }
          await wait(320)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [phrases])

  return text
}

/** 首页：定死单屏首屏，不显示顶栏，不可向下滚动 */
export default function HomePage() {
  const typed = useTypeCycle(TYPE_PHRASES)

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = '首页 · 刘铭'
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.scrollTo(0, 0)
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  return (
    <Style>
      <section className="hero" aria-label="首页首屏">
        <div className="hero-bg" aria-hidden="true">
          <img src="/home-hero.jpg" alt="" />
          <div className="hero-veil" />
        </div>

        <div className="hero-center">
          <p className="hero-brand">liuming</p>
          <h1 className="type-line" aria-live="polite">
            <span className="type-text">{typed}</span>
            <span className="type-cursor" aria-hidden="true" />
          </h1>
          <p className="hero-sub">个人开发者 · 作品仅供学习交流</p>
          <div className="hero-cta">
            <Link className="btn btn-primary" to={WORKS_PATH}>
              浏览作品
            </Link>
            <Link className="btn btn-ghost" to="/home">
              个人简历
            </Link>
          </div>
        </div>
      </section>

      <DomainSelect />
    </Style>
  )
}

const Style = styled.div`
  --ink: #0b1220;
  --text: #e8eef8;
  --text-soft: rgba(232, 238, 248, 0.72);
  --muted: rgba(232, 238, 248, 0.48);
  --line: rgba(255, 255, 255, 0.14);
  --accent: #7dd3c0;
  --font: 'Outfit', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  --display: 'Instrument Serif', 'Songti SC', 'STSong', serif;

  height: 100svh;
  background: var(--ink);
  color: var(--text);
  font-family: var(--font);
  overflow: hidden;

  .hero {
    position: relative;
    display: grid;
    grid-template-rows: 1fr;
    height: 100svh;
    width: 100%;
    overflow: hidden;
    isolation: isolate;
  }

  .hero-bg {
    position: absolute;
    inset: 0;
    z-index: 0;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center 40%;
      transform: scale(1.04);
      animation: hero-drift 28s ease-in-out infinite alternate;
    }
  }

  .hero-veil {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(6, 10, 18, 0.55) 0%, rgba(6, 10, 18, 0.28) 42%, rgba(6, 10, 18, 0.72) 100%),
      radial-gradient(80% 60% at 50% 45%, rgba(8, 16, 28, 0.15), rgba(8, 16, 28, 0.72));
  }

  .hero-center {
    position: relative;
    z-index: 2;
    width: min(92vw, 920px);
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 48px 0 72px;
    animation: rise 1.1s 0.12s ease both;
  }

  .hero-brand {
    margin: 0 0 18px;
    font-family: var(--display);
    font-size: clamp(56px, 11vw, 104px);
    font-weight: 400;
    letter-spacing: 0.18em;
    line-height: 1;
    color: #fff;
    text-indent: 0.18em;
  }

  .type-line {
    margin: 0;
    min-height: 1.35em;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    font-family: var(--display);
    font-size: clamp(28px, 5.2vw, 48px);
    font-weight: 400;
    font-style: italic;
    letter-spacing: 0.08em;
    color: color-mix(in srgb, var(--accent) 88%, #fff);
  }

  .type-text {
    white-space: pre;
  }

  .type-cursor {
    width: 2px;
    height: 0.92em;
    margin-left: 4px;
    background: color-mix(in srgb, var(--accent) 90%, #fff);
    border-radius: 1px;
    animation: blink 1s step-end infinite;
  }

  .hero-sub {
    margin: 22px 0 0;
    color: var(--text-soft);
    font-size: 15px;
    letter-spacing: 0.18em;
  }

  .hero-cta {
    margin-top: 34px;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }

  .btn {
    min-height: 44px;
    padding: 0 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    text-decoration: none;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.08em;
    transition:
      transform 0.2s,
      background 0.2s,
      border-color 0.2s,
      color 0.2s;
    cursor: pointer;
    border: none;
    appearance: none;
  }

  .btn-primary {
    background: color-mix(in srgb, var(--accent) 88%, #fff);
    color: #082018;

    &:hover {
      transform: translateY(-2px);
      background: #fff;
    }
  }

  .btn-ghost {
    border: 1px solid var(--line);
    color: var(--text);
    background: rgba(255, 255, 255, 0.04);

    &:hover {
      transform: translateY(-2px);
      border-color: rgba(255, 255, 255, 0.35);
      background: rgba(255, 255, 255, 0.1);
    }
  }

  @keyframes blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(18px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes hero-drift {
    from {
      transform: scale(1.04) translate3d(0, 0, 0);
    }
    to {
      transform: scale(1.08) translate3d(0, -1.2%, 0);
    }
  }

  @media (max-width: 560px) {
    .hero-brand {
      letter-spacing: 0.12em;
      text-indent: 0.12em;
    }

    .hero-sub {
      letter-spacing: 0.1em;
    }

    .hero-cta {
      width: 100%;

      .btn {
        flex: 1;
      }
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hero-bg img,
    .type-cursor,
    .hero-center {
      animation: none;
    }

    .btn {
      transition: none;
    }

    .btn:hover {
      transform: none;
    }
  }
`