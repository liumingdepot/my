import { NavLink } from 'react-router'

const NAV_ITEMS = [
  { to: '/admin/users', label: '用户管理', icon: UsersIcon },
  { to: '/admin/video-sources', label: '视频源管理', icon: VideoIcon },
] as const

export { NAV_ITEMS }

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

type AdminAsideProps = {
  onNavigate?: () => void
}

export default function AdminAside({ onNavigate }: AdminAsideProps) {
  return (
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
            onClick={onNavigate}
          >
            <item.icon />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
