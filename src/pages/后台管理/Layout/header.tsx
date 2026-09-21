import { Link } from 'react-router'
import type { AdminSession } from '../auth'

function initials(name: string) {
  const text = name.trim()
  if (!text) return '?'
  return text.slice(0, 1).toUpperCase()
}

type AdminHeaderProps = {
  navOpen: boolean
  onToggleNav: () => void
  currentLabel: string
  session: AdminSession
  onLogout: () => void
}

export default function AdminHeader({
  navOpen,
  onToggleNav,
  currentLabel,
  session,
  onLogout,
}: AdminHeaderProps) {
  return (
    <header className="admin-top">
      <div className="admin-top__lead">
        <button
          className="admin-burger"
          type="button"
          aria-label="打开菜单"
          aria-expanded={navOpen}
          onClick={onToggleNav}
        >
          <span />
          <span />
          <span />
        </button>
        <p className="admin-top__path">
          控制台 <span>/</span> {currentLabel}
        </p>
      </div>
      <div className="admin-top__user">
        <div className="admin-top__identity">
          <span className="admin-top__avatar">{initials(session.displayName)}</span>
          <div className="admin-top__meta">
            <strong>{session.displayName}</strong>
            <span>@{session.username}</span>
          </div>
        </div>
        <div className="admin-top__actions">
          <Link className="admin-top__link" to="/">
            返回门户
          </Link>
          <button className="admin-top__logout" type="button" onClick={onLogout}>
            退出登录
          </button>
        </div>
      </div>
    </header>
  )
}
