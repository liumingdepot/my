import { useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { formatBazi, toTimestamp } from '../utils/calendar'
import { t } from '../utils/i18n'
import BirthPicker, { type BirthPickerHandle, type BirthSelection } from './BirthPicker'
import ConsultFrame from './ConsultFrame'
import { saveReport } from './ReportPage'
import styled from 'styled-components'

export default function ConsultForm() {
  const [name, setName] = useState('')
  const [birth, setBirth] = useState<BirthSelection | null>(null)
  const [question, setQuestion] = useState('')
  const [error, setError] = useState<'' | 'date' | 'hour' | 'fail' | 'network'>('')
  const [serverError, setServerError] = useState('')
  const [pending, setPending] = useState(false)
  const pickerRef = useRef<BirthPickerHandle>(null)
  const navigate = useNavigate()

  const birthTimestamp = birth ? toTimestamp(birth.calendar, birth.birth, birth.shichen) : null

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
      const payload = {
        name: name.trim(),
        bazi: formatBazi(birth.calendar, birth.birth, birth.shichen, birthTimestamp),
        question: question.trim(),
        report: message,
      }
      saveReport(payload)
      navigate('/fortune/report', { state: payload })
    } catch {
      setError('network')
      setPending(false)
    }
  }

  const errorText =
    serverError ||
    (error === 'date' || error === 'hour'
      ? t.needBirth
      : error === 'network'
        ? t.network
        : error === 'fail'
          ? t.fail
          : '')

  return (
    <Style>
      <ConsultFrame kicker={t.kicker} quote={t.quote} note={t.note}>
        <form className="consult-form" onSubmit={onSubmit}>
          <p className="eyebrow">{t.formEyebrow}</p>
          <h2>{t.formTitle}</h2>

          <label htmlFor="name">{t.name}</label>
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

          <label htmlFor="birth">{t.bazi}</label>
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

          <label htmlFor="question">{t.question}</label>
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

  .consult h2 {
    margin: 0;
    color: #f3e6c8;
    font-size: clamp(32px, 8vw, 48px);
    font-weight: 500;
    letter-spacing: 0.16em;
  }

  .consult-form label {
    display: block;
    margin: 22px 0 8px;
    color: #c4a36a;
    font-size: 14px;
    letter-spacing: 0.22em;
  }

  .consult-form input,
  .consult-form textarea {
    width: 100%;
    max-width: 100%;
    border: 1px solid rgba(214, 186, 138, 0.45);
    border-radius: 10px;
    background: rgba(255, 248, 235, 0.03);
    color: #f6edd8;
    font: 16px/1.5 ui-serif, "Songti SC", "STSong", "SimSun", serif;
    color-scheme: dark;
    box-sizing: border-box;
  }

  .consult-form input {
    min-height: 48px;
    padding: 0 14px;
  }

  .consult-form textarea {
    min-height: 120px;
    padding: 12px 14px;
    resize: vertical;
  }

  .consult-form input:focus,
  .consult-form textarea:focus {
    outline: 1px solid #e0c48a;
    outline-offset: 2px;
  }

  .consult-form input::placeholder,
  .consult-form textarea::placeholder {
    color: rgba(232, 220, 198, 0.38);
  }

  .consult-form .submit-btn {
    width: 100%;
    min-height: 48px;
    margin-top: 28px;
    border: 1px solid #d4ae62;
    border-radius: 10px;
    background: transparent;
    color: #f6edd8;
    font: 16px/1 ui-serif, "Songti SC", "STSong", "SimSun", serif;
    letter-spacing: 0.36em;
    cursor: pointer;
    touch-action: manipulation;
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

  .feedback {
    margin: 22px 0 0;
    line-height: 1.8;
    word-break: break-word;
  }

  .feedback.error {
    color: #d4786a;
    letter-spacing: 0.08em;
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
  }
`
