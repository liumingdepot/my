import type { ReactNode } from 'react'
import { t } from '../utils/i18n'
import styled from 'styled-components'

export default function ConsultFrame({
  kicker,
  quote,
  note,
  children,
}: {
  kicker: string
  quote: string
  note: string
  children: ReactNode
}) {
  return (
    <Style>
      <section className="consult" id="consult">
        <aside className="consult-aside">
          <div className="consult-ornament" aria-hidden="true">
            <span>☰</span>
            <span>☷</span>
            <span>☵</span>
            <span>☲</span>
          </div>
          <p className="consult-kicker">{kicker}</p>
          <p className="consult-quote">{quote}</p>
          <div className="consult-rule" />
          <p className="consult-aside-note">{note}</p>
          <p className="consult-aside-author">{t.author}</p>
        </aside>
        {children}
      </section>
    </Style>
  )
}

const Style = styled.div`
  .consult {
    display: grid;
    grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
    align-items: center;
    gap: 48px 64px;
    box-sizing: border-box;
    min-height: calc(100svh - var(--fortune-nav-height, 64px));
    padding:
      72px
      max(48px, env(safe-area-inset-right))
      calc(72px + env(safe-area-inset-bottom))
      max(48px, env(safe-area-inset-left));
    border-top: 1px solid rgba(214, 186, 138, 0.22);
    background:
      radial-gradient(640px 420px at 18% 42%, rgba(196, 148, 72, 0.09), transparent 62%),
      radial-gradient(520px 320px at 82% 18%, rgba(122, 36, 28, 0.08), transparent 68%),
      #0b0a09;
    scroll-margin-top: 12px;
  }

  .consult-aside {
    position: relative;
    max-width: 420px;
    padding: 8px 8px 8px 12px;
    transform: translateX(300px);
  }

  .consult-aside::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 1px;
    background: linear-gradient(180deg, transparent, rgba(214, 186, 138, 0.5), transparent);
  }

  .consult-ornament {
    display: flex;
    gap: 18px;
    margin: 0 0 28px;
    color: rgba(196, 163, 106, 0.72);
    font-size: 18px;
    letter-spacing: 0.08em;
  }

  .consult-kicker {
    margin: 0;
    color: #c4a36a;
    font-size: 14px;
    letter-spacing: 0.72em;
  }

  .consult-quote {
    margin: 22px 0 0;
    color: #f0e4cf;
    font-size: clamp(22px, 2.2vw, 30px);
    letter-spacing: 0.18em;
    line-height: 1.7;
  }

  .consult-rule {
    width: 64px;
    height: 1px;
    margin: 26px 0;
    background: linear-gradient(90deg, #e7d3a4, transparent);
  }

  .consult-aside-note {
    margin: 0;
    color: rgba(232, 220, 198, 0.68);
    font-size: 15px;
    letter-spacing: 0.28em;
  }

  .consult-aside-author {
    margin: 18px 0 0;
    color: rgba(196, 163, 106, 0.62);
    font-size: 12px;
    letter-spacing: 0.28em;
  }

  @media (max-width: 900px) {
    .consult {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: stretch;
      gap: 0;
      grid-template-columns: none;
      padding:
        36px
        max(24px, env(safe-area-inset-right))
        calc(48px + env(safe-area-inset-bottom))
        max(24px, env(safe-area-inset-left));
    }

    .consult-aside {
      max-width: none;
      margin: 0 auto 28px;
      padding: 8px 0 24px;
      text-align: center;
      transform: none;
    }

    .consult-aside::before {
      display: none;
    }

    .consult-ornament {
      justify-content: center;
      gap: 16px;
      margin-bottom: 18px;
      font-size: 16px;
    }

    .consult-kicker {
      font-size: 13px;
      letter-spacing: 0.56em;
      padding-left: 0.56em;
    }

    .consult-quote {
      margin-top: 14px;
      font-size: 17px;
      letter-spacing: 0.12em;
      line-height: 1.75;
    }

    .consult-rule {
      width: 48px;
      margin: 16px auto;
      background: linear-gradient(90deg, transparent, #e7d3a4 20%, #e7d3a4 80%, transparent);
    }

    .consult-aside-note {
      font-size: 13px;
      letter-spacing: 0.18em;
    }

    .consult-aside-author {
      margin-top: 10px;
      letter-spacing: 0.22em;
      padding-left: 0.22em;
    }
  }
`
