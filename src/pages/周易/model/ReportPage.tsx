import { useLayoutEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import styled from 'styled-components'
import ReportBody from './ReportBody'

const STORAGE_KEY = 'zhouyi-report'

export type ReportPayload = {
  name: string
  bazi: string
  question: string
  report: string
}

export function saveReport(payload: ReportPayload) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

function readReport(state: unknown): ReportPayload | null {
  if (isReport(state)) return state
  const saved = sessionStorage.getItem(STORAGE_KEY)
  if (!saved) return null
  try {
    const parsed: unknown = JSON.parse(saved)
    return isReport(parsed) ? parsed : null
  } catch {
    return null
  }
}

function isReport(value: unknown): value is ReportPayload {
  if (!value || typeof value !== 'object') return false
  const report = value as Partial<ReportPayload>
  return Boolean(report.name && report.bazi && report.question && report.report)
}

export default function ReportPage() {
  const location = useLocation()
  const [payload] = useState(() => readReport(location.state))

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = payload ? `铭周易 · ${payload.name}的报告` : '铭周易 · 报告'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0b0a09')
  }, [payload])

  if (!payload) {
    return (
      <Style>
        <div className="zhouyi">
          <main className="report-page">
            <div className="report-sheet">
              <p className="eyebrow">命盘</p>
              <h1>还没有报告</h1>
              <p className="report-empty">先填写姓名、八字和问题，再来看这一页。</p>
              <Link className="back-link" to="/fortune">
                返回填写
              </Link>
            </div>
          </main>
        </div>
      </Style>
    )
  }

  return (
    <Style>
      <div className="zhouyi">
        <main className="report-page">
          <article className="report-sheet">
            <p className="eyebrow">命盘</p>
            <h1>{payload.name}的报告</h1>
            <p className="report-meta">
              <span>{payload.bazi}</span>
              <span>{payload.question}</span>
            </p>
            <ReportBody source={payload.report} />
            <p className="report-author">作者：刘铭</p>
            <Link className="back-link" to="/fortune">
              返回
            </Link>
          </article>
        </main>
      </div>
    </Style>
  )
}

const Style = styled.div`
.eyebrow {
  margin: 0 0 28px;
  color: #c4a36a;
  font-size: 14px;
  letter-spacing: 0.72em;
}

.zhouyi h1 {
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

.zhouyi figcaption {
  display: flex;
  justify-content: center;
  align-items: baseline;
  gap: 18px;
  margin-top: 8px;
  color: #e7d7b8;
  letter-spacing: 0.42em;
  font-size: 14px;
}

.feedback.report {
  padding: 16px;
  border: 1px solid rgba(214, 186, 138, 0.45);
  color: #f3e6c8;
  letter-spacing: 0.04em;
  text-align: left;
  white-space: pre-wrap;
}

.report-page {
  min-height: 100vh;
  padding:
    48px
    max(20px, env(safe-area-inset-right))
    calc(48px + env(safe-area-inset-bottom))
    max(20px, env(safe-area-inset-left));
  background:
    radial-gradient(720px 420px at 50% 0%, rgba(196, 148, 72, 0.1), transparent 68%),
    #0b0a09;
}

.report-sheet {
  width: min(100%, 1400px);
  margin: 0 auto;
}

.report-page h1 {
  display: block;
  margin: 0;
  background: none;
  -webkit-background-clip: border-box;
  background-clip: border-box;
  color: #f3e6c8;
  font-size: clamp(36px, 6vw, 64px);
  line-height: 1.15;
  letter-spacing: 0.08em;
}

.report-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin: 18px 0 0;
  color: #c4a36a;
  font-size: 15px;
  letter-spacing: 0.08em;
}

.report-empty {
  margin: 28px 0 0;
  color: rgba(243, 230, 200, 0.9);
  font-size: 16px;
  line-height: 1.9;
  letter-spacing: 0.04em;
  white-space: pre-wrap;
  word-break: break-word;
}

.report h2,
.report h3,
.report h4,
.report h5,
.report h6 {
  margin: 28px 0 10px;
  color: #e7d3a4;
  font-weight: 500;
  letter-spacing: 0.12em;
}

.report h2 {
  font-size: 28px;
}

.report h3 {
  font-size: 20px;
}

.report h4 {
  font-size: 17px;
}

.report h5,
.report h6 {
  font-size: 15px;
  letter-spacing: 0.08em;
}

.report p,
.report li {
  margin: 0 0 12px;
  color: rgba(243, 230, 200, 0.9);
  font-size: 16px;
  line-height: 1.9;
  letter-spacing: 0.04em;
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
  color: #f6edd8;
  font-weight: 700;
}

.table-wrap {
  margin: 8px 0 16px;
  overflow-x: auto;
}

.report table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
  font-size: 14px;
}

.report th,
.report td {
  padding: 10px 8px;
  border-bottom: 1px solid rgba(214, 186, 138, 0.22);
  color: #f3e6c8;
  letter-spacing: 0.04em;
  text-align: center;
  white-space: nowrap;
}

.report th {
  color: #c4a36a;
  font-weight: 500;
}

.report-author {
  margin: 28px 0 0;
  color: rgba(196, 163, 106, 0.7);
  font-size: 13px;
  letter-spacing: 0.28em;
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
.eyebrow {
    margin-bottom: 16px;
    font-size: 13px;
    letter-spacing: 0.62em;
    padding-left: 0.62em;
  }

.zhouyi h1 {
    justify-content: center;
    font-size: clamp(72px, 22vw, 104px);
  }

.zhouyi figcaption {
    gap: 10px;
    letter-spacing: 0.12em;
    font-size: 13px;
  }
}

@media (max-width: 390px) {
.zhouyi h1 {
    font-size: 68px;
  }
}
`
