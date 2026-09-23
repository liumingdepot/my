import { useEffect, useState } from 'react'
import styled from 'styled-components'

const HOURS = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const BAGUA = ['坎', '艮', '震', '巽', '离', '坤', '兑', '乾']

const CX = 300
const CY = 300

function polar(index: number, total: number, radius: number) {
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2
  return {
    x: CX + Math.cos(angle) * radius,
    y: CY + Math.sin(angle) * radius,
  }
}

function useNow() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  return now
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export default function AncientClock() {
  const now = useNow()
  const hours = now.getHours()
  const minutes = now.getMinutes()
  const seconds = now.getSeconds()
  const minutesFromZi = (hours * 60 + minutes + 60) % (24 * 60)
  const shichenIndex = Math.floor(minutesFromZi / 120)
  const hourAngle = (minutesFromZi / (24 * 60)) * 360
  const minuteAngle = (minutes + seconds / 60) * 6
  const secondAngle = seconds * 6

  const ticks = Array.from({ length: 60 }, (_, index) => {
    const major = index % 5 === 0
    const angle = (index / 60) * Math.PI * 2 - Math.PI / 2
    const inner = major ? 242 : 250
    const outer = 266
    return {
      major,
      x1: CX + Math.cos(angle) * inner,
      y1: CY + Math.sin(angle) * inner,
      x2: CX + Math.cos(angle) * outer,
      y2: CY + Math.sin(angle) * outer,
    }
  })

  const stars = Array.from({ length: 42 }, (_, index) => {
    const angle = ((index * 137.508) * Math.PI) / 180
    const radius = 62 + (index % 6) * 12
    return {
      cx: CX + Math.cos(angle) * radius,
      cy: CY + Math.sin(angle) * radius,
      r: index % 5 === 0 ? 1.5 : 0.8,
    }
  })

  return (
    <Style>
      <figure className="instrument">
        <svg viewBox="0 0 600 600" role="img" aria-label="旋转的古代时辰钟">
          <defs>
            <radialGradient id="dial" cx="50%" cy="46%" r="52%">
              <stop offset="0%" stopColor="#1c232b" />
              <stop offset="55%" stopColor="#141a20" />
              <stop offset="100%" stopColor="#0e1318" />
            </radialGradient>
            <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#5eead4" />
              <stop offset="48%" stopColor="#14b8a6" />
              <stop offset="100%" stopColor="#0f766e" />
            </linearGradient>
            <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="10" stdDeviation="16" floodColor="#14b8a6" floodOpacity="0.22" />
            </filter>
          </defs>

          <circle cx={CX} cy={CY} r="286" fill="url(#dial)" filter="url(#soft)" />
          <circle cx={CX} cy={CY} r="276" fill="none" stroke="url(#rim)" strokeWidth="2.5" />
          <circle cx={CX} cy={CY} r="268" fill="none" stroke="#334155" strokeWidth="0.6" opacity="0.9" />
          <circle cx={CX} cy={CY} r="214" fill="none" stroke="#475569" strokeWidth="0.6" opacity="0.55" />

          {ticks.map((tick) => (
            <line
              key={`${tick.x1}-${tick.y1}`}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke={tick.major ? '#2dd4bf' : '#64748b'}
              strokeWidth={tick.major ? 2 : 0.8}
              strokeLinecap="round"
            />
          ))}

          {HOURS.map((name, index) => {
            const point = polar(index, 12, 228)
            return (
              <text
                key={name}
                x={point.x}
                y={point.y}
                className="glyph hour"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {name}
              </text>
            )
          })}

          {BAGUA.map((name, index) => {
            const point = polar(index, 8, 188)
            return (
              <text
                key={name}
                x={point.x}
                y={point.y}
                className="glyph bagua"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {name}
              </text>
            )
          })}

          <g className="orbit orbit-stars">
            {stars.map((star) => (
              <circle key={`${star.cx}-${star.cy}`} cx={star.cx} cy={star.cy} r={star.r} fill="#5eead4" opacity="0.5" />
            ))}
            <circle cx={CX} cy={CY} r="148" fill="none" stroke="#99f6e4" strokeWidth="0.6" opacity="0.4" />
            <circle cx={CX} cy={CY} r="108" fill="none" stroke="#5eead4" strokeWidth="0.5" opacity="0.32" />
            <circle cx={CX} cy={CY} r="72" fill="none" stroke="#2dd4bf" strokeWidth="0.5" opacity="0.28" />
          </g>

          <g className="orbit orbit-ring">
            {Array.from({ length: 24 }, (_, index) => {
              const point = polar(index, 24, 162)
              return (
                <circle
                  key={index}
                  cx={point.x}
                  cy={point.y}
                  r={index % 2 === 0 ? 2 : 1}
                  fill="#14b8a6"
                  opacity="0.55"
                />
              )
            })}
          </g>

          <g className="taiji">
            <circle cx={CX} cy={CY} r="46" fill="#e8eef2" stroke="#64748b" strokeWidth="1" />
            <path d="M300 254a46 46 0 0 1 0 92 23 23 0 0 1 0-46 23 23 0 0 0 0-46" fill="#0b0f14" />
            <circle cx={CX} cy={CY - 23} r="7" fill="#0b0f14" />
            <circle cx={CX} cy={CY + 23} r="7" fill="#e8eef2" />
          </g>

          <g className="hand hand-hour" style={{ transform: `rotate(${hourAngle}deg)` }}>
            <polygon points="300,132 305,300 300,312 295,300" fill="#2dd4bf" />
          </g>
          <g className="hand hand-minute" style={{ transform: `rotate(${minuteAngle}deg)` }}>
            <polygon points="300,96 303.2,300 300,314 296.8,300" fill="#5eead4" />
          </g>
          <g className="hand hand-second" style={{ transform: `rotate(${secondAngle}deg)` }}>
            <line x1="300" y1="332" x2="300" y2="78" stroke="#f87171" strokeWidth="1.2" />
            <circle cx="300" cy="86" r="3" fill="#f87171" />
          </g>

          <circle cx={CX} cy={CY} r="7" fill="#14b8a6" stroke="#e8eef2" strokeWidth="1.5" />
        </svg>
        <figcaption>
          <span>{HOURS[shichenIndex]}时</span>
          <span className="digits">
            {pad(hours)}:{pad(minutes)}:{pad(seconds)}
          </span>
        </figcaption>
      </figure>
    </Style>
  )
}

const Style = styled.div`
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .instrument {
    margin: 0;
    width: min(100%, 74vh, 560px);
  }

  .instrument svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .glyph {
    fill: #e8eef2;
    font-family: var(--zy-serif, ui-serif, 'Songti SC', 'STSong', 'SimSun', serif);
  }

  .glyph.hour {
    font-size: 22px;
  }

  .glyph.bagua {
    fill: #5eead4;
    font-size: 15px;
  }

  .orbit,
  .taiji,
  .hand {
    transform-box: view-box;
    transform-origin: 300px 300px;
  }

  .orbit-stars {
    animation: spin 46s linear infinite;
  }

  .orbit-ring {
    animation: spin 28s linear infinite reverse;
  }

  .taiji {
    animation: spin 18s linear infinite;
  }

  .hand-second {
    transform-box: view-box;
    transform-origin: 300px 300px;
  }

  .digits {
    color: var(--zy-muted, #8c8c8c);
    letter-spacing: 0.12em;
    font-variant-numeric: tabular-nums;
  }

  @media (prefers-reduced-motion: reduce) {
    .orbit-stars,
    .orbit-ring,
    .taiji {
      animation: none;
    }
  }

  @media (max-width: 1024px) {
    .instrument {
      width: min(52vw, 240px);
      max-height: 100%;
    }

    .instrument svg {
      overflow: hidden;
      max-height: 100%;
    }
  }

  @media (max-width: 390px) {
    .instrument {
      width: min(48vw, 200px);
    }
  }
`
