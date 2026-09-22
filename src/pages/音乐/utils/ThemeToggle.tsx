import type { ButtonHTMLAttributes } from 'react'
import styled from 'styled-components'

/** 深浅色切换按钮。浅色显示月亮，深色显示太阳，与首页一致。 */
export function ThemeToggle({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Style type="button" aria-label="切换深浅色" {...props} className={className}>
      <svg className="icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
      <svg className="icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" />
      </svg>
    </Style>
  )
}

const Style = styled.button`
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  border-radius: 50%;
  border: 1px solid var(--line, rgba(15, 23, 42, 0.08));
  background: var(--bg-elev, #fff);
  color: var(--text-soft, #475569);
  display: grid;
  place-items: center;
  cursor: pointer;
  padding: 0;
  transition: transform 0.2s ease, border-color 0.2s ease, color 0.2s ease;

  &:hover {
    transform: scale(1.05);
    border-color: var(--purple-soft, #a78bfa);
    color: var(--purple, #7c5cfc);
  }

  html[data-theme='dark'] & .icon-sun,
  html:not([data-theme='dark']) & .icon-moon {
    display: none;
  }
`
