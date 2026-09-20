import { useEffect, useLayoutEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import './admin.css'
import { fetchMe, logout as apiLogout, type AdminSession } from './auth'

export type AdminOutletContext = {
  session: AdminSession
}

const NAV_ITEMS = [
  { to: '/admin/users', label: '用户管理', icon: UsersIcon },
  { to: '/admin/video-sources', label: '视频源管理', icon: VideoIcon },
] as const

function UsersIcon() {
  return (
    <svg className="admin-nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function VideoIcon() {
  return (
    <svg className="admin-nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="2" y="5" width="15" height="14" rx="2" />
      <path d="m17 10 5-3v10l-5-3" />
    </svg>
  )
}

function initials(name: string) {
  const text = name.trim()
  if (!text) return '?'
  return text.slice(0, 1).toUpperCase()
}

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [session, setSession] = useState<AdminSession | null>(null)
  const [checking, setChecking] = useState(true)
  const [navOpen, setNavOpen] = useState(false)

  const currentNav = NAV_ITEMS.find((item) => location.pathname.startsWith(item.to)) ?? NAV_ITEMS[0]

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = '后台管理'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f4f6f8')
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await fetchMe()
        if (!cancelled) setSession(me)
      } catch {
        if (!cancelled) setSession(null)
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function logout() {
    try {
      await apiLogout()
    } catch {
      /* ignore */
    }
    setSession(null)
    navigate('/admin/login', { replace: true })
  }

  if (checking) {
    return (
      <div className="admin admin-login">
        <p className="admin-hint">加载中…</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/admin/login" replace />
  }

  return (
    <div className={`admin admin-shell${navOpen ? ' is-nav-open' : ''}`}>
      <div className="admin-sidebar-mask" onClick={() => setNavOpen(false)} aria-hidden="true" />
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <strong>后台管理</strong>
          <span>个人控制台</span>
        </div>

        <nav className="admin-nav" aria-label="后台导航">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'is-active' : '')}
              onClick={() => setNavOpen(false)}
            >
              <item.icon />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-top">
          <div className="admin-top__lead">
            <button
              className="admin-burger"
              type="button"
              aria-label="打开菜单"
              aria-expanded={navOpen}
              onClick={() => setNavOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>
            <p className="admin-top__path">
              控制台 <span>/</span> {currentNav.label}
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
              <button className="admin-top__logout" type="button" onClick={() => void logout()}>
                退出登录
              </button>
            </div>
          </div>
        </header>
        <div className="admin-content">
          <Outlet context={{ session } satisfies AdminOutletContext} />
        </div>
      </div>
    </div>
  )
}
