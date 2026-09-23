import { useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { formatBazi, toTimestamp } from '../utils/calendar'
import { t } from '../utils/i18n'
import { fortunePortalRoot } from '../utils/portal'
import BirthPicker, { type BirthPickerHandle, type BirthSelection } from '../model/BirthPicker'
import ConsultFrame from '../model/ConsultFrame'
import GenderGroup, { type Gender } from '../model/GenderGroup'
import ReportBody from '../model/ReportBody'
import { saveReport } from '../utils/reportHistory'
import styled from 'styled-components'

export default function LiunianFortune() {
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender>('男')
  const [birth, setBirth] = useState<BirthSelection | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [report, setReport] = useState('')
  const [savedName, setSavedName] = useState('')
  const [savedGender, setSavedGender] = useState('')
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
    if (!gender) {
      setError(t.needGender)
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
      const response = await fetch('/api/liunian', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: nextName,
          gender,
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
      const baziText = formatBazi(birth.calendar, birth.birth, birth.shichen, birthTimestamp)
      setSavedName(nextName)
      setSavedGender(gender)
      setSavedBazi(baziText)
      setReport(message)
      saveReport({
        kind: 'liunian',
        title: `${nextName} · ${t.navLiunian}`,
        name: nextName,
        gender,
        bazi: baziText,
        report: message,
      })
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
          <p className="eyebrow">{t.liunianKicker}</p>
          <h1>{t.navLiunian}</h1>
          <div className="rule" />
          <p className="meta">
            <span>
              {t.name}：{savedName}
            </span>
            <span>
              {t.gender}：{savedGender}
            </span>
            <span>
              {t.bazi}：{savedBazi}
            </span>
          </p>
          <ReportBody source={report} />
          <p className="author">{t.author}</p>
          <button type="button" className="again" onClick={reset}>
            {t.liunianAgain}
          </button>
        </article>
      ) : (
        <ConsultFrame
          kicker={t.liunianAsideKicker}
          title={t.liunianTitle}
          quote={t.liunianQuote}
          desc={t.liunianDesc}
          note={t.liunianNote}
        >
          <form className="consult-form" onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="liunian-name">{t.name}</label>
              <div className="field-control">
                <input
                  id="liunian-name"
                  name="name"
                  autoComplete="name"
                  enterKeyHint="next"
                  maxLength={20}
                  placeholder={t.namePh}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="field">
              <span className="field-label">{t.gender}</span>
              <div className="field-control">
                <GenderGroup
                  name="liunian-gender"
                  value={gender}
                  onChange={(next) => {
                    setGender(next)
                    setError('')
                  }}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="liunian-birth">{t.bazi}</label>
              <div className="field-control">
                <BirthPicker
                  id="liunian-birth"
                  ref={pickerRef}
                  value={birth}
                  onChange={(next) => {
                    setBirth(next)
                    setError('')
                  }}
                />
              </div>
            </div>
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
            fortunePortalRoot(),
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

  .eyebrow {
    margin: 0 0 8px;
    text-align: center;
    color: var(--zy-accent);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.28em;
    padding-left: 0.28em;
  }

  .sheet > .eyebrow {
    text-align: left;
    margin-bottom: 12px;
    padding-left: 0;
  }

  .consult-form {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
  }

  .consult h2,
  .sheet h1 {
    margin: 0;
    color: var(--zy-text-soft);
    font-weight: 500;
    font-family: var(--zy-serif);
    letter-spacing: 0.1em;
  }

  .field {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    margin-top: 0;
  }

  .field + .field {
    margin-top: 18px;
  }

  .field > label,
  .field > .field-label {
    margin: 0;
    color: var(--zy-text-soft);
    font-size: 14px;
    text-align: left;
    line-height: 1.2;
  }

  .field-control {
    width: 100%;
    min-width: 0;
  }

  .consult-form input {
    width: 100%;
    max-width: 100%;
    min-height: 40px;
    padding: 0 11px;
    border: 1px solid var(--zy-border, #d9d9d9);
    border-radius: 6px;
    background: color-mix(in srgb, var(--zy-bg0) 55%, var(--zy-bg1));
    color: var(--zy-text-soft);
    font: 14px/1.5 var(--zy-font);
    color-scheme: dark;
    box-sizing: border-box;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .consult-form input:hover {
    border-color: var(--zy-border-hover, var(--zy-primary));
  }

  .consult-form input:focus {
    outline: none;
    border-color: var(--zy-primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--zy-primary) 12%, transparent);
  }

  .consult-form input::placeholder {
    color: color-mix(in srgb, var(--zy-muted) 60%, transparent);
  }

  .consult-form .submit-btn,
  .again {
    min-height: 40px;
    border: 1px solid var(--zy-primary);
    border-radius: 6px;
    background: var(--zy-primary);
    color: #fff;
    font: 14px/1 var(--zy-font);
    letter-spacing: 0.12em;
    cursor: pointer;
    touch-action: manipulation;
    transition: background 0.2s, border-color 0.2s, opacity 0.2s;
  }

  .consult-form .submit-btn {
    width: 100%;
    margin-top: 24px;
  }

  .consult-form .submit-btn:hover:not(:disabled),
  .again:hover {
    background: var(--zy-primary-hover);
    border-color: var(--zy-primary-hover);
  }

  .consult-form .submit-btn:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .again {
    margin-top: 28px;
    padding: 0 20px;
  }

  .feedback {
    margin: 16px 0 0;
    color: var(--zy-error, #ff4d4f);
    font-size: 13px;
    line-height: 1.6;
  }

  .sheet {
    width: min(100%, 920px);
    min-height: calc(100svh - var(--fortune-nav-height, 56px));
    margin: 0 auto;
    box-sizing: border-box;
    padding:
      clamp(32px, 6vh, 56px)
      max(32px, env(safe-area-inset-right))
      calc(clamp(32px, 6vh, 56px) + env(safe-area-inset-bottom))
      max(32px, env(safe-area-inset-left));
    background: var(--zy-bg0);
  }

  .sheet h1 {
    font-size: clamp(28px, 5vw, 40px);
  }

  .rule {
    width: 40px;
    height: 2px;
    margin: 16px 0 20px;
    background: var(--zy-primary);
    border-radius: 1px;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    margin: 0 0 8px;
    color: var(--zy-muted);
    font-size: 14px;
  }

  .author {
    margin: 28px 0 0;
    color: var(--zy-muted);
    font-size: 13px;
    letter-spacing: 0.12em;
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

  table {
    width: 100%;
    min-width: 720px;
    border-collapse: collapse;
    font-size: 13px;
    background: var(--zy-bg1);
  }

  th,
  td {
    padding: 10px 8px;
    border-bottom: 1px solid var(--zy-border);
    color: var(--zy-text);
    text-align: center;
    white-space: nowrap;
  }

  th {
    color: var(--zy-text-soft);
    font-weight: 600;
    background: color-mix(in srgb, var(--zy-bg0) 70%, var(--zy-bg1));
  }

  .loading {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 16px;
    background: color-mix(in srgb, var(--zy-bg0) 78%, transparent);
    backdrop-filter: blur(6px);
  }

  .loading p {
    margin: 0;
    color: var(--zy-primary);
    font-size: 14px;
    letter-spacing: 0.2em;
    padding-left: 0.2em;
  }

  .loading-mark {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 2px solid color-mix(in srgb, var(--zy-primary) 20%, transparent);
    border-top-color: var(--zy-primary);
    animation: spin 0.8s linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-mark {
      animation: none;
    }
  }

  @media (max-width: 640px) {
    .sheet {
      padding-inline: max(20px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-left));
    }

    .again {
      width: 100%;
    }
  }
`
