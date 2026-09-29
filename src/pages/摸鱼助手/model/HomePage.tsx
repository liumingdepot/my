import { Link } from 'react-router'
import styled from 'styled-components'
import { SECTIONS, type SimId } from '../utils/catalog'

type Props = {
  onLaunch: (id: SimId) => void
}

export default function HomePage({ onLaunch }: Props) {
  return (
    <Style>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Noto+Sans+SC:wght@400;500;600&display=swap"
      />
      <header className="top">
        <div className="inner">
          <Link to="/fish" className="brand" aria-label="铭摸鱼">
            <span className="brand-mark" aria-hidden="true">
              鱼
            </span>
            <span className="brand-text">铭摸鱼</span>
          </Link>
        </div>
      </header>

      <main className="main">
        <section className="hero" aria-label="摸鱼助手">
          <p className="hero-kicker">摸鱼助手</p>
          <p className="hero-lead">一键假装系统故障或升级，老板来了也不慌。</p>
        </section>

        {SECTIONS.map((section) => (
          <section className="block" key={section.id} id={section.id}>
            <div className="block-head">
              <h2 className="block-title">{section.title}</h2>
              <p className="block-sub">{section.subtitle}</p>
            </div>
            <ul className="cards">
              {section.cards.map((card) => (
                <li key={card.id}>
                  <button
                    type="button"
                    className={`card card--${section.id}`}
                    onClick={() => onLaunch(card.id)}
                  >
                    <span className="card-badge">{card.badge}</span>
                    <span className="card-title">{card.title}</span>
                    <span className="card-desc">{card.desc}</span>
                    <span className="card-go">
                      开始模拟
                      <span aria-hidden="true"> →</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="hint">进入模拟后按 Esc 或点击右上角退出</p>
      </main>
    </Style>
  )
}

const Style = styled.div`
  --bg: #e8f4f1;
  --bg-elev: #ffffff;
  --ink: #0b1f1c;
  --soft: #3d5a54;
  --muted: #6b8a82;
  --line: rgba(11, 31, 28, 0.1);
  --teal: #0f766e;
  --teal-deep: #115e59;
  --mint: #5eead4;
  --foam: #ccfbf1;
  --amber: #d97706;
  --sky: #0284c7;
  --shadow: 0 12px 32px rgba(15, 118, 110, 0.1);
  --radius: 18px;
  --nav-h: 64px;
  --display: 'Syne', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --sans: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;

  min-height: 100svh;
  overflow-x: hidden;
  color: var(--ink);
  font-family: var(--sans);
  background:
    radial-gradient(900px 480px at 8% -10%, rgba(94, 234, 212, 0.45), transparent 55%),
    radial-gradient(720px 420px at 92% 0%, rgba(14, 165, 233, 0.18), transparent 50%),
    radial-gradient(640px 360px at 50% 100%, rgba(15, 118, 110, 0.12), transparent 55%),
    linear-gradient(180deg, #f0faf7 0%, var(--bg) 40%, #dceee9 100%);

  .top {
    position: fixed;
    inset: 0 0 auto;
    z-index: 40;
    height: var(--nav-h);
    background: color-mix(in srgb, var(--bg) 72%, transparent);
    backdrop-filter: blur(14px) saturate(1.2);
    border-bottom: 1px solid var(--line);
  }

  .inner {
    max-width: 1080px;
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
  }

  .brand-mark {
    width: 34px;
    height: 34px;
    border-radius: 11px;
    display: grid;
    place-items: center;
    font-family: var(--display);
    font-weight: 800;
    font-size: 15px;
    color: #ecfeff;
    background: linear-gradient(145deg, var(--teal) 0%, #0e7490 100%);
    box-shadow: 0 8px 18px rgba(15, 118, 110, 0.28);
  }

  .brand-text {
    font-family: var(--display);
    font-weight: 700;
    font-size: 1.05rem;
    letter-spacing: 0.02em;
  }

  .main {
    max-width: 1080px;
    margin: 0 auto;
    padding: calc(var(--nav-h) + 36px) 20px 72px;
  }

  .hero {
    margin-bottom: 28px;
    animation: rise 0.7s ease both;
  }

  .hero-kicker {
    margin: 0 0 6px;
    font-size: 0.85rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--teal);
  }

  .hero-lead {
    margin: 0;
    max-width: 28em;
    font-size: 0.98rem;
    line-height: 1.55;
    color: var(--soft);
  }

  .block {
    margin-bottom: 40px;
    animation: rise 0.7s ease both;
  }

  .block:nth-of-type(2) {
    animation-delay: 0.08s;
  }

  .block:nth-of-type(3) {
    animation-delay: 0.14s;
  }

  .block:nth-of-type(4) {
    animation-delay: 0.2s;
  }

  .block-head {
    margin-bottom: 16px;
  }

  .block-title {
    margin: 0;
    font-family: var(--display);
    font-size: 1.45rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .block-sub {
    margin: 6px 0 0;
    color: var(--muted);
    font-size: 0.92rem;
  }

  .cards {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 14px;
  }

  .card {
    width: 100%;
    min-height: 168px;
    padding: 18px 18px 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--bg-elev) 88%, transparent);
    box-shadow: var(--shadow);
    text-align: left;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
  }

  .card:hover {
    transform: translateY(-3px);
    border-color: color-mix(in srgb, var(--teal) 35%, var(--line));
    box-shadow: 0 16px 36px rgba(15, 118, 110, 0.14);
  }

  .card:focus-visible {
    outline: 2px solid var(--teal);
    outline-offset: 3px;
  }

  .card-badge {
    align-self: flex-start;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--teal-deep);
    background: var(--foam);
    padding: 4px 8px;
    border-radius: 8px;
  }

  .card--win-update .card-badge {
    color: #075985;
    background: #e0f2fe;
  }

  .card--mac-update .card-badge {
    color: #1f2937;
    background: #e5e7eb;
  }

  .card-title {
    font-family: var(--display);
    font-size: 1.12rem;
    font-weight: 700;
    color: var(--ink);
  }

  .card-desc {
    flex: 1;
    font-size: 0.88rem;
    line-height: 1.5;
    color: var(--muted);
  }

  .card-go {
    margin-top: 4px;
    font-size: 0.86rem;
    font-weight: 600;
    color: var(--teal);
  }

  .hint {
    margin: 8px 0 0;
    text-align: center;
    font-size: 0.85rem;
    color: var(--muted);
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(14px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 640px) {
    .hero {
      margin-bottom: 22px;
    }

    .cards {
      grid-template-columns: 1fr;
    }
  }
`
