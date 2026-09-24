import { useLocation, useNavigate } from 'react-router'
import styled from 'styled-components'

const NAV_ITEMS = [
  { key: '/admin/users', label: '用户管理' },
  { key: '/admin/video-sources', label: '视频管理' },
  { key: '/admin/education', label: '教育管理' },
  { key: '/admin/games', label: 'FC 游戏管理' },
] as const

export { NAV_ITEMS }

type AdminAsideProps = {
  onNavigate?: () => void
}

export default function AdminAside({ onNavigate }: AdminAsideProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const selected =
    NAV_ITEMS.find((item) => location.pathname.startsWith(item.key))?.key ?? NAV_ITEMS[0].key

  return (
    <Style className="admin-aside">
      <div className="brand">
        <span className="mark" aria-hidden="true">
          管
        </span>
        <div className="titles">
          <div className="name">后台管理</div>
          <div className="sub">个人控制台</div>
        </div>
      </div>

      <div className="section">导航</div>

      <nav className="nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`nav-item${selected === item.key ? ' is-active' : ''}`}
            onClick={() => {
              navigate(item.key)
              onNavigate?.()
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </Style>
  )
}

const Style = styled.aside`
  width: 220px;
  flex: 0 0 220px;
  height: 100dvh;
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  overflow: hidden;

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 8px 14px;
    margin-bottom: 8px;
    border-bottom: 1px solid #f0f2f5;
  }

  .mark {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    background: #0f766e;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
    line-height: 1;
    flex-shrink: 0;
  }

  .titles {
    min-width: 0;
  }

  .name {
    font-weight: 600;
    font-size: 15px;
    line-height: 1.3;
    color: #111827;
  }

  .sub {
    margin-top: 2px;
    font-size: 12px;
    line-height: 1.3;
    color: #9ca3af;
  }

  .section {
    padding: 4px 10px 6px;
    color: #9ca3af;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.2;
  }

  .nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .nav-item {
    height: 40px;
    padding: 0 12px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #4b5563;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
  }

  .nav-item:hover {
    color: #0f766e;
    background: #f0fdfa;
  }

  .nav-item.is-active {
    color: #0f766e;
    background: #ecfdf5;
    font-weight: 600;
  }

  @media (max-width: 860px) {
    position: fixed;
    inset: 0 auto 0 0;
    transform: translateX(-105%);
    transition: transform 0.2s ease;
    box-shadow: 8px 0 24px rgba(0, 0, 0, 0.08);

    .admin-shell.is-nav-open & {
      transform: translateX(0);
    }
  }
`
