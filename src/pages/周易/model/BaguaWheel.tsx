import styled from 'styled-components'

/** 透明八卦轮，供表单页 / 首页背景复用 */
export default function BaguaWheel({ className }: { className?: string }) {
  return (
    <Svg className={className} viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
      <circle cx="100" cy="100" r="72" fill="none" stroke="currentColor" strokeWidth="0.55" opacity="0.38" />
      <circle cx="100" cy="100" r="34" fill="none" stroke="currentColor" strokeWidth="0.45" opacity="0.28" />
      <g className="trigrams" fill="currentColor" opacity="0.62">
        {/* 乾 */}
        <g transform="translate(100,16)">
          <rect x="-10" y="0" width="20" height="2.2" rx="0.4" />
          <rect x="-10" y="4.5" width="20" height="2.2" rx="0.4" />
          <rect x="-10" y="9" width="20" height="2.2" rx="0.4" />
        </g>
        {/* 坤 */}
        <g transform="translate(100,184) rotate(180)">
          <rect x="-10" y="0" width="8" height="2.2" rx="0.4" />
          <rect x="2" y="0" width="8" height="2.2" rx="0.4" />
          <rect x="-10" y="4.5" width="8" height="2.2" rx="0.4" />
          <rect x="2" y="4.5" width="8" height="2.2" rx="0.4" />
          <rect x="-10" y="9" width="8" height="2.2" rx="0.4" />
          <rect x="2" y="9" width="8" height="2.2" rx="0.4" />
        </g>
        {/* 离 */}
        <g transform="translate(184,100) rotate(90)">
          <rect x="-10" y="0" width="20" height="2.2" rx="0.4" />
          <rect x="-10" y="4.5" width="8" height="2.2" rx="0.4" />
          <rect x="2" y="4.5" width="8" height="2.2" rx="0.4" />
          <rect x="-10" y="9" width="20" height="2.2" rx="0.4" />
        </g>
        {/* 坎 */}
        <g transform="translate(16,100) rotate(-90)">
          <rect x="-10" y="0" width="8" height="2.2" rx="0.4" />
          <rect x="2" y="0" width="8" height="2.2" rx="0.4" />
          <rect x="-10" y="4.5" width="20" height="2.2" rx="0.4" />
          <rect x="-10" y="9" width="8" height="2.2" rx="0.4" />
          <rect x="2" y="9" width="8" height="2.2" rx="0.4" />
        </g>
        {/* 震 */}
        <g transform="translate(158,42) rotate(45)">
          <rect x="-10" y="0" width="8" height="2.2" rx="0.4" />
          <rect x="2" y="0" width="8" height="2.2" rx="0.4" />
          <rect x="-10" y="4.5" width="8" height="2.2" rx="0.4" />
          <rect x="2" y="4.5" width="8" height="2.2" rx="0.4" />
          <rect x="-10" y="9" width="20" height="2.2" rx="0.4" />
        </g>
        {/* 巽 */}
        <g transform="translate(158,158) rotate(135)">
          <rect x="-10" y="0" width="20" height="2.2" rx="0.4" />
          <rect x="-10" y="4.5" width="8" height="2.2" rx="0.4" />
          <rect x="2" y="4.5" width="8" height="2.2" rx="0.4" />
          <rect x="-10" y="9" width="8" height="2.2" rx="0.4" />
          <rect x="2" y="9" width="8" height="2.2" rx="0.4" />
        </g>
        {/* 艮 */}
        <g transform="translate(42,158) rotate(-135)">
          <rect x="-10" y="0" width="20" height="2.2" rx="0.4" />
          <rect x="-10" y="4.5" width="8" height="2.2" rx="0.4" />
          <rect x="2" y="4.5" width="8" height="2.2" rx="0.4" />
          <rect x="-10" y="9" width="8" height="2.2" rx="0.4" />
          <rect x="2" y="9" width="8" height="2.2" rx="0.4" />
        </g>
        {/* 兑 */}
        <g transform="translate(42,42) rotate(-45)">
          <rect x="-10" y="0" width="8" height="2.2" rx="0.4" />
          <rect x="2" y="0" width="8" height="2.2" rx="0.4" />
          <rect x="-10" y="4.5" width="20" height="2.2" rx="0.4" />
          <rect x="-10" y="9" width="20" height="2.2" rx="0.4" />
        </g>
      </g>
      <g className="taiji">
        <circle cx="100" cy="100" r="26" fill="currentColor" opacity="0.1" />
        <circle cx="100" cy="100" r="26" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.45" />
        <path
          d="M100 74 A26 26 0 0 0 100 126 A13 13 0 0 0 100 100 A13 13 0 0 1 100 74 Z"
          fill="currentColor"
          opacity="0.38"
        />
        <circle cx="100" cy="87" r="3" fill="currentColor" opacity="0.6" />
        <circle cx="100" cy="113" r="3" fill="var(--zy-bg0, #0b0a09)" opacity="0.9" />
      </g>
    </Svg>
  )
}

const Svg = styled.svg`
  display: block;
  width: 100%;
  height: 100%;
`
