import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import styled from 'styled-components'
import { GENRES } from '../utils/server'
import { genreStore } from '../utils/history'
import { themeCss } from '../utils/theme'

const NAV = [
  {
    to: '/test',
    end: true,
    label: '发现',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M12 3l2.2 5.3 5.8.5-4.4 3.8 1.3 5.7L12 15.3 7.1 18.3l1.3-5.7L4 8.8l5.8-.5z" />
      </svg>
    ),
  },
  {
    to: '/test/rank',
    label: '排行榜',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 4h10v4a5 5 0 01-10 0V4z" />
        <path d="M7 5H4.5a0 0 0 000 0c0 3 1.5 4.5 3 4.5M17 5h2.5c0 3-1.5 4.5-3 4.5M12 13v4M9 20h6M10 17h4" />
      </svg>
    ),
  },
  {
    to: '/test/fav',
    label: '收藏',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M6 4h12v17l-6-4.2L6 21V4z" />
      </svg>
    ),
  },
  {
    to: '/test/history',
    label: '历史',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3.2 2" />
      </svg>
    ),
  },
] as const

const Layout = () => {
  const nav = useNavigate()
  const loc = useLocation()
  const [genre, setGenre] = useState(genreStore.get)
  const [q, setQ] = useState('')
  const showTabs = loc.pathname === '/test' || loc.pathname === '/test/'

  const switchGenre = (g: string) => {
    setGenre(g)
    genreStore.set(g)
    if (!showTabs) nav('/test')
    else window.dispatchEvent(new CustomEvent('test-genre', { detail: g }))
  }

  const doSearch = () => {
    const v = q.trim()
    if (v) nav(`/test/search/${encodeURIComponent(v)}`)
  }

  return (
    <Style>
      <aside className="side">
        <div className="logo" onClick={() => nav('/test')} title="测试短剧">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
            <path d="M8 5.5v13c0 .8.9 1.3 1.6.9l10.2-6.5c.6-.4.6-1.4 0-1.8L9.6 4.6c-.7-.4-1.6.1-1.6.9z" />
          </svg>
        </div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={'end' in n ? n.end : false}
            className={({ isActive }) => `nav${isActive ? ' on' : ''}`}
          >
            {n.icon}
            {n.label}
          </NavLink>
        ))}
        <div className="spacer" />
        <NavLink to="/test/settings" className={({ isActive }) => `nav${isActive ? ' on' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M19 12a7 7 0 00-.14-1.4l2-1.55-2-3.46-2.35.95a7 7 0 00-2.42-1.4L13.73 2h-3.46l-.36 2.54a7 7 0 00-2.42 1.4l-2.35-.95-2 3.46 2 1.55A7 7 0 005 12c0 .48.05.94.14 1.4l-2 1.55 2 3.46 2.35-.95a7 7 0 002.42 1.4l.36 2.54h3.46l.36-2.54a7 7 0 002.42-1.4l2.35.95 2-3.46-2-1.55c.09-.46.14-.92.14-1.4z" />
          </svg>
          设置
        </NavLink>
      </aside>

      <main className="main">
        <header className="top">
          <div className="brand" onClick={() => nav('/test')}>
            测试短剧
          </div>
          <div className="gtabs">
            {showTabs
              ? GENRES.map((g) => (
                  <div
                    key={g.id}
                    className={`gtab ${g.id === genre ? 'on' : ''}`}
                    onClick={() => switchGenre(g.id)}
                  >
                    {g.name}
                  </div>
                ))
              : null}
          </div>
          <div className="searchbox">
            <input
              value={q}
              placeholder="搜索短剧或演员"
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            />
            <svg
              onClick={doSearch}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </div>
        </header>
        <div className="view">
          <Outlet context={{ genre, setGenre: switchGenre }} />
        </div>
      </main>
    </Style>
  )
}

export type LayoutOutlet = {
  genre: string
  setGenre: (g: string) => void
}

export default Layout

const Style = styled.div`
  ${themeCss}
  min-height: 100vh;
  font-family: -apple-system, 'PingFang SC', 'Helvetica Neue', sans-serif;
  background: var(--bg);
  color: var(--txt);
  font-size: 14px;
  -webkit-font-smoothing: antialiased;

  * {
    box-sizing: border-box;
  }

  .side {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 72px;
    z-index: 20;
    background: #fff;
    border-right: 1px solid #f0f1f3;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 0 18px;
  }
  .logo {
    width: 36px;
    height: 36px;
    border-radius: 11px;
    margin-bottom: 22px;
    background: linear-gradient(135deg, #ff5f6d, #ff2e5f);
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .nav {
    width: 100%;
    padding: 11px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    color: #5a5f6e;
    cursor: pointer;
    font-size: 11px;
    user-select: none;
    text-decoration: none;
  }
  .nav svg {
    width: 22px;
    height: 22px;
  }
  .nav.on {
    color: var(--pink);
    font-weight: 600;
  }
  .nav:hover {
    color: var(--pink);
  }
  .spacer {
    flex: 1;
  }

  .main {
    margin-left: 72px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .top {
    position: sticky;
    top: 0;
    z-index: 10;
    background: #fff;
    display: flex;
    align-items: center;
    gap: 26px;
    height: 60px;
    padding: 0 26px;
  }
  .brand {
    font-size: 19px;
    font-weight: 800;
    color: var(--pink);
    letter-spacing: 0.5px;
    white-space: nowrap;
    cursor: pointer;
  }
  .gtabs {
    display: flex;
    gap: 24px;
  }
  .gtab {
    font-size: 15px;
    color: #333;
    padding: 19px 2px 17px;
    cursor: pointer;
    border-bottom: 2.5px solid transparent;
  }
  .gtab.on {
    color: var(--pink);
    font-weight: 700;
    border-color: var(--pink);
  }
  .searchbox {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    background: #f2f3f5;
    border-radius: 10px;
    padding: 8px 14px;
    width: 300px;
  }
  .searchbox input {
    flex: 1;
    border: 0;
    outline: 0;
    background: transparent;
    font-size: 13px;
    color: var(--txt);
  }
  .searchbox svg {
    width: 17px;
    height: 17px;
    color: #8a8f9c;
    cursor: pointer;
  }
  .view {
    flex: 1;
    padding: 18px 26px 70px;
    max-width: 1460px;
    width: 100%;
    margin: 0 auto;
  }

  @media (max-width: 720px) {
    .side {
      width: 56px;
    }
    .main {
      margin-left: 56px;
    }
    .searchbox {
      width: 140px;
    }
    .brand {
      font-size: 15px;
    }
    .gtabs {
      gap: 12px;
    }
    .gtab {
      font-size: 13px;
    }
    .view {
      padding: 14px 14px 50px;
    }
  }
`
