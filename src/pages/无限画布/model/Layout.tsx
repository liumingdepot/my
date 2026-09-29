import { Link, Outlet } from 'react-router'
import styled from 'styled-components'

export default function CanvasLayout() {
  return (
    <Style>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Noto+Sans+SC:wght@400;500;600;700&display=swap"
      />
      <header className="top">
        <div className="inner">
          <Link to="/canvas" className="brand" aria-label="铭AI短剧 无限画布">
            <span className="brand-mark" aria-hidden="true">
              铭
            </span>
            <span className="brand-text">
              <span className="brand-main">铭AI短剧</span>
              <span className="brand-sub">无限画布</span>
            </span>
          </Link>
        </div>
      </header>
      <Outlet />
    </Style>
  )
}

const Style = styled.div`
  --bg: #0b0f14;
  --bg-elev: #121820;
  --ink: #eef2f7;
  --muted: rgba(238, 242, 247, 0.62);
  --soft: rgba(238, 242, 247, 0.42);
  --line: rgba(255, 255, 255, 0.08);
  --accent: #3dd6c6;
  --accent-deep: #1aa896;
  --amber: #f0b429;
  --nav-h: 64px;
  --display: 'Syne', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --sans: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;

  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  color: var(--ink);
  font-family: var(--sans);
  background:
    radial-gradient(900px 480px at 12% -8%, rgba(61, 214, 198, 0.16), transparent 55%),
    radial-gradient(720px 420px at 92% 0%, rgba(240, 180, 41, 0.08), transparent 50%),
    radial-gradient(640px 360px at 50% 110%, rgba(26, 168, 150, 0.1), transparent 55%),
    linear-gradient(165deg, #0b0f14 0%, #10161e 45%, #080b10 100%);

  .top {
    position: sticky;
    top: 0;
    z-index: 40;
    height: var(--nav-h);
    background: color-mix(in srgb, var(--bg) 78%, transparent);
    backdrop-filter: blur(14px) saturate(1.2);
    border-bottom: 1px solid var(--line);
  }

  .inner {
    width: 90vw;
    max-width: 90vw;
    height: 100%;
    margin: 0 auto;
    padding: 0 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: var(--ink);
    min-width: 0;
  }

  .brand-mark {
    flex: none;
    width: 34px;
    height: 34px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    font-family: var(--display);
    font-weight: 800;
    font-size: 0.95rem;
    color: #061018;
    background: linear-gradient(135deg, var(--accent) 0%, #7ef0df 55%, var(--amber) 120%);
    box-shadow: 0 0 0 1px rgba(61, 214, 198, 0.25);
  }

  .brand-text {
    display: flex;
    align-items: baseline;
    gap: 0.55rem;
    min-width: 0;
    flex-wrap: wrap;
  }

  .brand-main {
    font-family: var(--display);
    font-weight: 700;
    font-size: 1.05rem;
    letter-spacing: 0.02em;
  }

  .brand-sub {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--muted);
    letter-spacing: 0.06em;
  }
`
