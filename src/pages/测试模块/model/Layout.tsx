import { useLayoutEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import styled, { createGlobalStyle } from 'styled-components'

const THEME_BG = '#0c1018'

export default function Layout() {
  const { pathname } = useLocation()
  const isDetail = pathname.includes('/detail/')

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = '测试模块 · 站源流程'
  }, [])

  useLayoutEffect(() => {
    document.body.style.background = THEME_BG
    document.documentElement.style.background = THEME_BG
    return () => {
      document.body.style.background = ''
      document.documentElement.style.background = ''
    }
  }, [])

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      <Global />
      <Shell>
        <header className="top">
          <div className="inner">
            <Link className="brand" to="/test">
              测试模块
            </Link>
            <nav>
              <Link className={!isDetail ? 'on' : ''} to="/test">
                流程首页
              </Link>
            </nav>
            <p className="hint">红果 / 剧果 · 搜索 → 详情 → 播放</p>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
      </Shell>
    </>
  )
}

const Global = createGlobalStyle`
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: ${THEME_BG};
    color: #e8eef8;
    font-family: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  }
  a { color: inherit; text-decoration: none; }
  img { max-width: 100%; }
`

const Shell = styled.div`
  min-height: 100vh;
  min-height: 100dvh;
  background:
    radial-gradient(ellipse 60% 40% at 12% -8%, rgba(56, 120, 220, 0.18), transparent 70%),
    radial-gradient(ellipse 50% 35% at 92% 0%, rgba(40, 180, 140, 0.1), transparent 65%),
    ${THEME_BG};

  .top {
    position: sticky;
    top: 0;
    z-index: 20;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(12, 16, 24, 0.88);
    backdrop-filter: blur(12px);
  }

  .inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 14px 20px;
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
  }

  .brand {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  nav {
    display: flex;
    gap: 12px;

    a {
      font-size: 13px;
      color: rgba(232, 238, 248, 0.55);
      padding: 4px 0;
      border-bottom: 2px solid transparent;

      &.on,
      &:hover {
        color: #fff;
      }

      &.on {
        border-bottom-color: #4f9cf5;
      }
    }
  }

  .hint {
    margin: 0 0 0 auto;
    font-size: 12px;
    color: rgba(232, 238, 248, 0.35);
    letter-spacing: 0.04em;
  }

  main {
    max-width: 1100px;
    margin: 0 auto;
    padding: 24px 20px 48px;
  }

  @media (max-width: 720px) {
    .hint {
      display: none;
    }

    .inner {
      padding: 12px 14px;
    }

    main {
      padding: 16px 14px 40px;
    }
  }
`
