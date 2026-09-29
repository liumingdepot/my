import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import styled from 'styled-components'
import type { SimId } from '../utils/catalog'
import {
  MacUpdate,
  Win10Update,
  Win11Update,
  WinBsod,
  WinChkdsk,
  WinNoSignal,
  WinRepair,
  WinRestore,
  WinStuck,
} from './sims'

type Props = {
  id: SimId
  onExit: () => void
}

const SIM_MAP = {
  'win-bsod': WinBsod,
  'win-repair': WinRepair,
  'win-chkdsk': WinChkdsk,
  'win-restore': WinRestore,
  'win-nosignal': WinNoSignal,
  'win10-update': Win10Update,
  'win11-update': Win11Update,
  'win-stuck': WinStuck,
  'mac-update': MacUpdate,
} as const

export default function SimStage({ id, onExit }: Props) {
  const [tip, setTip] = useState(true)
  const Sim = SIM_MAP[id]

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKey)
    const timer = window.setTimeout(() => setTip(false), 3200)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(timer)
    }
  }, [onExit])

  return createPortal(
    <Stage>
      <Sim />
      <button type="button" className="exit" onClick={onExit} aria-label="退出模拟">
        ✕
      </button>
      {tip ? <p className="tip">按 Esc 退出 · 仅供娱乐</p> : null}
    </Stage>,
    document.body,
  )
}

const Stage = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #000;

  .exit {
    position: absolute;
    top: 14px;
    right: 14px;
    z-index: 2;
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.85);
    font-size: 16px;
    cursor: pointer;
    opacity: 0.35;
    transition: opacity 0.2s ease, background 0.2s ease;
  }

  .exit:hover,
  .exit:focus-visible {
    opacity: 1;
    background: rgba(255, 255, 255, 0.22);
    outline: none;
  }

  .tip {
    position: absolute;
    left: 50%;
    bottom: 28px;
    z-index: 2;
    transform: translateX(-50%);
    margin: 0;
    padding: 8px 14px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.45);
    color: rgba(255, 255, 255, 0.88);
    font-size: 13px;
    letter-spacing: 0.02em;
    pointer-events: none;
    animation: fade 0.4s ease both;
  }

  @keyframes fade {
    from {
      opacity: 0;
      transform: translate(-50%, 6px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }
`
