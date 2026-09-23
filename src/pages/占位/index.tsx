import { useLayoutEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import styled from 'styled-components'
import { WORKS_PATH } from '../更多作品/works'

const MAX = 10

export default function PlaceholderPage() {
  const { id } = useParams()
  const n = Number(id)

  useLayoutEffect(() => {
    if (!Number.isInteger(n) || n < 1 || n > MAX) return
    document.body.classList.remove('site-home')
    document.title = `铭占位 ${n}`
  }, [n])

  if (!Number.isInteger(n) || n < 1 || n > MAX) {
    return <Navigate to={WORKS_PATH} replace />
  }

  const home = `/placeholder/${n}`

  return (
    <Style>
      <header className="top">
        <div className="inner">
          <Link to={home} className="brand" aria-label={`铭占位 ${n}`}>
            <span className="brand-mark">铭</span>
            <span className="brand-text">铭占位 {n}</span>
          </Link>
          <Link to={WORKS_PATH} className="back">
            返回作品集
          </Link>
        </div>
      </header>

      <main className="main">
        <p className="eyebrow">占位作品</p>
        <h1 className="title">占位 {n}</h1>
        <p className="lead">路由已打通，内容后续补充。仅供学习交流。</p>
      </main>
    </Style>
  )
}

const Style = styled.div`
  --bg: #0f1419;
  --bg-elev: #171d24;
  --text: #e8eef4;
  --muted: #8b9aab;
  --accent: #5eead4;
  --line: rgba(255, 255, 255, 0.08);
  --grad-btn: linear-gradient(135deg, #0d9488, #0891b2);
  --nav-h: 64px;
  --font: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', sans-serif;
  --serif: ui-serif, 'Songti SC', 'STSong', 'SimSun', serif;

  min-height: 100svh;
  background:
    radial-gradient(640px 420px at 70% 20%, rgba(13, 148, 136, 0.22), transparent 60%),
    radial-gradient(520px 360px at 15% 80%, rgba(8, 145, 178, 0.16), transparent 55%),
    var(--bg);
  color: var(--text);
  font-family: var(--font);

  .top {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    height: var(--nav-h);
    background: color-mix(in srgb, var(--bg) 78%, transparent);
    backdrop-filter: blur(16px) saturate(1.3);
    -webkit-backdrop-filter: blur(16px) saturate(1.3);
    border-bottom: 1px solid var(--line);
  }

  .inner {
    width: min(90vw, 1400px);
    max-width: 1400px;
    margin: 0 auto;
    height: var(--nav-h);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: inherit;

    &:hover {
      opacity: 0.9;
    }
  }

  .brand-mark {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 9px;
    background: var(--grad-btn);
    color: #fff;
    font-family: var(--serif);
    font-weight: 700;
    font-size: 17px;
  }

  .brand-text {
    font-family: var(--serif);
    font-size: 21px;
    font-weight: 700;
    letter-spacing: 0.08em;
  }

  .back {
    display: inline-flex;
    align-items: center;
    min-height: 36px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--bg-elev);
    color: var(--muted);
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;

    &:hover {
      color: var(--text);
      border-color: color-mix(in srgb, var(--accent) 40%, transparent);
    }
  }

  .main {
    width: min(90vw, 720px);
    margin: 0 auto;
    padding: calc(var(--nav-h) + 72px) 0 64px;
  }

  .eyebrow {
    margin: 0 0 12px;
    color: var(--accent);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.32em;
  }

  .title {
    margin: 0;
    font-family: var(--serif);
    font-size: clamp(40px, 8vw, 64px);
    font-weight: 600;
    letter-spacing: 0.08em;
  }

  .lead {
    margin: 18px 0 0;
    color: var(--muted);
    font-size: 15px;
    line-height: 1.7;
    letter-spacing: 0.06em;
  }

  @media (max-width: 420px) {
    .brand-text {
      font-size: 17px;
    }
  }
`
