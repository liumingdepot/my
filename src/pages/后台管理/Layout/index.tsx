import { useEffect, useLayoutEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import styled, { createGlobalStyle } from 'styled-components'
import { fetchMe, logout as apiLogout, type AdminSession } from '../auth'
import { NAV_ITEMS } from './aside'
import AdminAside from './aside'
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

  const currentNav = NAV_ITEMS.find((item) => location.pathname.startsWith(item.key)) ?? NAV_ITEMS[0]

  useLayoutEffect(() => {
    document.body.classList.remove('site-home', 'video-body')
    document.documentElement.classList.remove('video-html')
    document.title = '后台管理'
    document.documentElement.dataset.theme = 'light'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f3f4f6')
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
      <>
        <AdminGlobalStyle />
        <Style>
          <div className="admin admin-boot">加载中…</div>
        </Style>
      </>
    )
  }

  if (!session) {
    return <Navigate to="/admin/login" replace />
  }

  return (
    <>
      <AdminGlobalStyle />
      <Style>
        <div className={`admin admin-shell${navOpen ? ' is-nav-open' : ''}`}>
          <div className="admin-mask" onClick={() => setNavOpen(false)} aria-hidden="true" />
          <AdminAside onNavigate={() => setNavOpen(false)} />
          <div className="admin-main">
            <AdminHeader
              navOpen={navOpen}
              onToggleNav={() => setNavOpen((open) => !open)}
              currentLabel={currentNav.label}
              session={session}
              onLogout={() => void logout()}
            />
            <main className="admin-content">
              <Outlet context={{ session } satisfies AdminOutletContext} />
            </main>
          </div>
        </div>
      </Style>
    </>
  )
}

const AdminGlobalStyle = createGlobalStyle`
html:has(.admin) {
  color-scheme: light !important;
  font-size: 16px !important;
}

body:has(.admin) {
  margin: 0 !important;
  background: #f3f4f6 !important;
  color: #111827 !important;
  font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif !important;
  font-size: 14px !important;
  line-height: 1.5 !important;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden !important;
}

body:has(.admin) a {
  background: transparent;
}
`

const Style = styled.div`
  min-height: 100dvh;
  font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #111827;

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  .admin {
    min-height: 100dvh;
    background: #f3f4f6;
    color: #111827;
  }

  .admin-boot {
    display: grid;
    place-items: center;
    min-height: 100dvh;
    color: #6b7280;
  }

  .admin-shell {
    display: flex;
    flex-direction: row;
    min-height: 100dvh;
    background: #f3f4f6;
  }

  .admin-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
  }

  .admin-content {
    flex: 1;
    padding: 20px 24px 32px;
    min-width: 0;
  }

  .admin-mask {
    display: none;
  }

  @media (max-width: 860px) {
    .admin-mask {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 25;
      background: rgba(17, 24, 39, 0.4);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
    }

    .admin-shell.is-nav-open .admin-mask {
      opacity: 1;
      pointer-events: auto;
    }

    .admin-content {
      padding: 16px;
    }
  }
`
