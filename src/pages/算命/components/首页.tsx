import { Link } from 'react-router'
import AncientClock from '../model/AncientClock'
import { t } from '../utils/i18n'
import styled from 'styled-components'

export default function Home({ onConsult }: { onConsult: () => void }) {
  return (
    <Style>
      <main className="page">
        <p className="spine">{t.spine}</p>
        <section className="copy">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>
            <span>{t.titleA}</span>
            <span>{t.titleB}</span>
          </h1>
          <p className="lead">{t.lead}</p>
          <div className="rule" />
          <p className="body">{t.body}</p>
          <p className="source">{t.source}</p>
          <p className="author">{t.author}</p>
          <Link className="back-link" to="/">
            {t.backHome}
          </Link>
        </section>
        <section className="clock-pane" aria-label={t.clockLabel}>
          <AncientClock />
        </section>
        <button type="button" className="scroll-cue" onClick={onConsult}>
          {t.scroll}
        </button>
      </main>
    </Style>
  )
}

const Style = styled.div`
  .page {
    min-height: calc(100svh - var(--fortune-nav-height, 64px));
    display: grid;
    grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
    align-items: center;
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(820px 560px at 74% 48%, rgba(196, 148, 72, 0.1), transparent 62%),
      radial-gradient(640px 480px at 16% 42%, rgba(122, 36, 28, 0.09), transparent 58%),
      #0b0a09;
  }

  .page::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: radial-gradient(rgba(232, 214, 180, 0.035) 0.6px, transparent 0.6px);
    background-size: 3px 3px;
    mask-image: linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent);
  }

  .spine {
    position: absolute;
    z-index: 1;
    left: 2.4vw;
    top: 50%;
    margin: 0;
    transform: translate(250px, -50%);
    writing-mode: vertical-rl;
    letter-spacing: 0.55em;
    font-size: 13px;
    color: rgba(214, 186, 138, 0.62);
  }

  .copy {
    position: relative;
    z-index: 1;
    padding: 6vh 8vw 8vh 7.5vw;
    transform: translateX(250px);
  }

  .eyebrow {
    margin: 0 0 28px;
    color: #c4a36a;
    font-size: 14px;
    letter-spacing: 0.72em;
  }

  h1 {
    display: flex;
    gap: 0.16em;
    margin: 0;
    font-size: clamp(92px, 11vw, 168px);
    font-weight: 500;
    line-height: 0.9;
    letter-spacing: 0;
    background: linear-gradient(180deg, #f8f1e2 8%, #e0c48a 42%, #9a7344 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .lead {
    margin: 36px 0 0;
    color: #f0e4cf;
    font-size: clamp(22px, 2vw, 30px);
    letter-spacing: 0.34em;
  }

  .rule {
    width: 72px;
    height: 1px;
    margin: 28px 0;
    background: linear-gradient(90deg, #e7d3a4, transparent);
  }

  .body {
    margin: 0;
    color: rgba(232, 220, 198, 0.78);
    font-size: 18px;
    line-height: 1.9;
    letter-spacing: 0.18em;
    white-space: nowrap;
  }

  .source {
    margin: 22px 0 0;
    color: rgba(196, 163, 106, 0.8);
    font-size: 13px;
    letter-spacing: 0.42em;
  }

  .author {
    margin: 12px 0 0;
    color: rgba(196, 163, 106, 0.62);
    font-size: 12px;
    letter-spacing: 0.28em;
  }

  .clock-pane {
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    min-height: 0;
    align-self: stretch;
  }

  .clock-pane::before {
    content: '';
    position: absolute;
    top: 12vh;
    bottom: 12vh;
    left: 0;
    width: 1px;
    background: linear-gradient(180deg, transparent, rgba(214, 186, 138, 0.45), transparent);
  }

  figcaption {
    display: flex;
    justify-content: center;
    align-items: baseline;
    gap: 18px;
    margin-top: 8px;
    color: #e7d7b8;
    letter-spacing: 0.42em;
    font-size: 14px;
  }

  .scroll-cue {
    position: absolute;
    z-index: 2;
    left: 50%;
    bottom: max(20px, env(safe-area-inset-bottom));
    transform: translateX(-50%);
    border: 0;
    padding: 0;
    background: transparent;
    color: #c4a36a;
    font: 13px/1 'Songti SC', 'Noto Serif SC', serif;
    letter-spacing: 0.28em;
    white-space: nowrap;
    cursor: pointer;
  }

  .back-link {
    display: inline-block;
    margin-top: 32px;
    color: #e7d3a4;
    font-size: 15px;
    letter-spacing: 0.28em;
    text-decoration: none;
    border-bottom: 1px solid rgba(214, 186, 138, 0.45);
  }

  @media (max-width: 900px) {
    .page {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      grid-template-columns: none;
      align-content: stretch;
      min-height: calc(100svh - var(--fortune-nav-height, 64px));
      min-height: calc(100dvh - var(--fortune-nav-height, 64px));
      overflow: visible;
    }

    .spine {
      display: none;
    }

    .copy {
      width: 100%;
      padding: 4vh 32px 0;
      padding-left: max(32px, env(safe-area-inset-left));
      padding-right: max(32px, env(safe-area-inset-right));
      text-align: center;
      transform: none;
    }

    .eyebrow {
      margin-bottom: 16px;
      font-size: 13px;
      letter-spacing: 0.62em;
      padding-left: 0.62em;
    }

    h1 {
      justify-content: center;
      font-size: clamp(72px, 22vw, 104px);
    }

    .lead {
      margin-top: 18px;
      font-size: 17px;
      letter-spacing: 0.28em;
      padding-left: 0.28em;
    }

    .rule {
      width: 56px;
      margin: 18px auto;
      background: linear-gradient(90deg, transparent, #e7d3a4 20%, #e7d3a4 80%, transparent);
    }

    .body {
      margin-inline: auto;
      font-size: 14px;
      letter-spacing: 0.08em;
      line-height: 1.9;
      white-space: nowrap;
    }

    .source {
      margin-top: 12px;
      letter-spacing: 0.36em;
      padding-left: 0.36em;
    }

    .author {
      margin-top: 8px;
      letter-spacing: 0.22em;
      padding-left: 0.22em;
    }

    .clock-pane {
      flex: 1;
      width: 100%;
      min-height: 0;
      padding: 12px 16px 4px;
    }

    .clock-pane::before {
      display: none;
    }

    figcaption {
      gap: 10px;
      letter-spacing: 0.12em;
      font-size: 13px;
    }

    .scroll-cue {
      position: static;
      transform: none;
      display: block;
      padding: 4px 16px calc(16px + env(safe-area-inset-bottom));
    }
  }

  @media (max-width: 390px) {
    h1 {
      font-size: 68px;
    }
  }
`
