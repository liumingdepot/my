import { useEffect, useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styled from 'styled-components'

const STORAGE_PREFIX = 'work-disclaimer-dismissed:'

type Props = {
  /** 模块标识，用于按模块单独记住「不再提示」 */
  moduleId: string
  children: ReactNode
}

function storageKey(moduleId: string) {
  return `${STORAGE_PREFIX}${moduleId}`
}

function isDismissed(moduleId: string): boolean {
  try {
    return localStorage.getItem(storageKey(moduleId)) === '1'
  } catch {
    return false
  }
}

function persistDismissed(moduleId: string) {
  try {
    localStorage.setItem(storageKey(moduleId), '1')
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * 作品进入声明：每次挂载该作品路由时弹出。
 * 勾选「不再提示」后点「我知道了」，会按模块写入 localStorage。
 * 周易等自有内容作品勿包裹此组件。
 */
export default function WorkDisclaimer({ moduleId, children }: Props) {
  const [open, setOpen] = useState(() => !isDismissed(moduleId))
  const [mute, setMute] = useState(false)
  const titleId = useId()
  const descId = useId()
  const muteId = useId()

  const close = () => {
    if (mute) persistDismissed(moduleId)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      {children}
      {open
        ? createPortal(
            <Mask role="presentation" onClick={() => setOpen(false)}>
              <Dialog
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descId}
                onClick={(e) => e.stopPropagation()}
              >
                <p className="eyebrow">声明</p>
                <h2 id={titleId} className="title">
                  仅供学习交流
                </h2>
                <div id={descId} className="body">
                  <p>
                    本站相关内容来自公开接口与网络资源，仅供个人学习、技术交流与演示，不用于任何商业用途。
                  </p>
                  <p>
                    若您认为相关内容侵犯了您的合法权益，请联系作者，将尽快核实并删除。
                  </p>
                </div>
                <label className="mute" htmlFor={muteId}>
                  <input
                    id={muteId}
                    type="checkbox"
                    checked={mute}
                    onChange={(e) => setMute(e.target.checked)}
                  />
                  <span>不再提示</span>
                </label>
                <button type="button" className="ok" onClick={close}>
                  我知道了
                </button>
              </Dialog>
            </Mask>,
            document.body,
          )
        : null}
    </>
  )
}

const Mask = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  animation: wdFadeIn 0.22s ease;
  box-sizing: border-box;
  color-scheme: dark;

  @keyframes wdFadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const Dialog = styled.div`
  width: min(100%, 420px);
  padding: 28px 28px 24px;
  border-radius: 16px;
  background: #141a2e;
  color: #e8eaf2;
  box-shadow:
    0 24px 56px rgba(0, 0, 0, 0.45),
    0 0 0 1px rgba(255, 255, 255, 0.08);
  animation: wdPop 0.28s cubic-bezier(0.22, 1, 0.36, 1);
  box-sizing: border-box;

  @keyframes wdPop {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  .eyebrow {
    margin: 0 0 8px;
    font-size: 12px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #6b7390;
    font-weight: 600;
  }

  .title {
    margin: 0 0 14px;
    font-size: 22px;
    font-weight: 700;
    line-height: 1.3;
    letter-spacing: -0.02em;
    color: #f1f5f9;
  }

  .body {
    margin: 0 0 14px;
    font-size: 14px;
    line-height: 1.7;
    color: #a0a8c0;

    p {
      margin: 0;
    }

    p + p {
      margin-top: 10px;
    }
  }

  .mute {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 18px;
    font-size: 12px;
    line-height: 1.4;
    color: #6b7390;
    cursor: pointer;
    user-select: none;

    input {
      width: 14px;
      height: 14px;
      margin: 0;
      accent-color: #e8eaf2;
      cursor: pointer;
      flex-shrink: 0;
    }

    &:hover {
      color: #a0a8c0;
    }
  }

  .ok {
    display: block;
    width: 100%;
    height: 44px;
    border: 0;
    border-radius: 10px;
    background: #e8eaf2;
    color: #0b1020;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.12s ease;

    &:hover {
      background: #fff;
    }

    &:active {
      transform: scale(0.98);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`
