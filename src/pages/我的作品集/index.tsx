import { useLayoutEffect, useState } from 'react'
import { Link } from 'react-router'
import styled from 'styled-components'
import {
  filterWorksByCategory,
  WORK_CATEGORIES,
  WORKS_PATH,
  type WorkCategory,
} from './works'

export default function MoreWorksPage() {
  const [category, setCategory] = useState<WorkCategory>('all')
  const works = filterWorksByCategory(category)

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = '我的作品集 · 刘铭'
  }, [])

  return (
    <Style>
      <header className="top">
        <div className="inner">
          <Link to={WORKS_PATH} className="brand" aria-label="我的作品集">
            <span className="brand-mark">铭</span>
            <span className="brand-text">我的作品集</span>
          </Link>

          <div className="cats" role="tablist" aria-label="作品分类">
            {WORK_CATEGORIES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={category === item.id}
                className={`cat${category === item.id ? ' is-active' : ''}`}
                onClick={() => setCategory(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <Link to="/" className="back">
            返回首页
          </Link>
        </div>
      </header>

      <main className="main">
        <h1 className="title">我的作品集</h1>
        <p className="lead">个人开发者作品，仅供学习交流</p>

        <ul className="works-grid">
          {works.map((work, index) => (
            <li key={work.href}>
              <Link className={`work-card work-card--${work.tone}`} to={work.href}>
                <div className="work-card__top">
                  <span className="work-card__index">{String(index + 1).padStart(2, '0')}</span>
                  <div className="work-card__meta">
                    <span className="work-card__platform">{work.platform}</span>
                    <span className="work-card__tag">{work.tag}</span>
                  </div>
                </div>
                <h3 className="work-card__name">{work.name}</h3>
                <p className="work-card__desc">{work.desc}</p>
                <span className="work-card__go">
                  打开
                  <span className="work-card__arrow" aria-hidden="true">
                    →
                  </span>
                </span>
                <span className="work-card__mark" aria-hidden="true">
                  {work.glyph}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </Style>
  )
}

const Style = styled.div`
  --bg: #f5f6fb;
  --bg-elevated: #ffffff;
  --text: #0f172a;
  --text-soft: #475569;
  --muted: #94a3b8;
  --line: rgba(15, 23, 42, 0.08);
  --purple: #7c5cfc;
  --purple-soft: #a78bfa;
  --grad-btn: linear-gradient(90deg, #3b82f6, #06b6d4);
  --shadow: 0 10px 30px rgba(99, 102, 241, 0.08);
  --shadow-soft: 0 4px 18px rgba(15, 23, 42, 0.05);
  --radius: 16px;
  --radius-pill: 999px;
  --nav-h: 64px;
  --font: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', sans-serif;
  --serif: ui-serif, 'Songti SC', 'STSong', 'SimSun', serif;

  min-height: 100svh;
  background:
    radial-gradient(720px 420px at 12% -8%, rgba(99, 102, 241, 0.12), transparent 60%),
    radial-gradient(640px 380px at 90% 8%, rgba(6, 182, 212, 0.1), transparent 55%),
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
    gap: 20px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    flex-shrink: 0;
    color: inherit;
    margin-right: 12px;

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
    box-shadow: 0 4px 14px rgba(59, 130, 246, 0.28);
  }

  .brand-text {
    font-family: var(--serif);
    font-size: 21px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--text);
  }

  .back {
    flex-shrink: 0;
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    min-height: 36px;
    padding: 0 14px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--line);
    background: var(--bg-elevated);
    color: var(--text-soft);
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
    transition:
      color 0.2s,
      border-color 0.2s,
      box-shadow 0.2s;

    &:hover {
      color: var(--text);
      border-color: color-mix(in srgb, var(--purple) 35%, transparent);
      box-shadow: var(--shadow-soft);
    }
  }

  .main {
    width: min(90vw, 1400px);
    max-width: 1400px;
    margin: 0 auto;
    padding: calc(var(--nav-h) + 40px) 0 64px;
  }

  .title {
    margin: 0;
    font-family: var(--serif);
    font-size: clamp(28px, 4vw, 40px);
    font-weight: 700;
    letter-spacing: 0.06em;
  }

  .lead {
    margin: 10px 0 28px;
    color: var(--text-soft);
    font-size: 15px;
    letter-spacing: 0.04em;
  }

  .cats {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .cat {
    appearance: none;
    position: relative;
    flex-shrink: 0;
    border: none;
    background: transparent;
    color: var(--text-soft);
    padding: 8px 14px;
    font: inherit;
    font-size: 15px;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: color 0.2s;

    &::after {
      content: '';
      position: absolute;
      left: 14px;
      right: 14px;
      bottom: 2px;
      height: 2px;
      border-radius: 1px;
      background: var(--purple);
      transform: scaleX(0);
      transform-origin: center;
      transition: transform 0.22s ease;
    }

    &:hover {
      color: var(--text);
    }

    &.is-active {
      color: var(--text);
      font-weight: 600;

      &::after {
        transform: scaleX(1);
      }
    }
  }

  .works-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  .work-card {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 200px;
    padding: 1.2rem 1.25rem 1.15rem;
    overflow: hidden;
    border-radius: var(--radius);
    border: 1px solid var(--line);
    background: var(--bg-elevated);
    box-shadow: var(--shadow-soft);
    text-decoration: none;
    color: inherit;
    transition:
      transform 0.25s,
      box-shadow 0.25s;

    &:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow);

      .work-card__arrow {
        transform: translateX(4px);
      }

      .work-card__mark {
        opacity: 0.14;
        transform: scale(1.04);
      }
    }
  }

  .work-card__top,
  .work-card__name,
  .work-card__desc,
  .work-card__go {
    position: relative;
    z-index: 1;
  }

  .work-card__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .work-card__meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.4rem;
  }

  .work-card__index {
    flex-shrink: 0;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--purple-soft);
  }

  .work-card__tag {
    font-size: 0.68rem;
    font-weight: 600;
    padding: 0.18rem 0.52rem;
    border-radius: var(--radius-pill);
    border: 1px solid var(--line);
    color: var(--text-soft);
    background: color-mix(in srgb, var(--bg) 65%, transparent);
    white-space: nowrap;
  }

  .work-card__platform {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    padding: 0.18rem 0.52rem;
    border-radius: var(--radius-pill);
    color: var(--purple);
    background: color-mix(in srgb, var(--purple) 10%, transparent);
    white-space: nowrap;
  }

  .work-card__name {
    margin: 1rem 0 0.55rem;
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .work-card__desc {
    margin: 0;
    flex: 1;
    color: var(--text-soft);
    font-size: 0.9rem;
    line-height: 1.65;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    overflow: hidden;
  }

  .work-card__go {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin-top: 1rem;
    color: var(--purple);
    font-size: 0.86rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .work-card__arrow {
    display: inline-block;
    transition: transform 0.2s;
  }

  .work-card__mark {
    position: absolute;
    right: -0.1em;
    bottom: -0.25em;
    font-family: var(--serif);
    font-size: 7.5rem;
    font-weight: 700;
    line-height: 1;
    color: var(--text);
    opacity: 0.06;
    pointer-events: none;
    transition:
      opacity 0.25s,
      transform 0.25s;
  }

  .work-card--violet {
    background:
      radial-gradient(320px 180px at 90% 0%, rgba(124, 92, 252, 0.16), transparent 70%),
      var(--bg-elevated);
  }

  .work-card--rose {
    background:
      radial-gradient(320px 180px at 90% 0%, rgba(244, 63, 94, 0.14), transparent 70%),
      var(--bg-elevated);
  }

  .work-card--ink {
    background:
      radial-gradient(320px 180px at 90% 0%, rgba(15, 23, 42, 0.1), transparent 70%),
      var(--bg-elevated);
  }

  .work-card--emerald {
    background:
      radial-gradient(320px 180px at 90% 0%, rgba(16, 185, 129, 0.14), transparent 70%),
      var(--bg-elevated);
  }

  .work-card--sky {
    background:
      radial-gradient(320px 180px at 90% 0%, rgba(14, 165, 233, 0.14), transparent 70%),
      var(--bg-elevated);
  }

  .work-card--cyan {
    background:
      radial-gradient(320px 180px at 90% 0%, rgba(6, 182, 212, 0.14), transparent 70%),
      var(--bg-elevated);
  }

  .work-card--amber {
    background:
      radial-gradient(320px 180px at 90% 0%, rgba(245, 158, 11, 0.16), transparent 70%),
      var(--bg-elevated);
  }

  @media (max-width: 1100px) {
    .works-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 900px) {
    .works-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 720px) {
    --nav-h: 96px;

    .inner {
      display: grid;
      grid-template-columns: 1fr auto;
      grid-template-rows: 52px 44px;
      height: var(--nav-h);
      gap: 0 12px;
      align-items: center;
    }

    .brand {
      grid-column: 1;
      grid-row: 1;
      margin-right: 0;
    }

    .brand-text {
      font-size: 18px;
    }

    .back {
      grid-column: 2;
      grid-row: 1;
      margin-left: 0;
      padding: 0 12px;
      font-size: 12px;
      min-height: 32px;
    }

    .cats {
      grid-column: 1 / -1;
      grid-row: 2;
      align-self: stretch;
      margin: 0 -4px;
      padding: 0 4px 2px;
    }

    .cat {
      padding: 6px 12px;
      font-size: 14px;

      &::after {
        left: 12px;
        right: 12px;
        bottom: 0;
      }
    }

    .main {
      padding-top: calc(var(--nav-h) + 28px);
    }
  }

  @media (max-width: 560px) {
    .works-grid {
      grid-template-columns: 1fr;
    }
  }
`
