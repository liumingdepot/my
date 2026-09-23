import { Link } from 'react-router'
import AncientClock from '../model/AncientClock'
import BaguaWheel from '../model/BaguaWheel'
import { t } from '../utils/i18n'
import styled from 'styled-components'

export default function Home({ onConsult }: { onConsult: () => void }) {
  return (
    <Style>
      <main className="page">
        <div className="aura" aria-hidden="true" />
        <div className="bagua-wrap" aria-hidden="true">
          <BaguaWheel className="bagua" />
        </div>

        <p className="spine enter enter-spine">{t.spine}</p>
        <section className="copy">
          <p className="eyebrow enter enter-1">{t.eyebrow}</p>
          <h1>
            <span className="enter enter-title-a">{t.titleA}</span>
            <span className="enter enter-title-b">{t.titleB}</span>
          </h1>
          <p className="lead enter enter-2">{t.lead}</p>
          <div className="rule enter enter-2" />
          <p className="body enter enter-3">{t.body}</p>
          <p className="source enter enter-3">{t.source}</p>
          <p className="author enter enter-4">{t.author}</p>
          <div className="actions enter enter-4">
            <button type="button" className="cta" onClick={onConsult}>
              {t.scroll}
            </button>
            <Link className="back-link" to="/works">
              返回作品集
            </Link>
          </div>
        </section>
        <section className="clock-pane enter enter-clock" aria-label={t.clockLabel}>
          <AncientClock />
        </section>
      </main>
    </Style>
  )
}

const Style = styled.div`
  min-height: calc(100svh - var(--fortune-nav-height, 56px));
  background:
    radial-gradient(720px 480px at 62% 42%, var(--zy-glow), transparent 64%),
    radial-gradient(520px 400px at 28% 60%, var(--zy-glow-2), transparent 58%),
    linear-gradient(180deg, #10151a 0%, var(--zy-bg0) 100%);

  .page {
    --page-pad-x: clamp(16px, 4vw, 64px);
    box-sizing: border-box;
    width: 100%;
    max-width: 1400px;
    min-height: calc(100svh - var(--fortune-nav-height, 56px));
    height: calc(100svh - var(--fortune-nav-height, 56px));
    margin-inline: auto;
    display: grid;
    grid-template-columns: auto auto auto;
    justify-content: space-between;
    align-items: center;
    position: relative;
    overflow: hidden;
    padding-inline: max(var(--page-pad-x), env(safe-area-inset-left))
      max(var(--page-pad-x), env(safe-area-inset-right));
  }

  .aura {
    position: absolute;
    inset: 10% 18% 14% 18%;
    pointer-events: none;
    background: radial-gradient(ellipse at 58% 45%, var(--zy-glow), transparent 68%);
    animation: home-aura 10s ease-in-out infinite;
  }

  .bagua-wrap {
    position: absolute;
    left: 62%;
    top: 48%;
    width: min(64vmin, 460px);
    height: min(64vmin, 460px);
    transform: translate(-50%, -50%);
    pointer-events: none;
    color: var(--zy-accent);
    opacity: 0.12;
    z-index: 0;
  }

  .bagua {
    width: 100%;
    height: 100%;
    animation: home-bagua-spin 100s linear infinite;
  }

  .spine {
    position: relative;
    z-index: 1;
    align-self: center;
    justify-self: start;
    margin: 0;
    padding-inline: clamp(4px, 0.8vw, 12px);
    writing-mode: vertical-rl;
    letter-spacing: 0.4em;
    font-size: clamp(11px, 1.1vw, 13px);
    color: color-mix(in srgb, var(--zy-accent) 55%, transparent);
  }

  .copy {
    position: relative;
    z-index: 1;
    min-width: 0;
    justify-self: center;
    padding: clamp(24px, 6vh, 64px) 0 clamp(32px, 6vh, 72px);
  }

  .eyebrow {
    margin: 0 0 clamp(14px, 2vw, 22px);
    color: var(--zy-accent);
    font-size: clamp(12px, 1.2vw, 13px);
    font-weight: 500;
    letter-spacing: 0.36em;
  }

  h1 {
    display: flex;
    gap: 0.12em;
    margin: 0;
    font-size: clamp(52px, 7.5vw, 112px);
    font-weight: 500;
    line-height: 0.92;
    letter-spacing: 0;
    font-family: var(--zy-serif);
    color: var(--zy-text-soft);
  }

  .lead {
    margin: clamp(16px, 2.5vw, 28px) 0 0;
    color: var(--zy-text);
    font-size: clamp(16px, 1.8vw, 22px);
    letter-spacing: 0.2em;
  }

  .rule {
    width: clamp(40px, 5vw, 56px);
    height: 2px;
    margin: clamp(14px, 2vw, 22px) 0;
    background: var(--zy-primary);
    border-radius: 1px;
  }

  .body {
    margin: 0;
    color: var(--zy-muted);
    font-size: clamp(14px, 1.3vw, 16px);
    line-height: 1.85;
    letter-spacing: 0.06em;
    max-width: 28em;
  }

  .source {
    margin: clamp(12px, 1.8vw, 18px) 0 0;
    color: var(--zy-accent);
    font-size: 12px;
    letter-spacing: 0.24em;
  }

  .author {
    margin: 8px 0 0;
    color: var(--zy-muted);
    font-size: 12px;
    letter-spacing: 0.16em;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px 24px;
    margin-top: clamp(24px, 3.5vw, 36px);
  }

  .cta {
    min-height: 40px;
    padding: 0 22px;
    border: 1px solid var(--zy-primary);
    border-radius: 6px;
    background: var(--zy-primary);
    color: #fff;
    font: 14px/1 var(--zy-font);
    letter-spacing: 0.12em;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }

  .cta:hover {
    background: var(--zy-primary-hover);
    border-color: var(--zy-primary-hover);
  }

  .back-link {
    color: var(--zy-accent);
    font-size: 14px;
    letter-spacing: 0.08em;
    text-decoration: none;
    border-bottom: 1px solid color-mix(in srgb, var(--zy-accent) 35%, transparent);
  }

  .back-link:hover {
    color: var(--zy-primary);
  }

  .clock-pane {
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    min-width: 0;
    min-height: 0;
    align-self: center;
    justify-self: end;
    padding-block: clamp(12px, 4vh, 48px);
  }

  .clock-pane::before {
    content: '';
    position: absolute;
    top: 16%;
    bottom: 16%;
    left: 0;
    width: 1px;
    background: linear-gradient(
      180deg,
      transparent,
      color-mix(in srgb, var(--zy-border) 90%, transparent),
      transparent
    );
  }

  figcaption {
    display: flex;
    justify-content: center;
    align-items: baseline;
    gap: clamp(10px, 1.5vw, 18px);
    margin-top: 10px;
    color: var(--zy-text);
    letter-spacing: 0.2em;
    font-size: clamp(12px, 1.2vw, 14px);
  }

  .enter {
    opacity: 0;
    animation: home-enter 0.75s ease forwards;
  }

  .enter-spine {
    transform: translateY(16px);
    animation-delay: 0.04s;
  }

  .enter-1 {
    transform: translateY(12px);
    animation-delay: 0.1s;
  }

  .enter-title-a {
    display: inline-block;
    transform: translateY(20px);
    animation-delay: 0.18s;
  }

  .enter-title-b {
    display: inline-block;
    transform: translateY(24px);
    animation-delay: 0.28s;
  }

  .enter-2 {
    transform: translateY(12px);
    animation-delay: 0.38s;
  }

  .enter-3 {
    transform: translateY(10px);
    animation-delay: 0.48s;
  }

  .enter-4 {
    transform: translateY(8px);
    animation-delay: 0.58s;
  }

  .enter-clock {
    transform: scale(0.94);
    animation-name: home-enter-clock;
    animation-duration: 0.9s;
    animation-delay: 0.22s;
  }

  @keyframes home-enter {
    to {
      opacity: 1;
      transform: none;
    }
  }

  @keyframes home-enter-clock {
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes home-aura {
    0%,
    100% {
      opacity: 0.6;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.04);
    }
  }

  @keyframes home-bagua-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .enter,
    .enter-clock,
    .aura,
    .bagua {
      animation: none;
      opacity: 1;
      transform: none;
    }
  }

  @media (max-width: 1024px) {
    .page {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      grid-template-columns: none;
      height: auto;
      min-height: calc(100svh - var(--fortune-nav-height, 56px));
      overflow: visible;
      padding-inline: 0;
      padding-bottom: calc(24px + env(safe-area-inset-bottom));
    }

    .spine {
      display: none;
    }

    .bagua-wrap {
      left: 50%;
      top: 62%;
      opacity: 0.1;
    }

    .copy {
      width: 100%;
      flex: 0 0 auto;
      padding: 4vh max(clamp(20px, 5vw, 32px), env(safe-area-inset-right)) 0
        max(clamp(20px, 5vw, 32px), env(safe-area-inset-left));
      text-align: center;
    }

    .eyebrow {
      letter-spacing: 0.28em;
      padding-left: 0.28em;
    }

    h1 {
      justify-content: center;
      font-size: clamp(48px, 14vw, 80px);
    }

    .lead {
      letter-spacing: 0.12em;
      padding-left: 0.12em;
    }

    .rule {
      margin-inline: auto;
    }

    .body {
      margin-inline: auto;
      letter-spacing: 0.04em;
      max-width: 22em;
    }

    .actions {
      justify-content: center;
    }

    .clock-pane {
      flex: 1 1 auto;
      width: 100%;
      min-height: 0;
      padding: 20px 16px 8px;
    }

    .clock-pane::before {
      display: none;
    }
  }

  @media (max-width: 390px) {
    h1 {
      font-size: 44px;
    }
  }
`
