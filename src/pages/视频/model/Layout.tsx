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
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0a0a0c')
    const previousRestoration = history.scrollRestoration
    history.scrollRestoration = 'manual'
    return () => {
      history.scrollRestoration = previousRestoration
    }
  }, [])

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
      <Shell data-compact={hideFooter ? '1' : '0'}>
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
  min-height: 100vh;
  background:
    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(232, 165, 75, 0.08), transparent),
    #0a0a0c;

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
