import { useEffect, useRef } from 'react'
import styled from 'styled-components'
import { colorToCss, type DanmakuComment } from '../utils/danmaku'

const DURATION_MS = 25500
const FIXED_DURATION_MS = 4200
const MAX_VISIBLE = 36
const SPAWN_WINDOW = 0.35
const LANE_PAD = 6
const LANE_STEP = 30
const LANE_GAP_PX = 56

type Props = {
  comments: DanmakuComment[]
  currentTime: number
  playing: boolean
  enabled: boolean
}

type LiveItem = {
  id: number
  text: string
  color: string
  mode: number
  lane: number
  startAt: number
}

function laneCountForHeight(height: number) {
  return Math.max(1, Math.floor((height - LANE_PAD) / LANE_STEP))
}

function estimateClearMs(text: string, containerWidth: number) {
  const textW = Math.max(48, text.length * 17)
  const travel = Math.max(containerWidth, 320) + textW
  return Math.max(900, ((textW + LANE_GAP_PX) / travel) * DURATION_MS)
}

export default function DanmakuLayer({ comments, currentTime, playing, enabled }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef(0)
  const liveRef = useRef<LiveItem[]>([])
  const laneFreeAtRef = useRef<number[]>([])
  const idRef = useRef(0)
  const lastTimeRef = useRef(0)
  const pauseStartedAtRef = useRef(0)
  const pausedAccumRef = useRef(0)

  useEffect(() => {
    cursorRef.current = 0
    liveRef.current = []
    laneFreeAtRef.current = []
    lastTimeRef.current = 0
    pauseStartedAtRef.current = 0
    pausedAccumRef.current = 0
    const root = rootRef.current
    if (root) root.replaceChildren()
  }, [comments])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (playing) {
      if (pauseStartedAtRef.current) {
        pausedAccumRef.current += performance.now() - pauseStartedAtRef.current
        pauseStartedAtRef.current = 0
      }
      root.style.animationPlayState = 'running'
      for (const node of root.children) {
        ;(node as HTMLElement).style.animationPlayState = 'running'
      }
    } else {
      if (!pauseStartedAtRef.current) pauseStartedAtRef.current = performance.now()
      root.style.animationPlayState = 'paused'
      for (const node of root.children) {
        ;(node as HTMLElement).style.animationPlayState = 'paused'
      }
    }
  }, [playing])

  useEffect(() => {
    if (!enabled) {
      liveRef.current = []
      const root = rootRef.current
      if (root) root.replaceChildren()
      return
    }

    const root = rootRef.current
    if (!root) return

    const wall = performance.now()
    const pausedExtra = pauseStartedAtRef.current
      ? wall - pauseStartedAtRef.current
      : 0
    const now = wall - pausedAccumRef.current - pausedExtra
    const t = currentTime
    const prev = lastTimeRef.current
    lastTimeRef.current = t

    const height = root.clientHeight || 1
    const width = root.clientWidth || window.innerWidth
    const laneCount = laneCountForHeight(height)
    if (laneFreeAtRef.current.length !== laneCount) {
      const next = Array.from({ length: laneCount }, (_, i) => laneFreeAtRef.current[i] ?? 0)
      laneFreeAtRef.current = next
    }

    // 快进/回退时重置游标，避免漏弹或堆弹
    if (t + 1 < prev || t - prev > 2.5) {
      let i = 0
      while (i < comments.length && comments[i]!.time < t - 0.05) i += 1
      cursorRef.current = i
      liveRef.current = []
      laneFreeAtRef.current = Array.from({ length: laneCount }, () => 0)
      pauseStartedAtRef.current = 0
      pausedAccumRef.current = 0
      root.replaceChildren()
    }

    while (playing && cursorRef.current < comments.length) {
      const c = comments[cursorRef.current]!
      if (c.time > t + SPAWN_WINDOW) break
      if (c.time < t - SPAWN_WINDOW) {
        cursorRef.current += 1
        continue
      }
      if (liveRef.current.length >= MAX_VISIBLE) break

      let lane = -1
      for (let i = 0; i < laneCount; i += 1) {
        if ((laneFreeAtRef.current[i] ?? 0) <= now) {
          lane = i
          break
        }
      }
      // 没有空轨道就先不发，等下一帧再试，避免叠字
      if (lane < 0) break

      const isFixed = c.mode === 4 || c.mode === 5
      laneFreeAtRef.current[lane] = now + (isFixed ? FIXED_DURATION_MS : estimateClearMs(c.text, width))

      const id = ++idRef.current
      const item: LiveItem = {
        id,
        text: c.text,
        color: colorToCss(c.color),
        mode: c.mode,
        lane,
        startAt: now,
      }
      liveRef.current.push(item)

      const el = document.createElement('span')
      el.dataset.id = String(id)
      el.className = isFixed
        ? c.mode === 4
          ? 'dm is-bottom'
          : 'dm is-top'
        : 'dm is-scroll'
      el.textContent = c.text
      el.style.color = item.color
      el.style.top = `${LANE_PAD + lane * LANE_STEP}px`
      el.style.animationDuration = isFixed ? `${FIXED_DURATION_MS}ms` : `${DURATION_MS}ms`
      root.appendChild(el)
      cursorRef.current += 1
    }

    if (!playing) return

    liveRef.current = liveRef.current.filter((item) => {
      const life = item.mode === 4 || item.mode === 5 ? FIXED_DURATION_MS : DURATION_MS
      if (now - item.startAt < life) return true
      const node = root.querySelector(`[data-id="${item.id}"]`)
      node?.remove()
      return false
    })
  }, [comments, currentTime, playing, enabled])

  if (!enabled || !comments.length) return null

  return <Layer ref={rootRef} aria-hidden="true" />
}

const Layer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 20%;
  z-index: 2;
  overflow: hidden;
  pointer-events: none;

  .dm {
    position: absolute;
    left: 100%;
    white-space: nowrap;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: 0.02em;
    text-shadow:
      0 0 2px rgba(0, 0, 0, 0.85),
      1px 1px 2px rgba(0, 0, 0, 0.55);
    will-change: transform, opacity;
  }

  .is-scroll {
    animation-name: vod-dm-scroll;
    animation-timing-function: linear;
    animation-fill-mode: forwards;
  }

  .is-top,
  .is-bottom {
    left: 50%;
    transform: translateX(-50%);
    animation-name: vod-dm-fade;
    animation-timing-function: ease;
    animation-fill-mode: forwards;
  }

  @keyframes vod-dm-scroll {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(calc(-100vw - 100%));
    }
  }

  @keyframes vod-dm-fade {
    0% {
      opacity: 0;
    }
    12% {
      opacity: 1;
    }
    78% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  @media (max-width: 900px) {
    .dm {
      font-size: 14px;
    }
  }
`
