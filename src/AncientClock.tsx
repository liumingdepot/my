import { useEffect, useState } from 'react'

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
      r: index % 5 === 0 ? 1.7 : 0.9,
    }
  })

  return (
    <figure className="instrument">
      <svg viewBox="0 0 600 600" role="img" aria-label="旋转的古代时辰钟">
        <defs>
          <radialGradient id="lacquer" cx="50%" cy="46%" r="52%">
            <stop offset="0%" stopColor="#2a2118" />
            <stop offset="62%" stopColor="#120f0c" />
            <stop offset="100%" stopColor="#070605" />
          </radialGradient>
          <radialGradient id="bronze" cx="36%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#f4e7c8" />
            <stop offset="22%" stopColor="#d7b56d" />
            <stop offset="58%" stopColor="#8a6233" />
            <stop offset="100%" stopColor="#3a2816" />
          </radialGradient>
          <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f8edd4" />
            <stop offset="48%" stopColor="#d4ae62" />
            <stop offset="100%" stopColor="#7a5528" />
          </linearGradient>
          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="#000" floodOpacity="0.55" />
          </filter>
        </defs>

        <circle cx={CX} cy={CY} r="286" fill="url(#lacquer)" filter="url(#soft)" />
        <circle cx={CX} cy={CY} r="276" fill="none" stroke="url(#gold)" strokeWidth="3" />
        <circle cx={CX} cy={CY} r="268" fill="none" stroke="#8d6a3a" strokeWidth="0.6" opacity="0.7" />
        <circle cx={CX} cy={CY} r="214" fill="none" stroke="#6d5330" strokeWidth="0.7" opacity="0.8" />

        {ticks.map((tick) => (
          <line
            key={`${tick.x1}-${tick.y1}`}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke={tick.major ? '#f0ddb4' : '#8a6d45'}
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
            <circle key={`${star.cx}-${star.cy}`} cx={star.cx} cy={star.cy} r={star.r} fill="#f0ddb4" />
          ))}
          <circle cx={CX} cy={CY} r="148" fill="none" stroke="#c6a15a" strokeWidth="0.6" opacity="0.45" />
          <circle cx={CX} cy={CY} r="108" fill="none" stroke="#c6a15a" strokeWidth="0.5" opacity="0.35" />
          <circle cx={CX} cy={CY} r="72" fill="none" stroke="#c6a15a" strokeWidth="0.5" opacity="0.3" />
        </g>

        <g className="orbit orbit-ring">
          {Array.from({ length: 24 }, (_, index) => {
            const point = polar(index, 24, 162)
            return <circle key={index} cx={point.x} cy={point.y} r={index % 2 === 0 ? 2.1 : 1.1} fill="#e7d3a4" />
          })}
        </g>

        <g className="taiji">
          <circle cx={CX} cy={CY} r="46" fill="#f3e6c4" />
          <path d="M300 254a46 46 0 0 1 0 92 23 23 0 0 1 0-46 23 23 0 0 0 0-46" fill="#1a140e" />
          <circle cx={CX} cy={CY - 23} r="7" fill="#1a140e" />
          <circle cx={CX} cy={CY + 23} r="7" fill="#f3e6c4" />
        </g>

        <g className="hand hand-hour" style={{ transform: `rotate(${hourAngle}deg)` }}>
          <polygon points="300,132 305,300 300,312 295,300" fill="url(#gold)" />
        </g>
        <g className="hand hand-minute" style={{ transform: `rotate(${minuteAngle}deg)` }}>
          <polygon points="300,96 303.2,300 300,314 296.8,300" fill="#f6ead0" />
        </g>
        <g className="hand hand-second" style={{ transform: `rotate(${secondAngle}deg)` }}>
          <line x1="300" y1="332" x2="300" y2="78" stroke="#c4493a" strokeWidth="1.2" />
          <circle cx="300" cy="86" r="3" fill="#c4493a" />
        </g>

        <circle cx={CX} cy={CY} r="7" fill="url(#bronze)" stroke="#f6ead0" strokeWidth="1" />
      </svg>
      <figcaption>
        <span>{HOURS[shichenIndex]}时</span>
        <span className="digits">
          {pad(hours)}:{pad(minutes)}:{pad(seconds)}
        </span>
      </figcaption>
    </figure>
  )
}
