import { Link, Outlet } from 'react-router'
import styled from 'styled-components'

export default function Layout() {
  return (
    <Style>
      <header className="top">
        <div className="inner">
          <Link to="/test" className="brand" aria-label="七猫短剧测试">
            <span className="brand-mark">剧</span>
            <span className="brand-text">七猫短剧 · 测试</span>
          </Link>
          <Link to="/" className="back">
            返回首页
          </Link>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </Style>
  )
}

const Style = styled.div`
  --bg: #0b0f14;
  --bg-elev: #141a22;
  --text: #e8eef6;
  --muted: #8b98a8;
  --accent: #3dd6c6;
  --line: rgba(255, 255, 255, 0.08);
  --nav-h: 56px;
  --font: 'IBM Plex Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;

  min-height: 100svh;
  background:
    radial-gradient(520px 320px at 85% 0%, rgba(15, 118, 110, 0.22), transparent 55%),
    var(--bg);
  color: var(--text);
  font-family: var(--font);

  .top {
    position: sticky;
    top: 0;
    z-index: 40;
    height: var(--nav-h);
    background: color-mix(in srgb, var(--bg) 82%, transparent);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--line);
  }

  .inner {
    width: min(96vw, 960px);
    margin: 0 auto;
    height: var(--nav-h);
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    color: inherit;
    text-decoration: none;
    margin-right: auto;
  }

  .brand-mark {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: linear-gradient(135deg, #0f766e, #0e7490);
    font-weight: 700;
    font-size: 14px;
  }

  .brand-text {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .back {
    color: var(--muted);
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;

    &:hover {
      color: var(--accent);
    }
  }

  .main {
    width: min(96vw, 960px);
    margin: 0 auto;
    padding: 20px 0 56px;
  }
`
