import { useEffect, useLayoutEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import '../admin.css'
import { fetchMe, logout as apiLogout, type AdminSession } from '../auth'
import AdminAside, { NAV_ITEMS } from './aside'
import AdminHeader from './header'

export type AdminOutletContext = {
  session: AdminSession
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
      <AdminAside onNavigate={() => setNavOpen(false)} />

      <div className="admin-main">
        <AdminHeader
          navOpen={navOpen}
          onToggleNav={() => setNavOpen((open) => !open)}
          currentLabel={currentNav.label}
          session={session}
          onLogout={() => void logout()}
        />
        <div className="admin-content">
          <Outlet context={{ session } satisfies AdminOutletContext} />
        </div>
      </div>
    </div>
  )
}
