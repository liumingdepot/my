import { Outlet, useLocation } from 'react-router'
import { useLayoutEffect } from 'react'
import styled, { createGlobalStyle } from 'styled-components'
import Header from './Header'
import Footer from './Footer'

export default function Layout() {
  const { pathname, search } = useLocation()
  const hideSearch = pathname.startsWith('/hongguo/search')
  const isPlay = pathname.startsWith('/hongguo/play')

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = '红果短剧'
    const previousRestoration = history.scrollRestoration
    history.scrollRestoration = 'manual'
    return () => {
      history.scrollRestoration = previousRestoration
    }
  }, [])

  useLayoutEffect(() => {
    document.body.style.background = isPlay ? '#000' : '#0a0a0c'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isPlay ? '#000' : '#0a0a0c')
    return () => {
      document.body.style.background = ''
    }
  }, [isPlay])

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname, search])

  return (
    <>
      <Global />
      <Shell data-hide-search={hideSearch ? '1' : '0'} data-play={isPlay ? '1' : '0'}>
        <Header hideSearch={hideSearch} />
        <main>
          <Outlet />
        </main>
        {isPlay ? null : <Footer />}
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
  --theme-glow: rgba(232, 165, 75, 0.1);
  --theme-glow-2: rgba(196, 120, 42, 0.05);
  --theme-base: #0a0a0c;

  min-height: 100vh;
  background:
    radial-gradient(ellipse 70% 48% at 18% -12%, var(--theme-glow), transparent 70%),
    radial-gradient(ellipse 55% 40% at 88% 8%, var(--theme-glow-2), transparent 65%),
    var(--theme-base);

  main {
    min-height: calc(100vh - 140px);
    padding-top: 64px;
  }

  &[data-play='1'] {
    background: #000;

    main {
      min-height: 0;
      height: 100vh;
      padding-top: 64px;
      overflow: hidden;
    }
  }

  @media (max-width: 900px) {
    main {
      padding-top: 132px;
    }

    &[data-hide-search='1'] main {
      padding-top: 96px;
    }

    &[data-play='1'] main {
      height: auto;
      min-height: calc(100vh - 132px);
      overflow: visible;
      padding-top: 132px;
    }

    &[data-play='1'][data-hide-search='1'] main {
      padding-top: 96px;
    }
  }
`
