import { Outlet, useLocation } from 'react-router'
import { useLayoutEffect } from 'react'
import styled, { createGlobalStyle } from 'styled-components'
import Header from './Header'
import Footer from './Footer'
import type { NavKey } from '../utils/types'
import { categoryByPath } from '../utils/categories'

function resolveActive(pathname: string): NavKey {
  if (pathname.startsWith('/video/search')) return 'home'
  if (pathname.startsWith('/video/play')) return 'home'
  if (pathname.startsWith('/video/actor')) return 'actor'
  const cat = categoryByPath(pathname)
  if (cat) return cat.key
  return 'home'
}

export default function Layout() {
  const { pathname } = useLocation()
  const active = resolveActive(pathname)
  const hideFooter = pathname.startsWith('/video/actor')
  const hideSearch = pathname.startsWith('/video/search')

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = '铭影视'
    const previousRestoration = history.scrollRestoration
    history.scrollRestoration = 'manual'
    return () => {
      history.scrollRestoration = previousRestoration
    }
  }, [])

  useLayoutEffect(() => {
    const base =
      (
        {
          home: '#0a0a0c',
          short: '#0c0a12',
          movie: '#0a100e',
          tv: '#0a0c12',
          anime: '#100a10',
          variety: '#100c0a',
          child: '#0a1010',
          music: '#0c0a14',
          doco: '#0e0e0a',
          actor: '#0a0b0e',
        } as Record<NavKey, string>
      )[active] ?? '#0a0a0c'
    document.body.style.background = base
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', base)
    return () => {
      document.body.style.background = ''
    }
  }, [active])

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  useLayoutEffect(() => {
    if (!hideFooter) return
    const prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = prev
      document.body.style.overflow = ''
    }
  }, [hideFooter])

  return (
    <>
      <Global />
      <Shell data-compact={hideFooter ? '1' : '0'} data-theme={active}>
        <Header active={active} hideSearch={hideSearch} />
        <main>
          <Outlet />
        </main>
        {hideFooter ? null : <Footer />}
      </Shell>
    </>
  )
}

const Global = createGlobalStyle`
  @property --theme-glow {
    syntax: '<color>';
    inherits: true;
    initial-value: rgba(232, 165, 75, 0.08);
  }

  @property --theme-glow-2 {
    syntax: '<color>';
    inherits: true;
    initial-value: transparent;
  }

  @property --theme-base {
    syntax: '<color>';
    inherits: true;
    initial-value: #0a0a0c;
  }

  body {
    margin: 0;
    background: #0a0a0c;
    color: #f5f2ea;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
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
`

const Shell = styled.div`
  --theme-glow: rgba(232, 165, 75, 0.08);
  --theme-glow-2: transparent;
  --theme-base: #0a0a0c;

  min-height: 100vh;
  background:
    radial-gradient(ellipse 70% 48% at 18% -12%, var(--theme-glow), transparent 70%),
    radial-gradient(ellipse 55% 40% at 88% 8%, var(--theme-glow-2), transparent 65%),
    var(--theme-base);
  transition:
    --theme-glow 0.55s ease,
    --theme-glow-2 0.55s ease,
    --theme-base 0.55s ease,
    background 0.55s ease;

  /* 顶部分类切换：暗色渐变氛围 */
  &[data-theme='home'] {
    --theme-glow: rgba(232, 165, 75, 0.1);
    --theme-glow-2: rgba(196, 120, 42, 0.05);
    --theme-base: #0a0a0c;
  }

  &[data-theme='short'] {
    --theme-glow: rgba(140, 90, 220, 0.16);
    --theme-glow-2: rgba(90, 40, 140, 0.1);
    --theme-base: #0c0a12;
  }

  &[data-theme='movie'] {
    --theme-glow: rgba(60, 150, 110, 0.14);
    --theme-glow-2: rgba(30, 90, 70, 0.09);
    --theme-base: #0a100e;
  }

  &[data-theme='tv'] {
    --theme-glow: rgba(70, 120, 210, 0.14);
    --theme-glow-2: rgba(40, 70, 140, 0.09);
    --theme-base: #0a0c12;
  }

  &[data-theme='anime'] {
    --theme-glow: rgba(200, 80, 150, 0.14);
    --theme-glow-2: rgba(120, 50, 160, 0.09);
    --theme-base: #100a10;
  }

  &[data-theme='variety'] {
    --theme-glow: rgba(220, 140, 60, 0.13);
    --theme-glow-2: rgba(160, 80, 40, 0.08);
    --theme-base: #100c0a;
  }

  &[data-theme='child'] {
    --theme-glow: rgba(60, 180, 170, 0.13);
    --theme-glow-2: rgba(40, 120, 160, 0.08);
    --theme-base: #0a1010;
  }

  &[data-theme='music'] {
    --theme-glow: rgba(100, 80, 200, 0.15);
    --theme-glow-2: rgba(60, 40, 140, 0.1);
    --theme-base: #0c0a14;
  }

  &[data-theme='doco'] {
    --theme-glow: rgba(140, 130, 90, 0.12);
    --theme-glow-2: rgba(80, 90, 60, 0.08);
    --theme-base: #0e0e0a;
  }

  &[data-theme='actor'] {
    --theme-glow: rgba(120, 130, 150, 0.1);
    --theme-glow-2: rgba(70, 80, 100, 0.06);
    --theme-base: #0a0b0e;
  }

  main {
    min-height: calc(100vh - 140px);
    padding-top: 64px;
  }

  &[data-compact='1'] {
    height: 100dvh;
    max-height: 100dvh;
    overflow: hidden;

    main {
      min-height: 0;
      height: 100dvh;
      padding-top: 64px;
      overflow: hidden;
    }
  }

  @media (max-width: 900px) {
    main {
      padding-top: 96px;
    }

    &[data-compact='1'] main {
      height: 100dvh;
      padding-top: 96px;
    }
  }
`
