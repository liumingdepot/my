import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { currentDomain, DOMAINS, domainBadge, domainTag, toHref } from '../../components/domain'

function GlobeIcon() {
  return (
    <svg className="lang-dd__globe" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.4 2.6 3.7 5.6 3.7 9S14.4 18.4 12 21c-2.4-2.6-3.7-5.6-3.7-9S9.6 5.6 12 3z" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg className="lang-dd__chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="lang-dd__check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d="M5 12l5 5L20 7" />
    </svg>
  )
}

/** 右上角域名切换，仿照个人简历的语言下拉 */
export default function DomainSelect() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const active = currentDomain()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <Style className={`lang-dd${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        className="lang-dd__trigger"
        type="button"
        aria-label="切换域名"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <GlobeIcon />
        <span className="lang-dd__label">{active ? domainTag(active) : '域名'}</span>
        <ChevronIcon />
      </button>

      {open ? (
        <div className="lang-dd__panel">
          <p className="lang-dd__head">请选择要访问的域名</p>
          <ul className="lang-dd__menu" role="listbox" aria-label="请选择要访问的域名">
            {DOMAINS.map((domain) => {
              const isActive = active?.host === domain.host
              return (
                <li key={domain.host} role="option" aria-selected={isActive} className={domain.local ? 'lang-dd__sep' : undefined}>
                  <button
                    className={`lang-dd__option${isActive ? ' is-active' : ''}`}
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      window.location.href = toHref(domain)
                    }}
                  >
                    <span className="lang-dd__host">{domain.host}</span>
                    <span className="lang-dd__badge">{domainBadge(domain)}</span>
                    {isActive ? <CheckIcon /> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </Style>
  )
}

const Style = styled.div`
  --dd-accent: var(--accent, #7dd3c0);
  --dd-soft: rgba(232, 238, 248, 0.74);
  --dd-muted: rgba(232, 238, 248, 0.38);

  /* 固定在容器右上角（与导航同一条右基线），作品面板也可见 */
  position: fixed;
  top: 22px;
  right: max(4vw, calc((100vw - 1120px) / 2));
  z-index: 60;

  @keyframes ddIn {
    from {
      opacity: 0;
      transform: translateY(-8px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  .lang-dd__trigger {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 34px;
    padding: 0 10px 0 11px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 999px;
    background: rgba(8, 13, 24, 0.42);
    backdrop-filter: blur(14px) saturate(1.2);
    -webkit-backdrop-filter: blur(14px) saturate(1.2);
    color: var(--dd-soft);
    font: inherit;
    font-size: 12.5px;
    font-weight: 500;
    letter-spacing: 0.02em;
    white-space: nowrap;
    cursor: pointer;
    transition:
      color 0.2s,
      background 0.2s,
      border-color 0.2s;
  }

  .lang-dd__trigger:hover {
    color: #fff;
    border-color: rgba(255, 255, 255, 0.24);
    background: rgba(255, 255, 255, 0.07);
  }

  &.is-open .lang-dd__trigger {
    color: var(--dd-accent);
    border-color: color-mix(in srgb, var(--dd-accent) 42%, transparent);
    background: rgba(8, 13, 24, 0.66);
  }

  .lang-dd__globe {
    flex-shrink: 0;
    opacity: 0.85;
  }

  .lang-dd__label {
    max-width: 9em;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .lang-dd__chevron {
    flex-shrink: 0;
    opacity: 0.55;
    transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
  }

  &.is-open .lang-dd__chevron {
    transform: rotate(180deg);
  }

  .lang-dd__panel {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 282px;
    padding: 7px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    background: rgba(8, 13, 24, 0.84);
    backdrop-filter: blur(24px) saturate(1.3);
    -webkit-backdrop-filter: blur(24px) saturate(1.3);
    box-shadow: 0 26px 64px rgba(0, 0, 0, 0.55);
    animation: ddIn 0.2s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .lang-dd__head {
    margin: 0 0 5px;
    padding: 5px 9px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    color: var(--dd-muted);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
  }

  .lang-dd__menu {
    margin: 0;
    padding: 0;
    list-style: none;
    max-height: min(58vh, 19rem);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .lang-dd__sep {
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
  }

  .lang-dd__option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 9px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--dd-soft);
    font: inherit;
    font-size: 12.5px;
    font-weight: 500;
    letter-spacing: 0.01em;
    text-align: left;
    cursor: pointer;
    transition:
      background 0.16s,
      color 0.16s;
  }

  .lang-dd__option:hover {
    background: rgba(255, 255, 255, 0.07);
    color: #fff;
  }

  .lang-dd__option.is-active {
    background: color-mix(in srgb, var(--dd-accent) 10%, transparent);
    color: var(--dd-accent);
  }

  .lang-dd__host {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lang-dd__badge {
    flex-shrink: 0;
    color: var(--dd-muted);
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .lang-dd__option.is-active .lang-dd__badge {
    color: color-mix(in srgb, var(--dd-accent) 72%, #fff);
  }

  .lang-dd__check {
    flex-shrink: 0;
    color: var(--dd-accent);
  }

  @media (max-width: 560px) {
    .lang-dd__trigger {
      gap: 5px;
      padding: 0 8px;
    }

    .lang-dd__label {
      display: none;
    }

    .lang-dd__panel {
      width: min(282px, calc(100vw - 2rem));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .lang-dd__trigger,
    .lang-dd__option,
    .lang-dd__chevron {
      transition: none;
    }

    .lang-dd__panel {
      animation: none;
    }
  }
`