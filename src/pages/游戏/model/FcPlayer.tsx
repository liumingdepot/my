import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Browser, Controller } from 'jsnes'
import styled from 'styled-components'
import { captureThumbnail, decodeFcState, encodeFcState } from '../utils/fcSaveState'
import type { PlayerSaveApi } from '../utils/saveStore'
import { gameRomUrl, type GameCheat } from '../utils/server'

export type FcPlayerControls = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  paused: boolean
  togglePause: () => void
  hardReset: () => void
  /** 即时存档能力；在打开面板时才求值 */
  getSaveApi: () => PlayerSaveApi | null
}

type Props = {
  gameId: string
  gameName: string
  /** 由外层渲染暂停/重置时传入，组件内不再显示底部栏 */
  onControlsChange?: (controls: FcPlayerControls) => void
  hideBar?: boolean
  /** 可用金手指 */
  cheats?: GameCheat[]
  /** 已开启的金手指下标集合 */
  enabledCheats?: ReadonlySet<number>
}

type KeyMap = Record<number, [number, number, string]>

// P1: WASD / JKL / UI · Enter=Start · Ctrl=Select
// P2: 方向键 / 1 2 / 4 5
const PLAYER_KEYS: KeyMap = {
  // Player 1
  87: [1, Controller.BUTTON_UP, 'W'],
  65: [1, Controller.BUTTON_LEFT, 'A'],
  83: [1, Controller.BUTTON_DOWN, 'S'],
  68: [1, Controller.BUTTON_RIGHT, 'D'],
  74: [1, Controller.BUTTON_B, 'J'],
  75: [1, Controller.BUTTON_A, 'K'],
  76: [1, Controller.BUTTON_TURBO_A, 'L'],
  85: [1, Controller.BUTTON_SELECT, 'U'],
  73: [1, Controller.BUTTON_START, 'I'],
  13: [1, Controller.BUTTON_START, 'Enter'],
  17: [1, Controller.BUTTON_SELECT, 'Ctrl'],
  // Player 2
  38: [2, Controller.BUTTON_UP, 'Up'],
  40: [2, Controller.BUTTON_DOWN, 'Down'],
  37: [2, Controller.BUTTON_LEFT, 'Left'],
  39: [2, Controller.BUTTON_RIGHT, 'Right'],
  49: [2, Controller.BUTTON_B, '1'],
  50: [2, Controller.BUTTON_A, '2'],
  52: [2, Controller.BUTTON_SELECT, '4'],
  53: [2, Controller.BUTTON_START, '5'],
}

/** Slightly slower than real NES (~60fps); also stops catch-up bursts that feel too fast. */
const TARGET_FPS = 50

type FrameTimerLike = {
  interval: number
  lastFrameTime: number | false
  requestAnimationFrame: () => void
  generateFrame: () => void
  onWriteFrame: () => void
  onAnimationFrame: (time: number) => void
}

/** jsnes 未在类型里暴露 cpu，这里只用到主内存 */
type NesMemory = { cpu?: { mem?: Uint8Array } }

function applyControlsAndSpeed(browser: Browser, onBeforeFrame: () => void) {
  browser.keyboard.setKeys(PLAYER_KEYS)

  const timer = (browser as unknown as { _frameTimer: FrameTimerLike })._frameTimer
  timer.interval = 1000 / TARGET_FPS
  timer.onAnimationFrame = (time: number) => {
    timer.requestAnimationFrame()
    const excess = time % timer.interval
    const newFrameTime = time - excess
    if (!timer.lastFrameTime) {
      timer.lastFrameTime = newFrameTime
      return
    }
    const numFrames = Math.round((newFrameTime - timer.lastFrameTime) / timer.interval)
    if (numFrames === 0) return
    // Cap at 1 frame — avoid multi-frame catch-up that makes games feel sped up
    onBeforeFrame()
    timer.generateFrame()
    timer.onWriteFrame()
    timer.lastFrameTime = newFrameTime
  }
}

function loadRomAsBinaryString(url: string, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = new XMLHttpRequest()
    req.open('GET', url)
    req.overrideMimeType('text/plain; charset=x-user-defined')
    req.onload = () => {
      if (req.status === 200) resolve(req.responseText)
      else reject(new Error(`ROM 加载失败 (${req.status})`))
    }
    req.onerror = () => reject(new Error('ROM 网络错误'))
    req.onabort = () => reject(new Error('已取消'))
    signal?.addEventListener('abort', () => req.abort(), { once: true })
    req.send()
  })
}

function formatEmulatorError(err: unknown): string {
  const message = err instanceof Error ? err.message : 'ROM 加载失败'
  const mapper = /^Unsupported mapper:\s*(\d+)$/i.exec(message)
  if (mapper) {
    return `当前模拟器暂不支持该 ROM 的 Mapper ${mapper[1]}`
  }
  return message
}

export default function FcPlayer({
  gameId,
  gameName,
  onControlsChange,
  hideBar,
  cheats,
  enabledCheats,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const browserRef = useRef<Browser | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState('')
  const [paused, setPaused] = useState(false)
  const [bootKey, setBootKey] = useState(0)

  function togglePause() {
    const browser = browserRef.current
    if (!browser || status !== 'ready') return
    if (paused) {
      browser.start()
      setPaused(false)
    } else {
      browser.stop()
      setPaused(true)
    }
  }

  function hardReset() {
    if (status !== 'ready' && status !== 'error') return
    setBootKey((n) => n + 1)
  }

  const reportControls = useEffectEvent((next: FcPlayerControls) => {
    onControlsChange?.(next)
  })

  const getSaveApi = (): PlayerSaveApi | null => {
    const browser = browserRef.current
    if (!browser || status !== 'ready') return null
    return {
      save: () => {
        const live = browserRef.current
        if (!live) return null
        try {
          return {
            data: encodeFcState(live.nes),
            thumbnail: captureThumbnail(containerRef.current?.querySelector('canvas')),
          }
        } catch {
          return null
        }
      },
      load: (data) => {
        const live = browserRef.current
        if (!live || typeof data !== 'string') return false
        return decodeFcState(live.nes, data)
      },
    }
  }

  useEffect(() => {
    reportControls({ status, paused, togglePause, hardReset, getSaveApi })
  }, [status, paused, bootKey])

  // 金手指在每帧渲染前写入 NES 主内存；游戏本帧若改写该地址，下一帧会被再次覆盖，
  // 达到「生命数 / 无敌 / 道具」这类持续生效的效果。
  const writeCheats = useEffectEvent(() => {
    if (!cheats?.length || !enabledCheats?.size) return
    const mem = (browserRef.current?.nes as NesMemory | undefined)?.cpu?.mem
    if (!mem) return
    for (const cheat of cheats) {
      if (!enabledCheats.has(cheat.index)) continue
      for (let i = 0; i < cheat.bytes.length; i++) {
        mem[(cheat.address + i) & 0xffff] = cheat.bytes[i] & 0xff
      }
    }
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const ac = new AbortController()
    let browser: Browser | null = null

    ;(async () => {
      setStatus('loading')
      setError('')
      setPaused(false)
      try {
        const romData = await loadRomAsBinaryString(gameRomUrl(gameId), ac.signal)
        if (ac.signal.aborted) return

        browser = new Browser({
          container,
          onError: (err) => {
            setStatus('error')
            setError(formatEmulatorError(err))
          },
        })
        applyControlsAndSpeed(browser, writeCheats)
        browserRef.current = browser
        browser.loadROM(romData)
        browser.fitInParent()
        setStatus('ready')
      } catch (err) {
        if (ac.signal.aborted) return
        setStatus('error')
        setError(formatEmulatorError(err))
      }
    })()

    const onResize = () => browserRef.current?.fitInParent()
    window.addEventListener('resize', onResize)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null
    ro?.observe(container)

    return () => {
      ac.abort()
      window.removeEventListener('resize', onResize)
      ro?.disconnect()
      browser?.destroy()
      browserRef.current = null
      container.replaceChildren()
    }
  }, [gameId, bootKey])

  return (
    <Style $fill={Boolean(hideBar)}>
      <div className="stage">
        <div ref={containerRef} className="screen" aria-label={`${gameName} 游戏画面`} />
        {status === 'loading' ? <div className="overlay">加载中…</div> : null}
        {status === 'error' ? <div className="overlay overlay--err">{error}</div> : null}
        {status === 'ready' && paused ? <div className="overlay">已暂停</div> : null}
      </div>

      {!hideBar ? (
        <div className="bar">
          <button type="button" className="btn" disabled={status !== 'ready'} onClick={togglePause}>
            {paused ? '继续' : '暂停'}
          </button>
          <button type="button" className="btn" disabled={status !== 'ready' && status !== 'error'} onClick={hardReset}>
            重置
          </button>
        </div>
      ) : null}
    </Style>
  )
}

const Style = styled.div<{ $fill?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${(p) => (p.$fill ? '0' : '0.9rem')};
  width: 100%;
  ${(p) => (p.$fill ? 'flex: 1; min-height: 0;' : '')}

  .stage {
    position: relative;
    border-radius: 0.9rem;
    overflow: hidden;
    border: 1px solid var(--line);
    background: #0a0c12;
    box-shadow: var(--shadow);
    ${(p) =>
      p.$fill
        ? `
      flex: 1;
      min-height: 0;
      width: 100%;
      container-type: size;
      display: grid;
      place-items: center;
    `
        : `
      width: 100%;
      aspect-ratio: 256 / 240;
    `}
  }

  .screen {
    ${(p) =>
      p.$fill
        ? `
      aspect-ratio: 256 / 240;
      width: min(100cqw, calc(100cqh * 256 / 240));
      height: min(100cqh, calc(100cqw * 240 / 256));
    `
        : `
      width: 100%;
      height: 100%;
    `}
  }

  .screen canvas {
    display: block;
    width: 100% !important;
    height: 100% !important;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  .overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 1rem;
    text-align: center;
    background: color-mix(in srgb, var(--bg) 55%, transparent);
    color: var(--ink);
    font-size: 0.95rem;
    backdrop-filter: blur(4px);
  }

  .overlay--err {
    color: var(--danger);
  }

  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.55rem 0.75rem;
  }

  .btn {
    height: 36px;
    padding: 0 1rem;
    border-radius: 0.65rem;
    border: 1px solid var(--line);
    background: var(--bg);
    color: var(--ink);
    font-size: 0.86rem;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      color 0.15s ease,
      background 0.15s ease;
  }

  .btn:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--purple) 40%, transparent);
    color: var(--purple);
    background: var(--accent-soft);
  }

  .btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
`
