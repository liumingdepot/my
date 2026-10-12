import { useLayoutEffect } from 'react'
import { Link, useParams } from 'react-router'
import styled from 'styled-components'
import { PLACEHOLDER2_BASE, PLACEHOLDER2_ITEMS } from './items'

export default function PlaceholderPage() {
  const { id = '1' } = useParams()
  const item = PLACEHOLDER2_ITEMS.find((entry) => entry.id === id) ?? PLACEHOLDER2_ITEMS[0]

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = `${item.name} · 占位`
  }, [item.name])

  return (
    <Style>
      <header className="top">
        <div className="inner">
          <Link to={`${PLACEHOLDER2_BASE}/1`} className="brand" aria-label="占位二组">
            <span className="brand-mark" aria-hidden="true">
              {item.glyph}
            </span>
            <span className="brand-text">占位二组</span>
          </Link>
        </div>
      </header>

      <main className="main">
        <p className="kicker">摸鱼 · 占位</p>
        <h1 className="title">{item.name}</h1>
        <p className="desc">{item.desc}</p>
        <p className="hint">此页为占位入口，后续再填真实功能。</p>
      </main>
    </Style>
  )
}

const Style = styled.div`
  min-height: 100dvh;
  background:
    radial-gradient(ellipse 80% 50% at 20% 0%, rgba(251, 146, 60, 0.16), transparent 55%),
    radial-gradient(ellipse 60% 40% at 90% 10%, rgba(244, 114, 182, 0.1), transparent 50%),
    #fff8f3;
  color: #1c100b;
  font-family:
    'Noto Sans SC',
    'PingFang SC',
    'Hiragino Sans GB',
    'Microsoft YaHei',
    system-ui,
    sans-serif;

  .top {
    border-bottom: 1px solid rgba(28, 16, 11, 0.08);
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(12px);
  }

  .inner {
    max-width: 960px;
    margin: 0 auto;
    padding: 16px 20px;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: inherit;
  }

  .brand-mark {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: #c2410c;
    color: #fff7ed;
    font-weight: 700;
    font-size: 15px;
  }

  .brand-text {
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .main {
    max-width: 720px;
    margin: 0 auto;
    padding: 72px 20px 96px;
  }

  .kicker {
    margin: 0 0 12px;
    color: #c2410c;
    font-size: 13px;
    font-weight: 650;
    letter-spacing: 0.12em;
  }

  .title {
    margin: 0 0 16px;
    font-size: clamp(28px, 5vw, 42px);
    font-weight: 800;
    letter-spacing: 0.02em;
    line-height: 1.2;
  }

  .desc {
    margin: 0 0 28px;
    color: #5a463d;
    font-size: 16px;
    line-height: 1.7;
  }

  .hint {
    margin: 0;
    padding: 14px 16px;
    border-radius: 12px;
    border: 1px dashed rgba(194, 65, 12, 0.35);
    background: rgba(255, 255, 255, 0.65);
    color: #8a7468;
    font-size: 14px;
  }
`
