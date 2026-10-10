import { useEffect, useState } from 'react'
import styled from 'styled-components'

export const NEW_DOMAIN = 'https://www.liuming1994.qzz.io/'
const NEW_HOST = 'liuming1994.qzz.io'

export function isNewDomain() {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname.toLowerCase()
  return host === NEW_HOST || host.endsWith(`.${NEW_HOST}`)
}

export function shouldShowMigrateNotice() {
  return !isNewDomain()
}

type Labels = {
  title: string
  text: string
  cta: string
  close: string
}

const DEFAULT_LABELS: Labels = {
  title: '域名已迁移',
  text: '新域名已迁移到',
  cta: '点击进入',
  close: '关闭',
}

export default function DomainMigrateModal({ labels = DEFAULT_LABELS }: { labels?: Labels }) {
  const [open, setOpen] = useState(shouldShowMigrateNotice)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!open) return null

  return (
    <Style role="dialog" aria-modal="true" aria-labelledby="migrate-title">
      <button className="backdrop" type="button" aria-label={labels.close} onClick={() => setOpen(false)} />
      <div className="panel">
        <p className="eyebrow">{labels.title}</p>
        <h2 className="title" id="migrate-title">
          {labels.text}
        </h2>
        <a className="link" href={NEW_DOMAIN} target="_blank" rel="noreferrer">
          {NEW_DOMAIN}
        </a>
        <div className="actions">
          <a className="btn btn--primary" href={NEW_DOMAIN} target="_blank" rel="noreferrer">
            {labels.cta}
          </a>
          <button className="btn btn--soft" type="button" onClick={() => setOpen(false)}>
            {labels.close}
          </button>
        </div>
      </div>
    </Style>
  )
}

const Style = styled.div`
  --bg: #f5f6fb;
  --bg-elevated: #ffffff;
  --text: #0f172a;
  --text-soft: #475569;
  --line: rgba(15, 23, 42, 0.08);
  --purple: #7c5cfc;
  --purple-soft: #a78bfa;
  --grad-btn: linear-gradient(90deg, #3b82f6, #06b6d4);
  --radius: 16px;
  --radius-sm: 10px;
  --radius-pill: 999px;
  --font: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', sans-serif;

  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  font-family: var(--font);
  color: var(--text);

  html[data-theme='dark'] & {
    --bg: #0b1020;
    --bg-elevated: #141a2e;
    --text: #e8eaf2;
    --text-soft: #a0a8c0;
    --line: rgba(255, 255, 255, 0.08);
  }

  @keyframes migrateIn {
    from {
      opacity: 0;
      transform: translateY(16px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  .backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    padding: 0;
    margin: 0;
    cursor: pointer;
    background: rgba(15, 23, 42, 0.48);
    backdrop-filter: blur(6px);
  }

  html[data-theme='dark'] & .backdrop {
    background: rgba(0, 0, 0, 0.62);
  }

  .panel {
    position: relative;
    z-index: 1;
    width: min(100%, 26rem);
    padding: 1.75rem 1.6rem 1.5rem;
    border-radius: calc(var(--radius) + 4px);
    border: 1px solid var(--line);
    background: var(--bg-elevated);
    box-shadow: 0 24px 64px rgba(15, 23, 42, 0.22);
    animation: migrateIn 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  html[data-theme='dark'] & .panel {
    box-shadow: 0 28px 70px rgba(0, 0, 0, 0.55);
  }

  .eyebrow {
    margin: 0 0 0.55rem;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--purple-soft);
  }

  .title {
    margin: 0 0 0.85rem;
    font-size: 1.35rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.3;
  }

  .link {
    display: block;
    margin: 0 0 1.4rem;
    padding: 0.75rem 0.9rem;
    border-radius: var(--radius-sm);
    border: 1px solid color-mix(in srgb, var(--purple) 28%, var(--line));
    background: color-mix(in srgb, var(--purple) 8%, var(--bg));
    color: var(--purple);
    font-size: 0.86rem;
    font-weight: 600;
    text-decoration: none;
    word-break: break-all;
    transition: border-color 0.2s, background 0.2s;
  }

  .link:hover {
    border-color: var(--purple-soft);
    background: color-mix(in srgb, var(--purple) 12%, var(--bg));
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .btn {
    display: inline-flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    min-width: 7.5rem;
    padding: 0.8rem 1.35rem;
    border-radius: var(--radius-pill);
    border: 1px solid transparent;
    font: inherit;
    font-size: 0.92rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s, filter 0.2s;
  }

  .btn:hover {
    transform: translateY(-2px);
  }

  .btn--primary {
    background: var(--grad-btn);
    color: #fff;
    box-shadow: 0 8px 20px rgba(59, 130, 246, 0.28);
  }

  .btn--primary:hover {
    filter: brightness(1.06);
    box-shadow: 0 12px 28px rgba(59, 130, 246, 0.35);
  }

  .btn--soft {
    background: var(--bg-elevated);
    color: var(--text);
    border-color: var(--line);
    box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);
  }
`
