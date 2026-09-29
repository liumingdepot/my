import { Link, useLocation } from 'react-router'
import styled from 'styled-components'
import { ALL_WORKS, WORKS_PATH } from './works'

function isWorkRoute(pathname: string) {
  return ALL_WORKS.some(
    (work) => pathname === work.href || pathname.startsWith(`${work.href}/`),
  )
}

/** 作品页右侧居中收起态「返回」→ 作品集 */
export default function BackToWorks() {
  const { pathname } = useLocation()
  if (!isWorkRoute(pathname)) return null

  return (
    <Tab to={WORKS_PATH} aria-label="返回作品集">
      <svg className="chevron" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M14.5 6.5L9 12l5.5 5.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="label">作品集</span>
    </Tab>
  )
}

const Tab = styled(Link)`
  --bg: rgba(76, 29, 149, 0.88);
  --bg-strong: #5b21b6;
  --line: rgba(216, 180, 254, 0.28);
  --fg: #f5f3ff;
  --accent: #ede9fe;

  position: fixed;
  top: 50%;
  right: 0;
  z-index: 80;
  transform: translateY(-50%);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 36px;
  min-height: 88px;
  padding: 14px 0;
  border: 1px solid var(--line);
  border-right: 0;
  border-radius: 12px 0 0 12px;
  background: var(--bg);
  backdrop-filter: blur(16px) saturate(1.2);
  -webkit-backdrop-filter: blur(16px) saturate(1.2);
  box-shadow: -8px 10px 28px rgba(91, 33, 182, 0.32);
  color: var(--fg);
  text-decoration: none;
  font-family:
    'Noto Sans SC',
    'PingFang SC',
    'Hiragino Sans GB',
    'Microsoft YaHei',
    system-ui,
    sans-serif;
  -webkit-tap-highlight-color: transparent;
  transition:
    background 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;

  .chevron {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .label {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    font-size: 12px;
    font-weight: 650;
    letter-spacing: 0.28em;
    line-height: 1;
  }

  &:hover {
    background: var(--bg-strong);
    color: var(--accent);
    box-shadow: -10px 12px 32px rgba(91, 33, 182, 0.4);
  }

  &:focus-visible {
    outline: 2px solid rgba(196, 181, 253, 0.85);
    outline-offset: -2px;
  }

  @media (max-width: 560px) {
    width: 32px;
    min-height: 76px;
    padding: 12px 0;

    .label {
      font-size: 11px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`
