import { Outlet, useLocation } from 'react-router'
import { useLayoutEffect, useState } from 'react'
import styled, { createGlobalStyle } from 'styled-components'
import Header from './Header'
import { FullPlayer, PlayerDock, QueueSheet } from './Player'
import { MusicProvider, useMusic } from '../utils/MusicContext'
import { resolveNav } from '../utils/categories'
import { themeColor, useTheme } from '../utils/theme'

function Shell() {
  const { pathname } = useLocation()
  const active = resolveNav(pathname)
  const { player } = useMusic()
  const { theme, toggleTheme } = useTheme()
  const [full, setFull] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = '铭音乐'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor(theme))
  }, [theme])

  useLayoutEffect(() => {
    if (!full) return
    const html = document.documentElement
    const body = document.body
    const scrollY = window.scrollY
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
    }
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
    return () => {
      html.style.overflow = prev.htmlOverflow
      body.style.overflow = prev.bodyOverflow
      body.style.position = prev.bodyPosition
      body.style.top = prev.bodyTop
      body.style.width = prev.bodyWidth
      window.scrollTo(0, scrollY)
    }
  }, [full])

  return (
    <>
      <Global />
      <Frame data-playing={player.current && !full ? '1' : '0'} data-full={full ? '1' : '0'}>
        {full ? null : <Header active={active} theme={theme} onToggleTheme={toggleTheme} />}
        <main>
          <Outlet />
        </main>
        {full ? null : (
          <PlayerDock
            player={player}
            onOpenFull={() => {
              setQueueOpen(false)
              setFull(true)
            }}
            onOpenQueue={() => setQueueOpen(true)}
          />
        )}
        {full && (
          <FullPlayer player={player} onClose={() => setFull(false)} onToggleTheme={toggleTheme} />
        )}
        {queueOpen && !full && <QueueSheet player={player} onClose={() => setQueueOpen(false)} />}
      </Frame>
    </>
  )
}

export default function Layout() {
  return (
    <MusicProvider>
      <Shell />
    </MusicProvider>
  )
}

const Global = createGlobalStyle`
  :root {
    --bg: #f5f6fb;
    --bg-elev: #ffffff;
    --ink: #0f172a;
    --text-soft: #475569;
    --muted: #94a3b8;
    --line: rgba(15, 23, 42, 0.08);
    --purple: #7c5cfc;
    --purple-soft: #a78bfa;
    --accent: #7c5cfc;
    --accent-ink: #ffffff;
    --accent-soft: rgba(124, 92, 252, 0.12);
    --grad: linear-gradient(90deg, #6366f1, #8b5cf6 45%, #06b6d4);
    --grad-btn: linear-gradient(90deg, #3b82f6, #06b6d4);
    --shadow: 0 10px 30px rgba(99, 102, 241, 0.08);
    --shadow-soft: 0 4px 18px rgba(15, 23, 42, 0.05);
    --cover: linear-gradient(145deg, #ddd6fe, #bfdbfe 55%, #a5f3fc);
    --dock: color-mix(in srgb, var(--bg-elev) 88%, transparent);
    --danger: #e11d48;
    --blob-a: #c4b5fd;
    --blob-b: #93c5fd;
    --blob-c: #a5f3fc;
  }

  html[data-theme='dark'] {
    --bg: #0b1020;
    --bg-elev: #141a2e;
    --ink: #e8eaf2;
    --text-soft: #a0a8c0;
    --muted: #6b7390;
    --line: rgba(255, 255, 255, 0.08);
    --purple: #a78bfa;
    --purple-soft: #c4b5fd;
    --accent: #a78bfa;
    --accent-ink: #0b1020;
    --accent-soft: rgba(167, 139, 250, 0.16);
    --shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
    --shadow-soft: 0 4px 18px rgba(0, 0, 0, 0.25);
    --cover: linear-gradient(145deg, rgba(76, 29, 149, 0.85), rgba(30, 58, 138, 0.7) 55%, rgba(21, 94, 117, 0.65));
    --dock: color-mix(in srgb, var(--bg-elev) 86%, transparent);
    --danger: #fb7185;
    --blob-a: #4c1d95;
    --blob-b: #1e3a8a;
    --blob-c: #155e75;
  }

  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    color-scheme: light;
  }

  html[data-theme='dark'] body {
    color-scheme: dark;
  }

  * {
    box-sizing: border-box;
  }

  img {
    max-width: 100%;
  }

  a {
    color: inherit;
  }

  button {
    font-family: inherit;
  }
`

const Frame = styled.div`
  position: relative;
  z-index: 0;
  min-height: 100vh;
  color: var(--ink);
  background: transparent;

  &::before,
  &::after {
    content: '';
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
  }

  &::before {
    background-image:
      linear-gradient(var(--line) 1px, transparent 1px),
      linear-gradient(90deg, var(--line) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(ellipse 80% 70% at 50% 18%, #000 20%, transparent 75%);
    opacity: 0.55;
  }

  &::after {
    background:
      radial-gradient(420px 420px at 92% -6%, var(--blob-a), transparent 68%),
      radial-gradient(360px 360px at -6% 24%, var(--blob-b), transparent 70%),
      radial-gradient(300px 300px at 72% 96%, var(--blob-c), transparent 68%);
    opacity: 0.4;
    filter: blur(40px);
  }

  html[data-theme='dark'] &::after {
    opacity: 0.32;
  }

  main {
    box-sizing: border-box;
    width: min(90vw, 1400px);
    max-width: 1400px;
    min-height: calc(100vh - 64px);
    padding: 80px 0 40px;
    margin: 0 auto;
  }

  &[data-playing='1'] main {
    padding-bottom: 120px;
  }

  @media (max-width: 900px) {
    main {
      width: min(90vw, calc(100vw - 24px));
      padding: 112px 0 32px;
    }

    &[data-playing='1'] main {
      padding-bottom: 128px;
    }
  }
`
