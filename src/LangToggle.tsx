import type { ButtonHTMLAttributes } from 'react'
import type { Lang } from './lang'
import './theme.css'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  lang: Lang
  onClick: () => void
}

/** 中英切换。中文界面显示 EN，英文界面显示中文，与首页一致。 */
export function LangToggle({ lang, onClick, className = '', ...props }: Props) {
  const label = lang === 'zh' ? 'EN' : '中文'
  const title = lang === 'zh' ? 'Switch to English' : '切换到中文'
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      {...props}
      className={['page-lang-toggle', className].filter(Boolean).join(' ')}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
