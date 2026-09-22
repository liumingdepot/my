import type { ButtonHTMLAttributes } from 'react'
import styled from 'styled-components'
import type { Lang } from './lang'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  lang: Lang
  onClick: () => void
}

/** 中英切换。中文界面显示 EN，英文界面显示中文，与首页一致。 */
export function LangToggle({ lang, onClick, className = '', ...props }: Props) {
  const label = lang === 'zh' ? 'EN' : '中文'
  const title = lang === 'zh' ? 'Switch to English' : '切换到中文'
  return (
    <Style type="button" title={title} aria-label={title} {...props} className={className} onClick={onClick}>
      {label}
    </Style>
  )
}

const Style = styled.button`
  height: 38px;
  min-width: 3.25rem;
  padding: 0 10px;
  flex: 0 0 auto;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--purple, #7c5cfc) 35%, transparent);
  background: var(--bg-elev, #fff);
  color: var(--purple, #7c5cfc);
  display: grid;
  place-items: center;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1;
  transition: transform 0.2s ease, border-color 0.2s ease, color 0.2s ease;

  &:hover {
    transform: scale(1.05);
    border-color: var(--purple-soft, #a78bfa);
  }
`
