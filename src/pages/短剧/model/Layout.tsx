import { Outlet, useLocation } from 'react-router'
import { useEffect, useLayoutEffect, useState } from 'react'
import styled, { createGlobalStyle } from 'styled-components'
import Header from './Header'
import type { NavKey } from '../utils/categories'
import { categoryByPath } from '../utils/categories'

const THEME_BG = '#0a120e'
const MOBILE_MQ = '(max-width: 960px)'

function resolveNav(pathname: string): {
  active: NavKey
  isFeed: boolean
  isPlay: boolean
} {
  const isFeed = pathname === '/short' || pathname === '/short/'
  const isPlay = pathname.startsWith('/short/play')
  if (pathname.startsWith('/short/search') || isPlay) {
    return { active: 'home', isFeed: false, isPlay }
  }
  const cat = categoryByPath(pathname)
  if (cat) return { active: cat.key, isFeed: false, isPlay: false }
  return { active: 'home', isFeed, isPlay: false }
}

export default function Layout() {
  const { pathname } = useLocation()
  const { active, isFeed, isPlay } = resolveNav(pathname)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_MQ).matches : false,
  )

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ)
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  /** 首页 feed / 播放页：锁死视口，仅内部上下滑 */
  const lockViewport = isFeed || isPlay
  const showHeader = !isPlay
  /** PC 首页保留搜索；移动端 feed 用 overlay 样式藏搜索；搜索页本身不再重复 */
  const hideSearch = pathname.startsWith('/short/search') || (isFeed && isMobile)

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = '铭短剧'
    const previousRestoration = history.scrollRestoration
    history.scrollRestoration = 'manual'
    return () => {
      history.scrollRestoration = previousRestoration
    }
  }, [])

  useLayoutEffect(() => {
    const bg = lockViewport ? '#000' : THEME_BG
    document.body.style.background = bg
    document.documentElement.style.background = bg
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', lockViewport ? '#000000' : THEME_BG)
    return () => {
      document.body.style.background = ''
      document.documentElement.style.background = ''
    }
  }, [lockViewport])

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      <Global $lock={lockViewport} />
      <Shell data-lock={lockViewport ? '1' : '0'} data-feed={isFeed || isPlay ? '1' : '0'}>
        {showHeader ? <Header active={active} hideSearch={hideSearch} overlay={isFeed} /> : null}
        <main>
          <Outlet />
        </main>
      </Shell>
    </>
  )
}

const Global = createGlobalStyle<{ $lock: boolean }>`
  html {
    ${(p) =>
      p.$lock
        ? `
      height: 100%;
      height: 100dvh;
      overflow: hidden;
      overscroll-behavior: none;
    `
        : ''}
  }

  body {
    margin: 0;
    background: ${(p) => (p.$lock ? '#000' : THEME_BG)};
    color: #e8f5ee;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    ${(p) =>
      p.$lock
        ? `
      height: 100%;
      height: 100dvh;
      overflow: hidden;
      overscroll-behavior: none;
      position: fixed;
      inset: 0;
      width: 100%;
    `
        : ''}
  }

  #root {
    ${(p) =>
      p.$lock
        ? `
      height: 100%;
      height: 100dvh;
      overflow: hidden;
    `
        : ''}
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
  min-height: 100vh;
  min-height: 100dvh;
  background:
    radial-gradient(ellipse 70% 48% at 18% -12%, rgba(46, 140, 90, 0.18), transparent 70%),
    radial-gradient(ellipse 55% 40% at 88% 8%, rgba(24, 90, 58, 0.12), transparent 65%),
    ${THEME_BG};

  &[data-lock='1'] {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    height: 100dvh;
    min-height: 0;
    max-height: 100dvh;
    overflow: hidden;
    background: #000;
  }

  main {
    min-height: 100vh;
    min-height: 100dvh;
    padding-top: 64px;
  }

  &[data-lock='1'] main {
    height: 100%;
    min-height: 0;
    max-height: 100%;
    padding-top: 0;
    overflow: hidden;
  }

  &[data-feed='1'] main {
    padding-top: 0;
  }

  @media (max-width: 900px) {
    main {
      padding-top: 96px;
    }

    &[data-lock='1'] main,
    &[data-feed='1'] main {
      padding-top: 0;
    }
  }
`
