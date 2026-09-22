import { Link } from 'react-router'
import styled from 'styled-components'
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
    <Style className="admin-top">
      <div className="left">
        <button
          type="button"
          className="burger"
          aria-label="打开菜单"
          aria-expanded={navOpen}
          onClick={onToggleNav}
        >
          ☰
        </button>
        <div className="crumb">
          <span className="muted">控制台</span>
          <span className="sep">/</span>
          <span className="current">{currentLabel}</span>
        </div>
      </div>

      <div className="right">
        <div className="user">
          <span className="avatar">{initials(session.displayName)}</span>
          <span className="who">
            {session.displayName}
            <span className="handle">@{session.username}</span>
          </span>
        </div>
        <Link className="link" to="/">
          返回门户
        </Link>
        <button type="button" className="btn" onClick={onLogout}>
          退出
        </button>
      </div>
    </Style>
  )
}

const Style = styled.div`
  height: 56px;
  min-height: 56px;
  max-height: 56px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  overflow: hidden;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 20;

  .left,
  .right {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .right {
    flex-shrink: 0;
  }

  .burger {
    display: none;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #374151;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }

  .burger:hover {
    background: #f3f4f6;
  }

  .crumb {
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    font-size: 14px;
    line-height: 1.2;
  }

  .muted {
    color: #6b7280;
  }

  .sep {
    color: #9ca3af;
  }

  .current {
    color: #111827;
    font-weight: 600;
  }

  .user {
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 200px;
    min-width: 0;
  }

  .avatar {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    background: #ecfdf5;
    color: #0f766e;
    border: 1px solid #d7eee8;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
    flex-shrink: 0;
  }

  .who {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 600;
    color: #111827;
    line-height: 1.2;
  }

  .handle {
    font-weight: 400;
    color: #9ca3af;
    font-size: 12px;
  }

  .link {
    color: #4b5563;
    font-size: 13px;
    line-height: 1.2;
    text-decoration: none;
    white-space: nowrap;
  }

  .link:hover {
    color: #0f766e;
  }

  .btn {
    height: 30px;
    padding: 0 10px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #fff;
    color: #374151;
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    white-space: nowrap;
  }

  .btn:hover {
    border-color: #d1d5db;
    background: #f9fafb;
  }

  @media (max-width: 860px) {
    padding: 0 12px;

    .burger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .user,
    .link {
      display: none;
    }
  }
`
