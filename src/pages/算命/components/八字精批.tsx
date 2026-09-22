import { useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { formatBazi, toTimestamp } from '../utils/calendar'
import { t } from '../utils/i18n'
import BirthPicker, { type BirthPickerHandle, type BirthSelection } from '../model/BirthPicker'
import ConsultFrame from '../model/ConsultFrame'
import styled from 'styled-components'

type Block =
  | { type: 'h1' | 'h2' | 'p'; text: string }
  | { type: 'table'; rows: string[][] }

function splitRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function isSeparator(line: string) {
  const cells = splitRow(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function parseReport(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index] ?? ''
    const trimmed = line.trim()
    if (!trimmed) {
      index += 1
      continue
    }
    if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'h2', text: trimmed.slice(3).trim() })
      index += 1
      continue
    }
    if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'h1', text: trimmed.slice(2).trim() })
      index += 1
      continue
    }
    if (trimmed.startsWith('|')) {
      const rows: string[][] = []
      while (index < lines.length && (lines[index] ?? '').trim().startsWith('|')) {
        const row = (lines[index] ?? '').trim()
        if (!isSeparator(row)) rows.push(splitRow(row))
        index += 1
      }
      if (rows.length) blocks.push({ type: 'table', rows })
      continue
    }
    const paragraph = [trimmed]
    index += 1
    while (index < lines.length) {
      const next = (lines[index] ?? '').trim()
      if (!next || next.startsWith('#') || next.startsWith('|')) break
      paragraph.push(next)
      index += 1
    }
    blocks.push({ type: 'p', text: paragraph.join('\n') })
  }
  return blocks
}

function ReportBody({ source }: { source: string }) {
  return (
    <div className="report">
      {parseReport(source).map((block, index) => {
        if (block.type === 'h1') return <h2 key={index}>{block.text}</h2>
        if (block.type === 'h2') return <h3 key={index}>{block.text}</h3>
        if (block.type === 'table') {
          const [head, ...body] = block.rows
          return (
            <div key={index} className="table-wrap">
              <table>
                {head ? (
                  <thead>
                    <tr>
                      {head.map((cell, cellIndex) => (
                        <th key={cellIndex}>{cell}</th>
                      ))}
                    </tr>
                  </thead>
                ) : null}
                <tbody>
                  {body.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        return <p key={index}>{block.text}</p>
      })}
    </div>
  )
}

export default function BaziDetail() {
  const [name, setName] = useState('')
  const [birth, setBirth] = useState<BirthSelection | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [report, setReport] = useState('')
  const [savedName, setSavedName] = useState('')
  const [savedBazi, setSavedBazi] = useState('')
  const pickerRef = useRef<BirthPickerHandle>(null)
  const birthTimestamp = birth ? toTimestamp(birth.calendar, birth.birth, birth.shichen) : null

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName) {
      setError('请填写姓名')
      return
    }
    if (!birth || birthTimestamp == null) {
      setError(t.needBirth)
      pickerRef.current?.open()
      return
    }
    setPending(true)
    setError('')
    try {
      const response = await fetch('/api/bazi', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: nextName,
          timestamp: birthTimestamp,
          shichen: birth.shichen,
        }),
      })
      const message = await response.text()
      if (!response.ok) {
        setError(message || t.fail)
        setPending(false)
        return
      }
      setSavedName(nextName)
      setSavedBazi(formatBazi(birth.calendar, birth.birth, birth.shichen, birthTimestamp))
      setReport(message)
      setPending(false)
      window.scrollTo(0, 0)
    } catch {
      setError(t.network)
      setPending(false)
    }
  }

  function reset() {
    setReport('')
    setError('')
    window.scrollTo(0, 0)
  }

  return (
    <Style>
      {report ? (
        <article className="sheet">
          <p className="eyebrow">{t.baziKicker}</p>
          <h1>{t.navBazi}</h1>
          <div className="rule" />
          <p className="meta">
            <span>
              {t.name}：{savedName}
            </span>
            <span>
              {t.bazi}：{savedBazi}
            </span>
          </p>
          <ReportBody source={report} />
          <p className="author">{t.author}</p>
          <button type="button" className="again" onClick={reset}>
            {t.baziAgain}
          </button>
        </article>
      ) : (
        <ConsultFrame kicker={t.baziAsideKicker} quote={t.baziQuote} note={t.baziNote}>
          <form className="consult-form" onSubmit={onSubmit}>
            <p className="eyebrow">{t.baziKicker}</p>
            <h2>{t.navBazi}</h2>
            <label htmlFor="bazi-name">{t.name}</label>
            <input
              id="bazi-name"
              name="name"
              autoComplete="name"
              enterKeyHint="next"
              maxLength={20}
              placeholder={t.namePh}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            <label htmlFor="bazi-birth">{t.bazi}</label>
            <BirthPicker
              id="bazi-birth"
              ref={pickerRef}
              value={birth}
              onChange={(next) => {
                setBirth(next)
                setError('')
              }}
            />
            <button type="submit" className="submit-btn" disabled={pending}>
              {t.submit}
            </button>
            {error ? <p className="feedback">{error}</p> : null}
          </form>
        </ConsultFrame>
      )}
      {pending
        ? createPortal(
            <Style>
              <div className="loading" role="status" aria-live="polite">
                <div className="loading-mark" aria-hidden="true" />
                <p>{t.loading}</p>
              </div>
            </Style>,
            document.body,
          )
        : null}
    </Style>
  )
}

const Style = styled.div`
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  && .consult {
    border-top: 0;
    min-height: calc(100svh - var(--fortune-nav-height, 64px));
  }

  .eyebrow {
    margin: 0 0 28px;
    color: #c4a36a;
    font-size: 14px;
    letter-spacing: 0.72em;
  }

  .consult-form {
    width: min(100%, 520px);
    justify-self: end;
    margin-right: 200px;
  }

  .consult h2,
  .sheet h1 {
    margin: 0;
    color: #f3e6c8;
    font-weight: 500;
    letter-spacing: 0.16em;
  }

  .consult h2 {
    font-size: clamp(32px, 8vw, 48px);
  }

  .consult-form label {
    display: block;
    margin: 22px 0 8px;
    color: #c4a36a;
    font-size: 14px;
    letter-spacing: 0.22em;
  }

  .consult-form input {
    width: 100%;
    max-width: 100%;
    min-height: 48px;
    padding: 0 14px;
    border: 1px solid rgba(214, 186, 138, 0.45);
    border-radius: 10px;
    background: rgba(255, 248, 235, 0.03);
    color: #f6edd8;
    font: 16px/1.5 'Songti SC', 'Noto Serif SC', serif;
    color-scheme: dark;
    box-sizing: border-box;
  }

  .consult-form input:focus {
    outline: 1px solid #e0c48a;
    outline-offset: 2px;
  }

  .consult-form input::placeholder {
    color: rgba(232, 220, 198, 0.38);
  }

  .consult-form .submit-btn,
  .again {
    min-height: 48px;
    border: 1px solid #d4ae62;
    border-radius: 10px;
    background: transparent;
    color: #f6edd8;
    font: 16px/1 'Songti SC', 'Noto Serif SC', serif;
    letter-spacing: 0.36em;
    cursor: pointer;
    touch-action: manipulation;
  }

  .consult-form .submit-btn {
    width: 100%;
    margin-top: 28px;
  }

  .consult-form .submit-btn:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .again {
    margin-top: 28px;
    padding: 0 22px;
  }

  .feedback {
    margin: 22px 0 0;
    color: #d4786a;
    letter-spacing: 0.08em;
    line-height: 1.8;
  }

  .sheet {
    width: min(100%, 860px);
    min-height: calc(100svh - var(--fortune-nav-height, 64px));
    margin: 0 auto;
    box-sizing: border-box;
    padding:
      8vh
      max(48px, env(safe-area-inset-right))
      calc(8vh + env(safe-area-inset-bottom))
      max(48px, env(safe-area-inset-left));
    background:
      radial-gradient(720px 420px at 22% 42%, rgba(196, 148, 72, 0.1), transparent 64%),
      #0b0a09;
  }

  .sheet h1 {
    font-size: clamp(40px, 6vw, 72px);
  }

  .rule {
    width: 72px;
    height: 1px;
    margin: 28px 0;
    background: linear-gradient(90deg, #e7d3a4, transparent);
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 18px;
    margin: 0;
    color: #c4a36a;
    font-size: 15px;
    letter-spacing: 0.08em;
  }

  .author {
    margin: 28px 0 0;
    color: rgba(196, 163, 106, 0.7);
    font-size: 13px;
    letter-spacing: 0.28em;
  }

  .report h2,
  .report h3 {
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

  .report p {
    margin: 0 0 12px;
    color: rgba(243, 230, 200, 0.9);
    font-size: 16px;
    line-height: 1.9;
    letter-spacing: 0.04em;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .table-wrap {
    margin: 8px 0 16px;
    overflow-x: auto;
  }

  table {
    width: 100%;
    min-width: 720px;
    border-collapse: collapse;
    font-size: 14px;
  }

  th,
  td {
    padding: 10px 8px;
    border-bottom: 1px solid rgba(214, 186, 138, 0.22);
    color: #f3e6c8;
    letter-spacing: 0.04em;
    text-align: center;
    white-space: nowrap;
  }

  th {
    color: #c4a36a;
    font-weight: 500;
  }

  .loading {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 18px;
    background: rgba(11, 10, 9, 0.9);
    backdrop-filter: blur(6px);
  }

  .loading p {
    margin: 0;
    color: #e7d3a4;
    font-size: 15px;
    letter-spacing: 0.42em;
    padding-left: 0.42em;
  }

  .loading-mark {
    width: 76px;
    height: 76px;
    border-radius: 50%;
    border: 1px solid rgba(214, 186, 138, 0.35);
    border-top-color: #f3e6c8;
    animation: spin 1s linear infinite;
  }

  .loading-mark::after {
    content: '';
    display: block;
    width: 46px;
    height: 46px;
    margin: 14px;
    border-radius: 50%;
    border: 1px solid rgba(214, 186, 138, 0.55);
    border-bottom-color: transparent;
    animation: spin 1.6s linear infinite reverse;
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-mark,
    .loading-mark::after {
      animation: none;
    }
  }

  @media (max-width: 900px) {
    .eyebrow {
      margin-bottom: 16px;
      font-size: 13px;
      letter-spacing: 0.62em;
      padding-left: 0.62em;
    }

    .consult-form {
      width: 100%;
      justify-self: stretch;
      margin-right: 0;
    }

    .consult h2,
    .consult-form label {
      letter-spacing: 0.08em;
    }

    .sheet {
      padding:
        8vh
        max(24px, env(safe-area-inset-right))
        calc(8vh + env(safe-area-inset-bottom))
        max(24px, env(safe-area-inset-left));
    }

    .sheet h1 {
      letter-spacing: 0.12em;
    }

    .rule {
      background: linear-gradient(90deg, transparent, #e7d3a4 20%, #e7d3a4 80%, transparent);
    }

    .again {
      width: 100%;
    }
  }
`
