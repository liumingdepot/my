import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { gameRomUrl } from '../utils/server'

type Props = {
  gameId: string
  gameName: string
  downloadUrl: string
  /** 同域 flashrom 资源根，如 `/api/game/flashrom/bvn2/` */
  flashBase?: string
}

type RufflePlayer = HTMLElement & {
  load: (options: Record<string, unknown>) => Promise<void>
  remove?: () => void
  config?: Record<string, unknown>
  ruffle?: () => { config?: Record<string, unknown>; load: (options: Record<string, unknown>) => Promise<void> }
}

type RuffleWindow = Window & {
  RufflePlayer?: {
    newest: () => { createPlayer: () => RufflePlayer }
  }
}

const RUFFLE_SRC = 'https://unpkg.com/@ruffle-rs/ruffle'

let ruffleLoader: Promise<void> | null = null

function loadRuffle(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  const w = window as RuffleWindow
  if (w.RufflePlayer) return Promise.resolve()
  if (ruffleLoader) return ruffleLoader

  ruffleLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RUFFLE_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Ruffle 加载失败')), { once: true })
      if (w.RufflePlayer) resolve()
      return
    }
    const script = document.createElement('script')
    script.src = RUFFLE_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      ruffleLoader = null
      reject(new Error('Ruffle 加载失败'))
    }
    document.head.appendChild(script)
  })

  return ruffleLoader
}

function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).href
}

export default function WebPlayer({ gameId, gameName, downloadUrl, flashBase = '' }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cancelled = false
    let player: RufflePlayer | null = null

    ;(async () => {
      setStatus('loading')
      setError('')
      try {
        await loadRuffle()
        if (cancelled) return
        const w = window as RuffleWindow
        const create = w.RufflePlayer?.newest()?.createPlayer
        if (!create) throw new Error('Ruffle 不可用')

        const rom = absoluteUrl(gameRomUrl(gameId, downloadUrl))
        const res = await fetch(rom)
        if (!res.ok) {
          let message = `SWF 加载失败 (${res.status})`
          try {
            const body = (await res.clone().json()) as { error?: string }
            if (body.error) message = body.error
          } catch {
            /* ignore */
          }
          throw new Error(message)
        }
        const data = await res.arrayBuffer()
        if (!data.byteLength) throw new Error('SWF 文件为空')
        if (cancelled) return

        host.replaceChildren()
        player = create()
        player.style.width = '100%'
        player.style.height = '100%'
        host.appendChild(player)

        // 与 yikm flashinit 一致：有 rombase 时配置资源根，再用 data 加载主 SWF
        if (flashBase) {
          const base = absoluteUrl(flashBase)
          player.config = { ...(player.config || {}), base }
          const inner = player.ruffle?.()
          if (inner) inner.config = { ...(inner.config || {}), base }
        }

        await player.load({
          data,
          autoplay: 'on',
          unmuteOverlay: 'hidden',
        })
        if (!cancelled) setStatus('ready')
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setError(err instanceof Error ? err.message : '加载失败')
        }
      }
    })()

    return () => {
      cancelled = true
      try {
        player?.remove?.()
      } catch {
        /* ignore */
      }
      host.replaceChildren()
    }
  }, [gameId, downloadUrl, flashBase])

  return (
    <Style>
      <div className="stage" aria-label={`${gameName} 网页游戏`}>
        <div ref={hostRef} className="host" />
        {status === 'loading' ? <p className="overlay">加载中…</p> : null}
        {status === 'error' ? (
          <p className="overlay overlay--err">{error || '无法运行该游戏'}</p>
        ) : null}
      </div>
    </Style>
  )
}

const Style = styled.div`
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;

  .stage {
    position: relative;
    flex: 1;
    min-height: 280px;
    border-radius: 0.85rem;
    overflow: hidden;
    background: #0a0c14;
    border: 1px solid color-mix(in srgb, var(--line) 80%, transparent);
  }

  .host {
    position: absolute;
    inset: 0;
  }

  .host ruffle-player,
  .host canvas {
    width: 100% !important;
    height: 100% !important;
  }

  .overlay {
    position: absolute;
    inset: 0;
    z-index: 2;
    margin: 0;
    display: grid;
    place-items: center;
    background: rgba(8, 10, 22, 0.72);
    color: #e8eaf2;
    font-size: 0.92rem;
    pointer-events: none;
  }

  .overlay--err {
    color: #fb7185;
    padding: 1rem;
    text-align: center;
  }
`
