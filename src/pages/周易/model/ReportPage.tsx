import { useLayoutEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import styled from 'styled-components'
import { t } from '../utils/i18n'
import {
  clearHistory,
  deleteReport,
  getReport,
  kindLabel,
  readCurrentReport,
  type ReportPayload,
} from '../utils/reportHistory'
import FortuneNav from './FortuneNav'
import ReportBody from './ReportBody'

export type { ReportPayload } from '../utils/reportHistory'

function resolvePayload(state: unknown, id: string | null): ReportPayload | null {
  if (id) {
    const fromHistory = getReport(id)
    if (fromHistory) return fromHistory
  }
  const current = readCurrentReport(state)
  if (current && (!id || current.id === id)) return current
  return null
}

export default function ReportPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const id = searchParams.get('id')
  const [payload, setPayload] = useState<ReportPayload | null>(() => resolvePayload(location.state, id))

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = payload ? `铭周易 · ${payload.title}` : '铭周易 · 报告'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0c0f12')
  }, [payload])

  useLayoutEffect(() => {
    setPayload(resolvePayload(location.state, id))
    window.scrollTo(0, 0)
  }, [location.state, id, location.key])

  const metaItems = useMemo(() => {
    if (!payload) return []
    if (payload.meta?.length) return payload.meta
    const items: string[] = []
    if (payload.gender) items.push(payload.gender)
    if (payload.bazi) items.push(payload.bazi)
    if (payload.question) items.push(payload.question)
    return items
  }, [payload])

  function onDeleteCurrent() {
    if (!payload) return
    const next = deleteReport(payload.id)
    const fallback = next[0]
    if (fallback) {
      navigate(`/fortune/report?id=${fallback.id}`, { state: fallback, replace: true })
      setPayload(fallback)
    } else {
      navigate('/fortune/report', { replace: true })
      setPayload(null)
    }
  }

  function onClearAll() {
    clearHistory()
    navigate('/fortune/report', { replace: true })
    setPayload(null)
  }

  return (
    <Style>
      <div className="zhouyi" data-theme={payload?.kind ?? 'home'}>
        <FortuneNav currentId={payload?.id ?? null} />
        <main className="report-page">
          {payload ? (
            <article className="report-article">
              <p className="eyebrow">{kindLabel(payload.kind)}</p>
              <h1>{payload.title}</h1>
              {metaItems.length ? (
                <p className="report-meta">
                  {metaItems.map((item, index) => (
                    <span key={`${index}-${item}`}>{item}</span>
                  ))}
                </p>
              ) : null}
              <ReportBody source={payload.report} />
              <p className="report-author">{t.author}</p>
              <div className="report-actions">
                <button type="button" className="action-btn" onClick={onDeleteCurrent}>
                  {t.historyDeleteCurrent}
                </button>
                <button type="button" className="action-btn is-danger" onClick={onClearAll}>
                  {t.historyClear}
                </button>
                <Link className="back-link" to="/fortune">
                  {t.backFortune}
                </Link>
              </div>
            </article>
          ) : (
            <div className="report-article">
              <p className="eyebrow">命盘</p>
              <h1>{t.reportEmpty}</h1>
              <p className="report-empty">{t.reportEmptyHint}</p>
              <Link className="back-link" to="/fortune">
                {t.backFortune}
              </Link>
            </div>
          )}
        </main>
      </div>
    </Style>
  )
}

const Style = styled.div`
  --fortune-nav-height: calc(56px + env(safe-area-inset-top));

  .zhouyi {
    --zy-bg0: #0c0f12;
    --zy-bg1: #161a1f;
    --zy-glow: rgba(45, 212, 191, 0.1);
    --zy-accent: #5eead4;
    --zy-accent-strong: #2dd4bf;
    --zy-primary: #14b8a6;
    --zy-primary-hover: #2dd4bf;
    --zy-border: #2a3038;
    --zy-text: #d5d9df;
    --zy-text-soft: #f1f3f5;
    --zy-muted: #8b939e;
    --zy-error: #f87171;
    --zy-shadow: 0 1px 2px rgba(0, 0, 0, 0.35), 0 12px 32px rgba(0, 0, 0, 0.45);
    --zy-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC',
      'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
    --zy-serif: ui-serif, 'Songti SC', 'STSong', 'Noto Serif SC', 'SimSun', serif;

    box-sizing: border-box;
    min-height: 100svh;
    padding-top: var(--fortune-nav-height);
    background: var(--zy-bg0);
    color: var(--zy-text);
    font-family: var(--zy-font);
    color-scheme: dark;
  }

  .zhouyi[data-theme='lots'] {
    --zy-accent: #fcd34d;
    --zy-accent-strong: #fbbf24;
    --zy-primary: #d97706;
    --zy-primary-hover: #fbbf24;
  }

  .zhouyi[data-theme='casual'] {
    --zy-accent: #93c5fd;
    --zy-accent-strong: #60a5fa;
    --zy-primary: #3b82f6;
    --zy-primary-hover: #60a5fa;
  }

  .zhouyi[data-theme='bazi'] {
    --zy-accent: #fca5a5;
    --zy-accent-strong: #f87171;
    --zy-primary: #ef4444;
    --zy-primary-hover: #f87171;
  }

  .zhouyi[data-theme='hehun'] {
    --zy-accent: #c4b5fd;
    --zy-accent-strong: #a78bfa;
    --zy-primary: #8b5cf6;
    --zy-primary-hover: #a78bfa;
  }

  .zhouyi[data-theme='liunian'] {
    --zy-accent: #7dd3fc;
    --zy-accent-strong: #38bdf8;
    --zy-primary: #0ea5e9;
    --zy-primary-hover: #38bdf8;
  }

  .eyebrow {
    margin: 0 0 12px;
    color: var(--zy-accent);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.28em;
  }

  .report-page {
    width: min(100%, 720px);
    margin: 0 auto;
    padding:
      clamp(28px, 5vh, 48px)
      max(20px, env(safe-area-inset-right))
      calc(48px + env(safe-area-inset-bottom))
      max(20px, env(safe-area-inset-left));
  }

  .report-article {
    width: 100%;
  }

  .report-page h1 {
    margin: 0;
    color: var(--zy-text-soft);
    font: 500 clamp(28px, 5vw, 40px)/1.25 var(--zy-serif);
    letter-spacing: 0.06em;
  }

  .report-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    margin: 16px 0 8px;
    color: var(--zy-muted);
    font-size: 14px;
  }

  .report-empty {
    margin: 20px 0 0;
    color: var(--zy-text);
    font-size: 15px;
    line-height: 1.8;
  }

  .report h2,
  .report h3,
  .report h4,
  .report h5,
  .report h6 {
    margin: 28px 0 10px;
    color: var(--zy-text-soft);
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .report h2 {
    font-size: 22px;
  }

  .report h3 {
    font-size: 18px;
  }

  .report h4 {
    font-size: 16px;
  }

  .report h5,
  .report h6 {
    font-size: 15px;
  }

  .report p,
  .report li {
    margin: 0 0 12px;
    color: var(--zy-text);
    font-size: 15px;
    line-height: 1.85;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .report ul {
    margin: 0 0 12px;
    padding: 0 0 0 1.2em;
    list-style: disc;
  }

  .report li {
    margin-bottom: 8px;
  }

  .report strong {
    color: var(--zy-text-soft);
    font-weight: 600;
  }

  .table-wrap {
    margin: 8px 0 16px;
    overflow-x: auto;
    border: 1px solid var(--zy-border);
    border-radius: 8px;
  }

  .report table {
    width: 100%;
    min-width: 720px;
    border-collapse: collapse;
    font-size: 13px;
    background: var(--zy-bg1);
  }

  .report th,
  .report td {
    padding: 10px 8px;
    border-bottom: 1px solid var(--zy-border);
    color: var(--zy-text);
    text-align: center;
    white-space: nowrap;
  }

  .report th {
    color: var(--zy-text-soft);
    font-weight: 600;
    background: color-mix(in srgb, var(--zy-bg0) 70%, var(--zy-bg1));
  }

  .report-author {
    margin: 28px 0 0;
    color: var(--zy-muted);
    font-size: 13px;
    letter-spacing: 0.12em;
  }

  .report-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 16px;
    margin-top: 32px;
  }

  .action-btn {
    min-height: 32px;
    padding: 0 12px;
    border: 1px solid var(--zy-border);
    border-radius: 6px;
    background: transparent;
    color: var(--zy-muted);
    font: 13px/1 var(--zy-font);
    letter-spacing: 0.06em;
    cursor: pointer;
  }

  .action-btn:hover {
    color: var(--zy-text-soft);
    border-color: color-mix(in srgb, var(--zy-border) 60%, var(--zy-text));
  }

  .action-btn.is-danger:hover {
    color: var(--zy-error);
    border-color: color-mix(in srgb, var(--zy-error) 45%, var(--zy-border));
  }

  .back-link {
    color: var(--zy-primary);
    font-size: 14px;
    letter-spacing: 0.08em;
    text-decoration: none;
    border-bottom: 1px solid color-mix(in srgb, var(--zy-primary) 35%, transparent);
  }

  .back-link:hover {
    opacity: 0.8;
  }
`
