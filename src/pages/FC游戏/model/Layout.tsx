import { useLayoutEffect } from 'react'
import { Outlet } from 'react-router'
import styled, { createGlobalStyle } from 'styled-components'
import { ThemeToggle } from '../../音乐/utils/ThemeToggle'
import { themeColor, useTheme } from '../../音乐/utils/theme'

/** FC 游戏模块外壳：与首页共用主题变量，并提供深浅色切换。 */
export default function Layout() {
  const { theme, toggleTheme } = useTheme()

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor(theme))
  }, [theme])

  return (
    <>
      <Global />
      <Outlet context={{ theme, toggleTheme }} />
    </>
  )
}

export function GameThemeToggle({
  onToggle,
  className,
}: {
  onToggle: () => void
  className?: string
}) {
  return <ThemeToggle className={className} onClick={onToggle} />
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
    --shadow: 0 10px 30px rgba(99, 102, 241, 0.08);
    --shadow-soft: 0 4px 18px rgba(15, 23, 42, 0.05);
    --amber: #f59e0b;
    --amber-soft: rgba(245, 158, 11, 0.16);
    --danger: #e11d48;
    --blob-a: #c4b5fd;
    --blob-b: #93c5fd;
    --blob-c: #a5f3fc;
    --cover-ph: #e2e8f0;
    --font: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
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
    --amber: #fbbf24;
    --amber-soft: rgba(251, 191, 36, 0.18);
    --danger: #fb7185;
    --blob-a: #4c1d95;
    --blob-b: #1e3a8a;
    --blob-c: #155e75;
    --cover-ph: #1a2238;
  }

  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: var(--font);
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

export const GameFrame = styled.div`
  position: relative;
  z-index: 0;
  color: var(--ink);
  background: transparent;
  font-family: var(--font);

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
    opacity: 0.5;
  }

  &::after {
    background:
      radial-gradient(420px 420px at 92% -6%, var(--blob-a), transparent 68%),
      radial-gradient(360px 360px at -6% 24%, var(--blob-b), transparent 70%),
      radial-gradient(300px 300px at 72% 96%, var(--blob-c), transparent 68%);
    opacity: 0.38;
    filter: blur(40px);
  }

  html[data-theme='dark'] &::after {
    opacity: 0.3;
  }
`
