import { Link } from 'react-router'
import styled from 'styled-components'

export default function HomePage() {
  return (
    <Style>
      <main className="main">
        <section className="hero" aria-label="铭AI短剧无限画布">
          <div className="hero-copy">
            <p className="kicker">AI Short Drama Studio</p>
            <h1 className="title">
              用提示词
              <br />
              铺开一部短剧
            </h1>
            <p className="desc">
              在无限画布上编排分镜、角色与节奏。输入一句想法，生成可继续编辑的短剧草稿。
            </p>
            <div className="cta">
              <Link to="/canvas/history" className="enter">
                进入画布
                <span aria-hidden="true"> →</span>
              </Link>
            </div>
          </div>

          <div className="stage" aria-hidden="true">
            <div className="stage-glow" />
            <div className="stage-frame">
              <div className="stage-bar">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
                <span className="bar-title">短剧画布 · 草稿</span>
              </div>
              <div className="grid" />
              <div className="node node-a">
                <span className="node-dot" />
                <span className="node-label">分镜 01</span>
                <span className="node-text">夜色巷口 · 推镜</span>
              </div>
              <div className="node node-b">
                <span className="node-dot" />
                <span className="node-label">角色</span>
                <span className="node-text">林遥 / 女主</span>
              </div>
              <div className="node node-c">
                <span className="node-dot" />
                <span className="node-label">旁白</span>
                <span className="node-text">雨还没停……</span>
              </div>
              <div className="node node-d">
                <span className="node-dot amber" />
                <span className="node-label">节奏</span>
                <span className="node-text">慢推 → 定格</span>
              </div>
              <svg className="wires" viewBox="0 0 560 420" fill="none">
                <path d="M130 130 C200 130, 230 200, 300 220" />
                <path d="M360 120 C410 160, 390 230, 330 250" />
                <path d="M150 290 C230 270, 280 280, 320 245" />
                <path d="M390 300 C360 270, 340 260, 320 250" />
              </svg>
            </div>
          </div>
        </section>
      </main>
    </Style>
  )
}

const Style = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;

  .main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 2rem 20px 3.5rem;
  }

  .hero {
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.15fr);
    gap: clamp(2.5rem, 5vw, 4rem);
    align-items: center;
  }

  .kicker {
    margin: 0 0 0.85rem;
    font-family: var(--display);
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--accent);
  }

  .title {
    margin: 0 0 1rem;
    font-family: var(--display);
    font-size: clamp(2.1rem, 5vw, 3.35rem);
    font-weight: 800;
    line-height: 1.12;
    letter-spacing: -0.02em;
  }

  .desc {
    margin: 0;
    max-width: 28rem;
    font-size: 1.02rem;
    line-height: 1.7;
    color: var(--muted);
  }

  .cta {
    margin-top: 1.75rem;
  }

  .enter {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.85rem 1.35rem;
    border-radius: 999px;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.95rem;
    color: #061018;
    background: linear-gradient(135deg, var(--accent) 0%, #7ef0df 70%);
    box-shadow: 0 12px 32px rgba(61, 214, 198, 0.22);
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 16px 40px rgba(61, 214, 198, 0.3);
    }
  }

  .stage {
    position: relative;
    width: 100%;
    max-width: 640px;
    min-height: 360px;
    justify-self: stretch;
  }

  .stage-glow {
    position: absolute;
    inset: 4% 2%;
    border-radius: 50%;
    background:
      radial-gradient(circle at 40% 40%, rgba(61, 214, 198, 0.28), transparent 58%),
      radial-gradient(circle at 72% 65%, rgba(240, 180, 41, 0.12), transparent 50%);
    filter: blur(14px);
    animation: pulse 5.5s ease-in-out infinite;
  }

  .stage-frame {
    position: relative;
    aspect-ratio: 5 / 4;
    border-radius: 22px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background:
      linear-gradient(155deg, rgba(22, 30, 40, 0.96), rgba(10, 14, 20, 0.92)),
      rgba(255, 255, 255, 0.02);
    overflow: hidden;
    box-shadow:
      0 28px 72px rgba(0, 0, 0, 0.42),
      0 0 0 1px rgba(61, 214, 198, 0.06) inset;
  }

  .stage-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 2;
    height: 36px;
    padding: 0 14px;
    display: flex;
    align-items: center;
    gap: 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(8, 12, 18, 0.55);
    backdrop-filter: blur(6px);
  }

  .stage-bar .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.18);

    &:nth-child(1) {
      background: #ff5f57;
    }
    &:nth-child(2) {
      background: #febc2e;
    }
    &:nth-child(3) {
      background: #28c840;
    }
  }

  .bar-title {
    margin-left: 8px;
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    color: var(--soft);
  }

  .grid {
    position: absolute;
    inset: 36px 0 0;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    background-size: 32px 32px;
    mask-image: radial-gradient(ellipse at 48% 42%, black 28%, transparent 80%);
  }

  .wires {
    position: absolute;
    inset: 36px 0 0;
    width: 100%;
    height: calc(100% - 36px);

    path {
      stroke: rgba(61, 214, 198, 0.42);
      stroke-width: 1.8;
      stroke-dasharray: 7 9;
      animation: dash 18s linear infinite;
    }
  }

  .node {
    position: absolute;
    min-width: 9rem;
    padding: 0.85rem 1rem 0.85rem 1.15rem;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: linear-gradient(160deg, rgba(18, 24, 32, 0.95), rgba(12, 16, 22, 0.9));
    backdrop-filter: blur(10px);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
    display: flex;
    flex-direction: column;
    gap: 0.28rem;
    animation: float 6s ease-in-out infinite;
  }

  .node-dot {
    position: absolute;
    top: 50%;
    left: -5px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    transform: translateY(-50%);
    background: var(--accent);
    box-shadow: 0 0 0 3px rgba(61, 214, 198, 0.18);

    &.amber {
      background: var(--amber);
      box-shadow: 0 0 0 3px rgba(240, 180, 41, 0.18);
    }
  }

  .node-label {
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    color: var(--accent);
    text-transform: uppercase;
  }

  .node-text {
    font-size: 0.9rem;
    color: var(--ink);
  }

  .node-a {
    top: 18%;
    left: 8%;
    animation-delay: 0s;
  }

  .node-b {
    top: 16%;
    right: 9%;
    animation-delay: -2s;
  }

  .node-c {
    bottom: 18%;
    left: 12%;
    animation-delay: -3.5s;
  }

  .node-d {
    bottom: 14%;
    right: 10%;
    animation-delay: -1.2s;

    .node-label {
      color: var(--amber);
    }
  }

  @keyframes float {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-6px);
    }
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.7;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.04);
    }
  }

  @keyframes dash {
    to {
      stroke-dashoffset: -220;
    }
  }

  @media (max-width: 860px) {
    .hero {
      grid-template-columns: 1fr;
      gap: 2rem;
    }

    .stage {
      order: -1;
      max-width: 480px;
      margin: 0 auto;
      width: 100%;
      justify-self: center;
    }

    .title {
      font-size: clamp(1.9rem, 8vw, 2.6rem);
    }
  }
`
