import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import styled from 'styled-components'

export type ProjectFormValues = {
  title: string
  prompt: string
}

type Mode = 'create' | 'rename'

type Props = {
  mode: Mode
  open: boolean
  submitting?: boolean
  initial?: Partial<ProjectFormValues>
  error?: string
  onClose: () => void
  onSubmit: (values: ProjectFormValues) => void | Promise<void>
}

export default function ProjectDialog({
  mode,
  open,
  submitting = false,
  initial,
  error = '',
  onClose,
  onSubmit,
}: Props) {
  const titleId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState(initial?.title || '')
  const [prompt, setPrompt] = useState(initial?.prompt || '')
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle(initial?.title || '')
    setPrompt(initial?.prompt || '')
    setLocalError('')
    const t = window.setTimeout(() => inputRef.current?.focus(), 30)
    return () => window.clearTimeout(t)
  }, [open, initial?.title, initial?.prompt])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, submitting, onClose])

  if (!open) return null

  const heading = mode === 'create' ? '新建短剧项目' : '编辑项目名称'
  const submitLabel = mode === 'create' ? '创建并进入' : '保存'

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const nextTitle = title.trim()
    if (!nextTitle) {
      setLocalError('请填写项目名称')
      inputRef.current?.focus()
      return
    }
    setLocalError('')
    void onSubmit({ title: nextTitle, prompt: prompt.trim() })
  }

  return (
    <Mask
      onClick={() => {
        if (!submitting) onClose()
      }}
    >
      <Form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 id={titleId} className="heading">
          {heading}
        </h2>
        <p className="sub">
          {mode === 'create'
            ? '先填入基本信息，再进入无限画布编排分镜与角色。'
            : '修改后会立即同步到历史列表。'}
        </p>

        <label className="field">
          <span>
            项目名称 <em>*</em>
          </span>
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：雨夜巷口"
            maxLength={80}
            autoComplete="off"
            disabled={submitting}
          />
        </label>

        {mode === 'create' ? (
          <label className="field">
            <span>创作提示（可选）</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="一句话描述短剧想法，可在画布中继续细化…"
              rows={3}
              maxLength={500}
              disabled={submitting}
            />
          </label>
        ) : null}

        {localError || error ? (
          <p className="form-error">{localError || error}</p>
        ) : null}

        <div className="actions">
          <button type="button" className="btn" onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button type="submit" className="btn primary" disabled={submitting}>
            {submitting ? (mode === 'create' ? '创建中…' : '保存中…') : submitLabel}
          </button>
        </div>
      </Form>
    </Mask>
  )
}

const Mask = styled.div`
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  background: rgba(4, 8, 12, 0.72);
  backdrop-filter: blur(8px);
`

const Form = styled.form`
  width: min(420px, 100%);
  padding: 1.35rem 1.35rem 1.2rem;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background:
    radial-gradient(420px 180px at 10% -20%, rgba(61, 214, 198, 0.14), transparent 60%),
    linear-gradient(165deg, #141b24 0%, #0e141c 100%);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
  color: var(--ink, #eef2f7);

  .heading {
    margin: 0;
    font-family: var(--display, inherit);
    font-size: 1.2rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .sub {
    margin: 0.4rem 0 1.15rem;
    font-size: 0.86rem;
    line-height: 1.55;
    color: var(--muted, rgba(238, 242, 247, 0.62));
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: 0.95rem;
    font-size: 0.82rem;
    color: var(--soft, rgba(238, 242, 247, 0.42));

    em {
      font-style: normal;
      color: var(--accent, #3dd6c6);
    }

    input,
    textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 0.7rem 0.85rem;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(0, 0, 0, 0.28);
      color: inherit;
      font: inherit;
      font-size: 0.92rem;
      resize: vertical;
      outline: none;
      transition: border-color 0.2s;

      &::placeholder {
        color: rgba(238, 242, 247, 0.32);
      }

      &:focus {
        border-color: rgba(61, 214, 198, 0.55);
      }

      &:disabled {
        opacity: 0.7;
      }
    }
  }

  .form-error {
    margin: -0.2rem 0 0.85rem;
    padding: 0.55rem 0.7rem;
    border-radius: 8px;
    border: 1px solid rgba(253, 164, 164, 0.35);
    background: rgba(253, 164, 164, 0.08);
    color: #fda4a4;
    font-size: 0.82rem;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    margin-top: 0.25rem;
  }

  .btn {
    padding: 0.58rem 1rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: inherit;
    font: inherit;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.2s,
      border-color 0.2s,
      opacity 0.2s;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.08);
    }

    &:disabled {
      opacity: 0.65;
      cursor: wait;
    }

    &.primary {
      border: none;
      color: #061018;
      background: linear-gradient(135deg, var(--accent, #3dd6c6) 0%, #7ef0df 70%);

      &:hover:not(:disabled) {
        filter: brightness(1.05);
      }
    }
  }
`
