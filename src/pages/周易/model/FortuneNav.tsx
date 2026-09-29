import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router'
import styled from 'styled-components'
import { t } from '../utils/i18n'
import { fortunePortalRoot } from '../utils/portal'
import {
  clearHistory,
  deleteReport,
  formatHistoryTime,
  kindLabel,
  readHistory,
  type ReportPayload,
} from '../utils/reportHistory'

export const TABS = [
  { id: 'home', label: t.navHome },
  { id: 'lots', label: t.navLots },
  { id: 'casual', label: t.navCasual },
  { id: 'bazi', label: t.navBazi },
  { id: 'hehun', label: t.navHehun },
  { id: 'liunian', label: t.navLiunian },
] as const

export type TabId = (typeof TABS)[number]['id']

const MOBILE_QUERY = '(max-width: 900px)'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_QUERY).matches : false,
  )

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY)
    const onChange = () => setIsMobile(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return isMobile
}

type FortuneNavProps = {
  activeTab?: TabId | null
  onSelectTab?: (tab: TabId) => void
  currentId?: string | null
  onHistoryChange?: (list: ReportPayload[]) => void
}

function HistoryPanelBody({
  list,
  currentId,
  onClear,
  onOpen,
  onDelete,
}: {
  list: ReportPayload[]
  currentId: string | null
  onClear: () => void
  onOpen: (item: ReportPayload) => void
  onDelete: (event: MouseEvent, id: string) => void
}) {
  return (
    <>
      <div className="history-head">
        <p>{t.navHistory}</p>
        {list.length ? (
          <button type="button" className="history-clear" onClick={onClear}>
            {t.historyClear}
          </button>
        ) : null}
      </div>
      {list.length ? (
        <ul className="history-list">
          {list.map((item) => (
            <li key={item.id} className={`history-item${currentId === item.id ? ' is-current' : ''}`}>
              <button type="button" className="history-item-main" onClick={() => onOpen(item)}>
                <span className="history-kind">{kindLabel(item.kind)}</span>
                <span className="history-title">{item.title}</span>
                <span className="history-time">{formatHistoryTime(item.createdAt)}</span>
              </button>
              <button
                type="button"
                className="history-delete"
                aria-label={t.historyDelete}
                onClick={(event) => onDelete(event, item.id)}
              >
                {t.historyDelete}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="history-empty">{t.historyEmpty}</p>
      )}
    </>
  )
}

function HistorySheet({
  open,
  children,
  onClose,
}: {
  open: boolean
  children: ReactNode
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const html = document.documentElement
    const body = document.body
    const previousHtmlOverflow = html.style.overflow
    const previousBodyOverflow = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      html.style.overflow = previousHtmlOverflow
      body.style.overflow = previousBodyOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <SheetStyle>
      <div className="sheet-root" role="dialog" aria-modal="true" aria-label={t.navHistory}>
        <button type="button" className="sheet-backdrop" aria-label={t.cancel} onClick={onClose} />
        <div className="sheet-panel">
          <div className="sheet-handle" aria-hidden="true" />
          {children}
        </div>
      </div>
    </SheetStyle>,
    fortunePortalRoot(),
  )
}

export default function FortuneNav({
  activeTab = null,
  onSelectTab,
  currentId = null,
  onHistoryChange,
}: FortuneNavProps) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<ReportPayload[]>(() => readHistory())
  const panelRef = useRef<HTMLDivElement>(null)
  const closeHistory = useCallback(() => setOpen(false), [])

  useEffect(() => {
    function refresh() {
      const next = readHistory()
      setList(next)
      onHistoryChange?.(next)
    }
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('zhouyi-history', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('zhouyi-history', refresh)
    }
  }, [onHistoryChange])

  useEffect(() => {
    if (!open || isMobile) return
    function onPointer(event: globalThis.MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, isMobile])

  function emitChange(next: ReportPayload[]) {
    setList(next)
    onHistoryChange?.(next)
  }

  function openReport(item: ReportPayload) {
    setOpen(false)
    navigate(`/fortune/report?id=${item.id}`, { state: item })
  }

  function onDelete(event: MouseEvent, id: string) {
    event.stopPropagation()
    event.preventDefault()
    const next = deleteReport(id)
    emitChange(next)
    if (currentId === id) {
      const fallback = next[0]
      if (fallback) navigate(`/fortune/report?id=${fallback.id}`, { state: fallback, replace: true })
      else navigate('/fortune/report', { replace: true })
    }
  }

  function onClear() {
    clearHistory()
    emitChange([])
    setOpen(false)
    if (currentId) navigate('/fortune/report', { replace: true })
  }

  function handleTab(tab: TabId) {
    if (onSelectTab) {
      onSelectTab(tab)
      return
    }
    navigate('/fortune', { state: { tab } })
  }

  const panelBody = (
    <HistoryPanelBody
      list={list}
      currentId={currentId}
      onClear={onClear}
      onOpen={openReport}
      onDelete={onDelete}
    />
  )

  return (
    <Style className="nav" ref={panelRef}>
      <div className="nav-inner">
        <Link to="/fortune" className="brand" aria-label={t.docTitle}>
          <span className="brand-mark">{t.titleA}</span>
          <span className="brand-text">{t.docTitle}</span>
        </Link>
        <nav className="tabs" role="tablist" aria-label={t.navLabel}>
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={activeTab === item.id}
              className={activeTab === item.id ? 'is-active' : undefined}
              onClick={() => handleTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="history">
          <button
            type="button"
            className={`history-btn${open ? ' is-open' : ''}`}
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={() => setOpen((value) => !value)}
          >
            {t.navHistory}
            {list.length ? <span className="history-count">{list.length}</span> : null}
          </button>
          {!isMobile && open ? (
            <div className="history-panel" role="dialog" aria-label={t.navHistory}>
              {panelBody}
            </div>
          ) : null}
        </div>
      </div>
      {isMobile ? (
        <HistorySheet open={open} onClose={closeHistory}>
          {panelBody}
        </HistorySheet>
      ) : null}
    </Style>
  )
}

const panelShared = `
  .history-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid color-mix(in srgb, var(--zy-border) 80%, transparent);
  }

  .history-head p {
    margin: 0;
    color: var(--zy-text-soft);
    font: 500 14px/1 var(--zy-serif);
    letter-spacing: 0.08em;
  }

  .history-clear {
    border: 0;
    background: transparent;
    color: var(--zy-muted);
    font: 12px/1 var(--zy-font);
    cursor: pointer;
    touch-action: manipulation;
  }

  .history-clear:hover {
    color: var(--zy-error, #f87171);
  }

  .history-list {
    margin: 0;
    padding: 6px;
    list-style: none;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .history-item {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    padding: 4px;
    border-radius: 6px;
  }

  .history-item:hover,
  .history-item.is-current {
    background: color-mix(in srgb, var(--zy-primary) 12%, transparent);
  }

  .history-item-main {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
    padding: 8px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
    touch-action: manipulation;
  }

  .history-kind {
    color: var(--zy-accent);
    font-size: 11px;
    letter-spacing: 0.12em;
  }

  .history-title {
    color: var(--zy-text-soft);
    font-size: 14px;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .history-time {
    color: var(--zy-muted);
    font-size: 12px;
  }

  .history-delete {
    flex-shrink: 0;
    margin-top: 8px;
    margin-right: 4px;
    padding: 4px 6px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--zy-muted);
    font-size: 12px;
    line-height: 1.2;
    cursor: pointer;
    touch-action: manipulation;
  }

  .history-delete:hover {
    color: var(--zy-error, #f87171);
  }

  .history-empty {
    margin: 0;
    padding: 28px 16px;
    color: var(--zy-muted);
    font-size: 13px;
    text-align: center;
  }
`

const Style = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 4;
  box-sizing: border-box;
  height: var(--fortune-nav-height);
  padding-top: env(safe-area-inset-top);
  background: color-mix(in srgb, var(--zy-bg0) 82%, transparent);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid color-mix(in srgb, var(--zy-border) 80%, transparent);

  .nav-inner {
    display: flex;
    align-items: center;
    gap: 20px;
    box-sizing: border-box;
    width: min(90vw, 1400px);
    max-width: 1400px;
    height: calc(var(--fortune-nav-height) - env(safe-area-inset-top));
    margin: 0 auto;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;

    &:hover {
      opacity: 0.88;
    }
  }

  .brand-mark {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 6px;
    background: var(--zy-primary, #0f766e);
    color: #fff;
    font: 700 15px/1 var(--zy-serif);
    transition: background 0.35s ease;
  }

  .brand-text {
    font: 600 18px/1 var(--zy-serif);
    letter-spacing: 0.06em;
    color: var(--zy-text-soft);
  }

  .tabs {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .tabs button {
    position: relative;
    flex-shrink: 0;
    min-height: 32px;
    padding: 0 14px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--zy-muted);
    font: 14px/1 var(--zy-font);
    letter-spacing: 0.04em;
    cursor: pointer;
    transition:
      color 0.2s ease,
      background 0.2s ease;
  }

  .tabs button:hover {
    color: var(--zy-text);
  }

  .tabs button.is-active {
    color: var(--zy-accent-strong);
    background: color-mix(in srgb, var(--zy-primary) 16%, transparent);
    font-weight: 500;
  }

  .history {
    position: relative;
    flex-shrink: 0;
  }

  .history-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    padding: 0 12px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--zy-muted);
    font: 14px/1 var(--zy-font);
    letter-spacing: 0.04em;
    cursor: pointer;
    transition:
      color 0.2s ease,
      background 0.2s ease;
  }

  .history-btn:hover,
  .history-btn.is-open {
    color: var(--zy-text-soft);
    background: color-mix(in srgb, var(--zy-primary) 12%, transparent);
  }

  .history-count {
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: color-mix(in srgb, var(--zy-primary) 22%, transparent);
    color: var(--zy-accent-strong);
    font-size: 11px;
    line-height: 18px;
    text-align: center;
  }

  .history-panel {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 5;
    width: min(92vw, 360px);
    max-height: min(70vh, 480px);
    display: flex;
    flex-direction: column;
    border: 1px solid var(--zy-border);
    border-radius: 8px;
    background: color-mix(in srgb, var(--zy-bg1) 96%, var(--zy-bg0));
    box-shadow: var(--zy-shadow, 0 12px 32px rgba(0, 0, 0, 0.45));
    overflow: hidden;
  }

  ${panelShared}

  @media (max-width: 900px) {
    height: auto;
    min-height: var(--fortune-nav-height);

    .nav-inner {
      flex-wrap: wrap;
      row-gap: 6px;
      column-gap: 10px;
      height: auto;
      min-height: calc(var(--fortune-nav-height) - env(safe-area-inset-top));
      padding: 8px 0 10px;
    }

    .brand {
      order: 1;
    }

    .history {
      order: 2;
      margin-left: auto;
    }

    .tabs {
      order: 3;
      flex: 1 1 100%;
      width: 100%;
    }

    .brand-mark {
      width: 28px;
      height: 28px;
      font-size: 14px;
    }

    .brand-text {
      font-size: 16px;
    }

    .tabs button {
      padding: 0 10px;
      font-size: 13px;
    }

    .history-btn {
      padding: 0 8px;
      font-size: 13px;
    }
  }
`

const SheetStyle = styled.div`
  @keyframes history-sheet-up {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  .sheet-root {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }

  .sheet-backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    padding: 0;
    background: rgba(0, 0, 0, 0.72);
    cursor: pointer;
  }

  .sheet-panel {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-height: min(78vh, 560px);
    padding: 10px 0 calc(10px + env(safe-area-inset-bottom));
    border-radius: 12px 12px 0 0;
    background: var(--zy-bg1, #161a1f);
    color: var(--zy-text-soft, #f1f3f5);
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.4);
    animation: history-sheet-up 0.28s ease-out;
    overflow: hidden;
  }

  .sheet-handle {
    width: 36px;
    height: 4px;
    margin: 0 auto 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    flex-shrink: 0;
  }

  ${panelShared}

  .history-head {
    padding: 8px 16px 14px;
    border-bottom-color: color-mix(in srgb, var(--zy-border, #2a3038) 80%, transparent);
  }

  .history-head p {
    font-size: 16px;
    letter-spacing: 0.06em;
  }

  .history-clear {
    min-height: 36px;
    padding: 0 8px;
    font-size: 13px;
  }

  .history-list {
    flex: 1;
    min-height: 0;
    padding: 8px 10px;
  }

  .history-item {
    align-items: center;
    gap: 6px;
    padding: 6px;
  }

  .history-item-main {
    gap: 6px;
    padding: 10px;
  }

  .history-kind {
    font-size: 12px;
  }

  .history-title {
    font-size: 15px;
  }

  .history-time {
    font-size: 12px;
  }

  .history-delete {
    margin-top: 0;
    margin-right: 2px;
    min-height: 36px;
    min-width: 44px;
    padding: 8px 10px;
    font-size: 13px;
  }

  .history-empty {
    padding: 48px 16px;
    font-size: 14px;
  }
`
