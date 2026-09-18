import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'

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

  useEffect(() => {
    document.title = payload ? `周易 · ${payload.name}的报告` : '周易 · 报告'
  }, [payload])

  if (!payload) {
    return (
      <main className="report-page">
        <div className="report-sheet">
          <p className="eyebrow">命盘</p>
          <h1>还没有报告</h1>
          <p className="report-empty">先填写姓名、八字和问题，再来看这一页。</p>
          <Link className="back-link" to="/">
            返回填写
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="report-page">
      <article className="report-sheet">
        <p className="eyebrow">命盘</p>
        <h1>{payload.name}的报告</h1>
        <p className="report-meta">
          <span>{payload.bazi}</span>
          <span>{payload.question}</span>
        </p>
        <div className="report-body">{payload.report}</div>
        <p className="report-author">作者：刘铭</p>
        <Link className="back-link" to="/">
          返回
        </Link>
      </article>
    </main>
  )
}
