import { useLayoutEffect } from 'react'
import { Link, useParams } from 'react-router'
import styled from 'styled-components'
import { PLACEHOLDER1_BASE, PLACEHOLDER1_ITEMS } from './items'

export default function PlaceholderPage() {
  const { id = '1' } = useParams()
  const item = PLACEHOLDER1_ITEMS.find((entry) => entry.id === id) ?? PLACEHOLDER1_ITEMS[0]

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = `${item.name} · 占位`
  }, [item.name])

  return (
    <Style>
      <header className="top">
        <div className="inner">
          <Link to={PLACEHOLDER1_BASE} className="brand" aria-label="占位一组">
            <span className="brand-mark" aria-hidden="true">
              {item.glyph}
            </span>
            <span className="brand-text">占位一组</span>
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
    radial-gradient(ellipse 80% 50% at 20% 0%, rgba(45, 212, 191, 0.18), transparent 55%),
    radial-gradient(ellipse 60% 40% at 90% 10%, rgba(14, 165, 233, 0.12), transparent 50%),
    #f0faf7;
  color: #0b1f1c;
  font-family:
    'Noto Sans SC',
    'PingFang SC',
    'Hiragino Sans GB',
    'Microsoft YaHei',
    system-ui,
    sans-serif;

  .top {
    border-bottom: 1px solid rgba(11, 31, 28, 0.08);
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
    background: #0f766e;
    color: #ecfdf5;
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
    color: #0f766e;
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
    color: #3d5a54;
    font-size: 16px;
    line-height: 1.7;
  }

  .hint {
    margin: 0;
    padding: 14px 16px;
    border-radius: 12px;
    border: 1px dashed rgba(15, 118, 110, 0.35);
    background: rgba(255, 255, 255, 0.65);
    color: #6b8a82;
    font-size: 14px;
  }
`
