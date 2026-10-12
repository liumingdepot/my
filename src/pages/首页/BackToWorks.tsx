import { Link, useLocation } from 'react-router'
import styled from 'styled-components'
import { ALL_WORKS, WORKS_PATH } from './works'

function isWorkRoute(pathname: string) {
  return ALL_WORKS.some(
    (work) => pathname === work.href || pathname.startsWith(`${work.href}/`),
  )
}

/** 作品页右侧居中小图标「返回」→ 作品集，hover 提示「回到首页」 */
export default function BackToWorks() {
  const { pathname } = useLocation()
  if (!isWorkRoute(pathname)) return null

  return (
    <Tab to={WORKS_PATH} aria-label="回到首页">
      <svg className="arrow" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M14.5 6.5L9 12l5.5 5.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="tip" aria-hidden="true">
        回到首页
      </span>
    </Tab>
  )
}

const Tab = styled(Link)`
  --bg: rgba(76, 29, 149, 0.88);
  --bg-strong: #5b21b6;
  --line: rgba(216, 180, 254, 0.28);
  --tip-bg: #4c1d95;

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
  width: 36px;
  height: 46px;
  border: 1px solid var(--line);
  border-right: 0;
  border-radius: 12px 0 0 12px;
  background: var(--bg);
  backdrop-filter: blur(16px) saturate(1.2);
  -webkit-backdrop-filter: blur(16px) saturate(1.2);
  box-shadow: -8px 10px 28px rgba(91, 33, 182, 0.32);
  text-decoration: none;
  font-family:
    'Noto Sans SC',
    'PingFang SC',
    'Hiragino Sans GB',
    'Microsoft YaHei',
    system-ui,
    sans-serif;
  -webkit-tap-highlight-color: transparent;
  animation: tab-in 0.32s ease both;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  /* 盖过各作品页全局 a { color: inherit }，与图标白字一致 */
  &,
  &:link,
  &:visited,
  &:hover,
  &:active {
    color: #fff;
  }

  .arrow {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: #fff;
    transition: transform 0.2s ease;
  }

  /* hover 气泡：靠左浮出，键盘聚焦同样可见 */
  .tip {
    position: absolute;
    top: 50%;
    right: calc(100% + 10px);
    padding: 6px 11px;
    border-radius: 9px;
    background: var(--tip-bg);
    box-shadow: 0 8px 20px rgba(46, 16, 101, 0.38);
    color: #fff;
    font-size: 12px;
    font-weight: 650;
    letter-spacing: 0.06em;
    line-height: 1.4;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transform: translate(6px, -50%);
    transition:
      opacity 0.18s ease,
      transform 0.18s ease;
  }

  /* 小尖角指向按钮 */
  .tip::after {
    content: '';
    position: absolute;
    top: 50%;
    right: -4px;
    width: 8px;
    height: 8px;
    margin-top: -4px;
    transform: rotate(45deg);
    background: var(--tip-bg);
  }

  &:hover {
    background: var(--bg-strong);
    box-shadow: -10px 12px 32px rgba(91, 33, 182, 0.4);

    .arrow {
      transform: translateX(-2px);
    }
  }

  &:focus-visible {
    outline: 2px solid rgba(196, 181, 253, 0.85);
    outline-offset: 3px;

    .tip {
      opacity: 1;
      transform: translate(0, -50%);
    }
  }

  /* 触屏无 hover，提示不打扰；桌面 hover 才浮出 */
  @media (hover: hover) and (pointer: fine) {
    &:hover .tip {
      opacity: 1;
      transform: translate(0, -50%);
    }
  }

  @keyframes tab-in {
    from {
      opacity: 0;
      transform: translate(10px, -50%);
    }
    to {
      opacity: 1;
      transform: translate(0, -50%);
    }
  }

  @media (max-width: 560px) {
    width: 32px;
    height: 40px;

    .arrow {
      width: 13px;
      height: 13px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transition: none;

    .arrow,
    .tip {
      transition: none;
    }
  }
`