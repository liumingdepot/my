import { useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { formatBazi, toTimestamp } from '../utils/calendar'
import { t } from '../utils/i18n'
import { fortunePortalRoot } from '../utils/portal'
import BirthPicker, { type BirthPickerHandle, type BirthSelection } from '../model/BirthPicker'
import ConsultFrame from '../model/ConsultFrame'
import ReportBody from '../model/ReportBody'
import { saveReport } from '../utils/reportHistory'
import styled from 'styled-components'

export default function HehunMatch() {
  const [maleName, setMaleName] = useState('')
  const [femaleName, setFemaleName] = useState('')
  const [maleBirth, setMaleBirth] = useState<BirthSelection | null>(null)
  const [femaleBirth, setFemaleBirth] = useState<BirthSelection | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [report, setReport] = useState('')
  const [savedMale, setSavedMale] = useState({ name: '', bazi: '' })
  const [savedFemale, setSavedFemale] = useState({ name: '', bazi: '' })
  const malePickerRef = useRef<BirthPickerHandle>(null)
  const femalePickerRef = useRef<BirthPickerHandle>(null)
  const maleTimestamp = maleBirth
    ? toTimestamp(maleBirth.calendar, maleBirth.birth, maleBirth.shichen)
    : null
  const femaleTimestamp = femaleBirth
    ? toTimestamp(femaleBirth.calendar, femaleBirth.birth, femaleBirth.shichen)
    : null

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextMaleName = maleName.trim()
    const nextFemaleName = femaleName.trim()
    if (!nextMaleName) {
      setError('请填写男方姓名')
      return
    }
    if (!maleBirth || maleTimestamp == null) {
      setError('请选择男方生辰')
      malePickerRef.current?.open()
      return
    }
    if (!nextFemaleName) {
      setError('请填写女方姓名')
      return
    }
    if (!femaleBirth || femaleTimestamp == null) {
      setError('请选择女方生辰')
      femalePickerRef.current?.open()
      return
    }
    setPending(true)
    setError('')
    try {
      const response = await fetch('/api/hehun', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          male: {
            name: nextMaleName,
            timestamp: maleTimestamp,
            shichen: maleBirth.shichen,
          },
          female: {
            name: nextFemaleName,
            timestamp: femaleTimestamp,
            shichen: femaleBirth.shichen,
          },
        }),
      })
      const message = await response.text()
      if (!response.ok) {
        setError(message || t.fail)
        setPending(false)
        return
      }
      const maleBazi = formatBazi(maleBirth.calendar, maleBirth.birth, maleBirth.shichen, maleTimestamp)
      const femaleBazi = formatBazi(
        femaleBirth.calendar,
        femaleBirth.birth,
        femaleBirth.shichen,
        femaleTimestamp,
      )
      setSavedMale({ name: nextMaleName, bazi: maleBazi })
      setSavedFemale({ name: nextFemaleName, bazi: femaleBazi })
      setReport(message)
      saveReport({
        kind: 'hehun',
        title: `${nextMaleName} × ${nextFemaleName}`,
        name: `${nextMaleName} × ${nextFemaleName}`,
        meta: [
          `${t.male}：${nextMaleName} · ${maleBazi}`,
          `${t.female}：${nextFemaleName} · ${femaleBazi}`,
        ],
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
          <h1>{t.navHehun}</h1>
          <div className="rule" />
          <p className="meta">
            <span>
              {t.male}：{savedMale.name} · {savedMale.bazi}
            </span>
            <span>
              {t.female}：{savedFemale.name} · {savedFemale.bazi}
            </span>
          </p>
          <ReportBody source={report} />
          <p className="author">{t.author}</p>
          <button type="button" className="again" onClick={reset}>
            {t.hehunAgain}
          </button>
        </article>
      ) : (
        <ConsultFrame
          kicker={t.hehunAsideKicker}
          title={t.hehunTitle}
          quote={t.hehunQuote}
          desc={t.hehunDesc}
          note={t.hehunNote}
        >
          <form className="consult-form" onSubmit={onSubmit}>
            <p className="person-title">{t.male}</p>
            <div className="field">
              <label htmlFor="hehun-male-name">{t.name}</label>
              <div className="field-control">
                <input
                  id="hehun-male-name"
                  name="maleName"
                  autoComplete="name"
                  enterKeyHint="next"
                  maxLength={20}
                  placeholder={t.namePh}
                  value={maleName}
                  onChange={(event) => setMaleName(event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="hehun-male-birth">{t.bazi}</label>
              <div className="field-control">
                <BirthPicker
                  id="hehun-male-birth"
                  ref={malePickerRef}
                  value={maleBirth}
                  onChange={(next) => {
                    setMaleBirth(next)
                    setError('')
                  }}
                />
              </div>
            </div>

            <p className="person-title">{t.female}</p>
            <div className="field">
              <label htmlFor="hehun-female-name">{t.name}</label>
              <div className="field-control">
                <input
                  id="hehun-female-name"
                  name="femaleName"
                  autoComplete="name"
                  enterKeyHint="next"
                  maxLength={20}
                  placeholder={t.namePh}
                  value={femaleName}
                  onChange={(event) => setFemaleName(event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="hehun-female-birth">{t.bazi}</label>
              <div className="field-control">
                <BirthPicker
                  id="hehun-female-birth"
                  ref={femalePickerRef}
                  value={femaleBirth}
                  onChange={(next) => {
                    setFemaleBirth(next)
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

  .consult-form {
    position: relative;
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

  .person-title {
    margin: 0 0 0;
    padding: 0;
    border-top: 0;
    color: var(--zy-accent);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.2em;
    text-align: left;
  }

  .person-title + .field {
    margin-top: 12px;
  }

  .field + .person-title {
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid var(--zy-border);
  }

  .field {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    margin-top: 0;
  }

  .field + .field {
    margin-top: 16px;
  }

  .field > label {
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

  .consult-form input,
  && .consult-form .picker-trigger {
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

  && .consult-form .picker-trigger {
    display: flex;
    align-items: center;
    padding: 0 32px 0 11px;
    background-image:
      linear-gradient(45deg, transparent 50%, rgba(255, 255, 255, 0.45) 50%),
      linear-gradient(135deg, rgba(255, 255, 255, 0.45) 50%, transparent 50%);
    background-position:
      calc(100% - 16px) 52%,
      calc(100% - 11px) 52%;
    background-size:
      5px 5px,
      5px 5px;
    background-repeat: no-repeat;
    text-align: left;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .consult-form input:hover,
  && .consult-form .picker-trigger:hover {
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
    margin-top: 22px;
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
    margin: 12px 0 0;
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
    font-size: clamp(26px, 4.5vw, 36px);
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
    flex-direction: column;
    gap: 6px;
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
