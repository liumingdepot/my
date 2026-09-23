import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import ConsultFrame from '../model/ConsultFrame'
import { t } from '../utils/i18n'
import { drawLot, LOT_ACTIONS, type DrawResult, type LotMode } from '../utils/lots'
import { fortunePortalRoot } from '../utils/portal'
import { saveReport } from '../utils/reportHistory'
import styled from 'styled-components'

export default function OnlineLots() {
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [drawn, setDrawn] = useState<DrawResult | null>(null)

  async function run(mode: LotMode) {
    const action = LOT_ACTIONS.find((item) => item.mode === mode)
    if (action?.needQuestion && !question.trim()) {
      setError(t.lotsNeedQuestion)
      return
    }
    setError('')
    setPending(true)
    const result = drawLot(mode, question)
    setDrawn(result)
    try {
      const response = await fetch('/api/lots', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode,
          label: result.label,
          payload: result.payload,
          question: question.trim() || undefined,
        }),
      })
      const message = await response.text()
      if (!response.ok) {
        setError(message || t.fail)
        setPending(false)
        return
      }
      const payload = saveReport({
        kind: 'lots',
        title: `${result.label} · ${result.summary}`,
        name: result.label,
        question: question.trim() || result.summary,
        meta: [result.summary],
        report: message,
      })
      navigate(`/fortune/report?id=${payload.id}`, { state: payload })
    } catch {
      setError(t.network)
      setPending(false)
    }
  }

  return (
    <Style>
      <ConsultFrame
        kicker={t.lotsAsideKicker}
        title={t.lotsTitle}
        quote={t.lotsQuote}
        desc={t.lotsDesc}
        note={t.lotsNote}
      >
        <div className="lots-panel">
          <div className="field">
            <label htmlFor="lots-question">{t.lotsQuestionOptional}</label>
            <div className="field-control">
              <textarea
                id="lots-question"
                name="question"
                rows={3}
                maxLength={200}
                placeholder={t.lotsQuestionPh}
                value={question}
                onChange={(event) => {
                  setQuestion(event.target.value)
                  setError('')
                }}
              />
            </div>
          </div>
          <div className="actions" role="group" aria-label={t.lotsTitle}>
            {LOT_ACTIONS.map((item) => (
              <button
                key={item.mode}
                type="button"
                className="lot-btn"
                disabled={pending}
                onClick={() => run(item.mode)}
              >
                <span className="lot-title">{item.title}</span>
                <span className="lot-hint">{item.hint}</span>
              </button>
            ))}
          </div>
          {error ? <p className="feedback">{error}</p> : null}
        </div>
      </ConsultFrame>
      {pending
        ? createPortal(
            <Style>
              <div className="loading" role="status" aria-live="polite">
                <div className="loading-mark" aria-hidden="true" />
                <p>{drawn ? `${drawn.label} · ${drawn.summary}` : t.lotsDrawing}</p>
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

  .lots-panel {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field label {
    color: var(--zy-muted);
    font-size: 13px;
    letter-spacing: 0.08em;
  }

  .field-control textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: 84px;
    padding: 12px 14px;
    border: 1px solid var(--zy-border);
    border-radius: 6px;
    background: color-mix(in srgb, var(--zy-bg0) 55%, transparent);
    color: var(--zy-text-soft);
    font: 14px/1.6 var(--zy-font);
    letter-spacing: 0.04em;
    resize: vertical;
    outline: none;
    transition: border-color 0.2s ease;
  }

  .field-control textarea:focus {
    border-color: var(--zy-border-hover);
  }

  .field-control textarea::placeholder {
    color: color-mix(in srgb, var(--zy-muted) 80%, transparent);
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .lot-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    width: 100%;
    padding: 14px 16px;
    border: 1px solid var(--zy-border);
    border-radius: 8px;
    background: color-mix(in srgb, var(--zy-bg0) 40%, transparent);
    color: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      border-color 0.2s ease,
      background 0.2s ease,
      transform 0.2s ease;
  }

  .lot-btn:hover:not(:disabled) {
    border-color: var(--zy-border-hover);
    background: color-mix(in srgb, var(--zy-primary) 12%, transparent);
    transform: translateY(-1px);
  }

  .lot-btn:disabled {
    opacity: 0.65;
    cursor: wait;
  }

  .lot-title {
    color: var(--zy-text-soft);
    font: 500 15px/1.3 var(--zy-serif);
    letter-spacing: 0.12em;
  }

  .lot-hint {
    color: var(--zy-muted);
    font-size: 12px;
    letter-spacing: 0.06em;
  }

  .feedback {
    margin: 0;
    color: var(--zy-error);
    font-size: 13px;
    letter-spacing: 0.04em;
  }

  .loading {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: grid;
    place-content: center;
    gap: 16px;
    background: color-mix(in srgb, var(--zy-bg0) 72%, transparent);
    backdrop-filter: blur(8px);
  }

  .loading-mark {
    width: 36px;
    height: 36px;
    margin: 0 auto;
    border: 2px solid color-mix(in srgb, var(--zy-accent) 25%, transparent);
    border-top-color: var(--zy-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .loading p {
    margin: 0;
    color: var(--zy-text);
    font-size: 14px;
    letter-spacing: 0.12em;
    text-align: center;
  }
`
