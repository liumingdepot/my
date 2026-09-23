import { useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { formatBazi, toTimestamp } from '../utils/calendar'
import { t } from '../utils/i18n'
import { fortunePortalRoot } from '../utils/portal'
import BirthPicker, { type BirthPickerHandle, type BirthSelection } from './BirthPicker'
import ConsultFrame from './ConsultFrame'
import GenderGroup, { type Gender } from './GenderGroup'
import { saveReport } from '../utils/reportHistory'
import styled from 'styled-components'

export default function ConsultForm() {
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender>('男')
  const [birth, setBirth] = useState<BirthSelection | null>(null)
  const [question, setQuestion] = useState('')
  const [error, setError] = useState<'' | 'date' | 'hour' | 'gender' | 'fail' | 'network'>('')
  const [serverError, setServerError] = useState('')
  const [pending, setPending] = useState(false)
  const pickerRef = useRef<BirthPickerHandle>(null)
  const navigate = useNavigate()

  const birthTimestamp = birth ? toTimestamp(birth.calendar, birth.birth, birth.shichen) : null

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!gender) {
      setServerError('')
      setError('gender')
      return
    }
    if (!birth || birthTimestamp == null) {
      setServerError('')
      setError('date')
      pickerRef.current?.open()
      return
    }
    setPending(true)
    setError('')
    setServerError('')

    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          gender,
          timestamp: birthTimestamp,
          shichen: birth.shichen,
          question: question.trim(),
        }),
      })
      const message = await response.text()
      if (!response.ok) {
        if (message) setServerError(message)
        else setError('fail')
        setPending(false)
        return
      }
      const nextName = name.trim()
      const payload = saveReport({
        kind: 'casual',
        title: `${nextName}的报告`,
        name: nextName,
        gender,
        bazi: formatBazi(birth.calendar, birth.birth, birth.shichen, birthTimestamp),
        question: question.trim(),
        report: message,
      })
      navigate(`/fortune/report?id=${payload.id}`, { state: payload })
    } catch {
      setError('network')
      setPending(false)
    }
  }

  const errorText =
    serverError ||
    (error === 'gender'
      ? t.needGender
      : error === 'date' || error === 'hour'
        ? t.needBirth
        : error === 'network'
          ? t.network
          : error === 'fail'
            ? t.fail
            : '')

  return (
    <Style>
      <ConsultFrame kicker={t.kicker} title={t.formTitle} quote={t.quote} desc={t.desc} note={t.note}>
        <form className="consult-form" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="name">{t.name}</label>
            <div className="field-control">
              <input
                id="name"
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
                value={gender}
                onChange={(next) => {
                  setGender(next)
                  setError('')
                }}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="birth">{t.bazi}</label>
            <div className="field-control">
              <input type="hidden" name="timestamp" value={birthTimestamp ?? ''} />
              <input type="hidden" name="shichen" value={birth?.shichen ?? ''} />
              <BirthPicker
                ref={pickerRef}
                value={birth}
                onChange={(next) => {
                  setBirth(next)
                  setError('')
                }}
              />
            </div>
          </div>

          <div className="field field-top">
            <label htmlFor="question">{t.question}</label>
            <div className="field-control">
              <textarea
                id="question"
                name="question"
                enterKeyHint="done"
                maxLength={300}
                placeholder={t.questionPh}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={pending}>
            {t.submit}
          </button>

          {errorText ? <p className="feedback error">{errorText}</p> : null}
        </form>
      </ConsultFrame>

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
  min-height: calc(100svh - var(--fortune-nav-height, 56px));

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .consult-form {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
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
    letter-spacing: 0.04em;
    text-align: left;
    line-height: 1.2;
  }

  .field-control {
    width: 100%;
    min-width: 0;
  }

  .consult-form input,
  .consult-form textarea {
    width: 100%;
    max-width: 100%;
    border: 1px solid var(--zy-border, #d9d9d9);
    border-radius: 6px;
    background: color-mix(in srgb, var(--zy-bg0) 55%, var(--zy-bg1));
    color: var(--zy-text-soft);
    font: 14px/1.5 var(--zy-font, -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif);
    color-scheme: dark;
    box-sizing: border-box;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .consult-form input {
    min-height: 40px;
    padding: 0 11px;
  }

  .consult-form textarea {
    min-height: 96px;
    padding: 8px 11px;
    resize: vertical;
  }

  .consult-form input:hover,
  .consult-form textarea:hover {
    border-color: var(--zy-border-hover, var(--zy-primary));
  }

  .consult-form input:focus,
  .consult-form textarea:focus {
    outline: none;
    border-color: var(--zy-primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--zy-primary) 12%, transparent);
  }

  .consult-form input::placeholder,
  .consult-form textarea::placeholder {
    color: color-mix(in srgb, var(--zy-muted) 60%, transparent);
  }

  .consult-form .submit-btn {
    width: 100%;
    min-height: 40px;
    margin-top: 24px;
    border: 1px solid var(--zy-primary);
    border-radius: 6px;
    background: var(--zy-primary);
    color: #fff;
    font: 14px/1 var(--zy-font, -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif);
    letter-spacing: 0.16em;
    cursor: pointer;
    touch-action: manipulation;
    transition: background 0.2s, border-color 0.2s, opacity 0.2s;
  }

  .consult-form .submit-btn:hover:not(:disabled) {
    background: var(--zy-primary-hover);
    border-color: var(--zy-primary-hover);
  }

  .consult-form .submit-btn:disabled {
    opacity: 0.55;
    cursor: default;
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

  .feedback {
    margin: 16px 0 0;
    line-height: 1.6;
    word-break: break-word;
    font-size: 13px;
  }

  .feedback.error {
    color: var(--zy-error, #ff4d4f);
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-mark {
      animation: none;
    }
  }

`
