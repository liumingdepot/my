import type { ReactNode } from 'react'
import styled from 'styled-components'

export default function ConsultFrame({
  kicker,
  title,
  quote,
  desc,
  note,
  children,
}: {
  kicker: string
  title: string
  quote: string
  desc: string
  note?: string
  children: ReactNode
}) {
  return (
    <Style>
      <section className="consult" id="consult">
        <div className="consult-layout">
          <aside className="consult-aside">
            <p className="consult-kicker">{kicker}</p>
            <h1 className="consult-title">{title}</h1>
            <p className="consult-quote">{quote}</p>
            <div className="consult-rule" aria-hidden="true" />
            <p className="consult-desc">{desc}</p>
            {note ? <p className="consult-note">{note}</p> : null}
          </aside>
          <div className="consult-panel">{children}</div>
        </div>
      </section>
    </Style>
  )
}

const Style = styled.div`
  min-height: calc(100svh - var(--fortune-nav-height, 56px));

  .consult {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: inherit;
    padding: 24px;
    padding-bottom: calc(24px + env(safe-area-inset-bottom));
    background: var(--zy-bg0);
    transition: background 0.35s ease;
  }

  .consult-layout {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 56px;
    box-sizing: border-box;
    width: 100%;
    max-width: 1400px;
  }

  .consult-aside {
    box-sizing: border-box;
    display: flex;
    flex: 0 1 420px;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    max-width: 420px;
    padding: 8px 0;
  }

  .consult-kicker {
    margin: 0;
    color: var(--zy-accent);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.28em;
    padding-left: 0.28em;
  }

  .consult-title {
    margin: 16px 0 0;
    color: var(--zy-text-soft);
    font: 500 clamp(32px, 4.5vw, 48px) / 1.2 var(--zy-serif, ui-serif, 'Songti SC', serif);
    letter-spacing: 0.12em;
  }

  .consult-quote {
    margin: 16px 0 0;
    color: var(--zy-muted);
    font-size: clamp(14px, 1.4vw, 16px);
    letter-spacing: 0.08em;
    line-height: 1.7;
  }

  .consult-rule {
    width: 36px;
    height: 2px;
    margin: 20px 0;
    border-radius: 1px;
    background: var(--zy-primary);
  }

  .consult-desc {
    margin: 0;
    max-width: 28em;
    color: var(--zy-text);
    font-size: 15px;
    line-height: 1.85;
    letter-spacing: 0.02em;
  }

  .consult-note {
    margin: 24px 0 0;
    color: var(--zy-accent);
    font-size: 13px;
    letter-spacing: 0.12em;
  }

  .consult-panel {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    width: 450px;
    min-width: 0;
    height: auto;
    padding: 32px 28px;
    border: 1px solid var(--zy-border);
    border-radius: 8px;
    background: var(--zy-bg1);
    box-shadow: var(--zy-shadow);
  }

  @media (max-width: 1100px) {
    .consult-layout {
      gap: 40px;
    }

    .consult-aside {
      flex-basis: 360px;
      max-width: 360px;
    }
  }

  @media (max-width: 900px) {
    .consult {
      align-items: flex-start;
      padding: 20px 16px;
      padding-bottom: calc(20px + env(safe-area-inset-bottom));
    }

    .consult-layout {
      flex-direction: column;
      align-items: stretch;
      gap: 20px;
    }

    .consult-aside {
      flex: none;
      max-width: none;
      padding: 4px 0 0;
      justify-content: flex-start;
    }

    .consult-title {
      font-size: clamp(28px, 8vw, 36px);
    }

    .consult-desc {
      max-width: none;
      font-size: 14px;
    }

    .consult-panel {
      width: 100%;
      max-width: 450px;
      margin-inline: auto;
      padding: 24px 20px;
    }
  }

  @media (max-width: 480px) {
    .consult {
      padding: 16px 12px;
      padding-bottom: calc(16px + env(safe-area-inset-bottom));
    }

    .consult-panel {
      padding: 20px 16px;
    }

    .consult-quote {
      font-size: 14px;
    }

    .consult-note {
      margin-top: 16px;
      font-size: 12px;
    }
  }
`
