import { useEffect, useLayoutEffect, useMemo, useState, type FormEvent } from 'react'
import { useOutletContext } from 'react-router'
import type { AdminOutletContext } from '../Layout'
import {
  ApiError,
  createUser,
  deleteUser,
  listUsers,
  patchUserStatus,
  updateUser,
  type AdminUser,
  type UserRole,
  type UserStatus,
} from '../auth'

type Draft = {
  username: string
  displayName: string
  email: string
  role: UserRole
  status: UserStatus
  password: string
}

const EMPTY_DRAFT: Draft = {
  username: '',
  displayName: '',
  email: '',
  role: 'viewer',
  status: 'active',
  password: '',
}

const ROLE_LABEL: Record<UserRole, string> = {
  admin: '管理员',
  editor: '编辑',
  viewer: '访客',
}

const STATUS_LABEL: Record<UserStatus, string> = {
  active: '启用',
  disabled: '停用',
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

export default function UsersPage() {
  const { session } = useOutletContext<AdminOutletContext>()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  useLayoutEffect(() => {
    document.title = '用户管理 · 后台管理'
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setListError('')
      try {
        const next = await listUsers()
        if (!cancelled) setUsers(next)
      } catch (error) {
        if (!cancelled) {
          setListError(error instanceof ApiError ? error.message : '用户列表加载失败')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (user) =>
        user.username.toLowerCase().includes(q) ||
        user.displayName.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q),
    )
  }, [users, query])

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => user.status === 'active').length,
      admin: users.filter((user) => user.role === 'admin').length,
    }),
    [users],
  )

  function openCreate() {
    setEditing(null)
    setCreating(true)
    setDraft(EMPTY_DRAFT)
    setFormError('')
  }

  function openEdit(user: AdminUser) {
    setCreating(false)
    setEditing(user)
    setDraft({
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      status: user.status,
      password: '',
    })
    setFormError('')
  }

  function closeDialog() {
    setCreating(false)
    setEditing(null)
    setFormError('')
    setSaving(false)
  }

  async function onSave(event: FormEvent) {
    event.preventDefault()
    const username = draft.username.trim()
    const displayName = draft.displayName.trim()
    const email = draft.email.trim()
    const password = draft.password

    if (!username) {
      setFormError('请填写用户名')
      return
    }
    if (!displayName) {
      setFormError('请填写显示名称')
      return
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError('邮箱格式不正确')
      return
    }
    if (creating && password.length < 6) {
      setFormError('密码至少 6 位')
      return
    }
    if (!creating && password && password.length < 6) {
      setFormError('密码至少 6 位')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      const payload = {
        username,
        displayName,
        email,
        role: draft.role,
        status: draft.status,
        ...(password ? { password } : {}),
      }
      if (editing) {
        const updated = await updateUser(editing.id, payload)
        setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)))
      } else {
        const created = await createUser({ ...payload, password })
        setUsers((current) => [created, ...current])
      }
      closeDialog()
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : '保存失败')
      setSaving(false)
    }
  }

  async function toggleStatus(user: AdminUser) {
    const nextStatus: UserStatus = user.status === 'active' ? 'disabled' : 'active'
    try {
      const updated = await patchUserStatus(user.id, nextStatus)
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (error) {
      window.alert(error instanceof ApiError ? error.message : '操作失败，请稍后再试')
    }
  }

  async function removeUser(user: AdminUser) {
    if (!window.confirm('确定删除该用户？')) return
    try {
      await deleteUser(user.id)
      setUsers((current) => current.filter((item) => item.id !== user.id))
    } catch (error) {
      window.alert(error instanceof ApiError ? error.message : '操作失败，请稍后再试')
    }
  }

  const dialogOpen = creating || Boolean(editing)

  return (
    <>
      <div className="admin-page-head">
        <div>
          <h1>用户管理</h1>
          <p>查看与维护后台账号</p>
          <div className="admin-meta">
            <span>
              全部 <b>{stats.total}</b>
            </span>
            <span>
              启用 <b>{stats.active}</b>
            </span>
            <span>
              管理员 <b>{stats.admin}</b>
            </span>
          </div>
        </div>
        <button className="admin-btn admin-btn--primary" type="button" onClick={openCreate}>
          新建用户
        </button>
      </div>

      <div className="admin-panel">
        <div className="admin-toolbar">
          <input
            className="admin-search"
            type="search"
            placeholder="搜索用户名 / 姓名 / 邮箱"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {loading ? (
          <div className="admin-empty">加载中…</div>
        ) : listError ? (
          <div className="admin-empty">{listError}</div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty">暂无用户</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>用户</th>
                  <th>角色</th>
                  <th>状态</th>
                  <th>邮箱</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="admin-user-cell">
                        <strong>{user.displayName}</strong>
                        <span>@{user.username}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`admin-badge${user.role === 'admin' ? ' admin-badge--admin' : ''}`}>
                        {ROLE_LABEL[user.role]}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-badge admin-badge--${user.status}`}>{STATUS_LABEL[user.status]}</span>
                    </td>
                    <td className="admin-cell-muted">{user.email || '—'}</td>
                    <td className="admin-cell-muted">{formatDate(user.createdAt)}</td>
                    <td>
                      <div className="admin-row-actions">
                        <button className="admin-btn admin-btn--ghost admin-btn--sm" type="button" onClick={() => openEdit(user)}>
                          编辑
                        </button>
                        <button
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                          type="button"
                          disabled={user.id === session.userId && user.status === 'active'}
                          onClick={() => void toggleStatus(user)}
                        >
                          {user.status === 'active' ? '停用' : '启用'}
                        </button>
                        <button
                          className="admin-btn admin-btn--danger admin-btn--sm"
                          type="button"
                          disabled={user.id === session.userId}
                          onClick={() => void removeUser(user)}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dialogOpen ? (
        <div className="admin-dialog-backdrop" role="presentation" onClick={closeDialog}>
          <form className="admin-dialog" onClick={(event) => event.stopPropagation()} onSubmit={(event) => void onSave(event)}>
            <h2>{creating ? '新建用户' : '编辑用户'}</h2>
            <div className="admin-field">
              <label htmlFor="user-username">用户名</label>
              <input
                id="user-username"
                value={draft.username}
                onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value }))}
                autoComplete="off"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="user-displayName">显示名称</label>
              <input
                id="user-displayName"
                value={draft.displayName}
                onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="user-email">邮箱</label>
              <input
                id="user-email"
                type="email"
                value={draft.email}
                onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="user-password">{creating ? '密码' : '密码（可选）'}</label>
              <input
                id="user-password"
                type="password"
                autoComplete="new-password"
                value={draft.password}
                placeholder={creating ? '至少 6 位' : '留空则不修改'}
                onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))}
              />
            </div>
            <div className="admin-field-row">
              <div className="admin-field">
                <label htmlFor="user-role">角色</label>
                <select
                  id="user-role"
                  value={draft.role}
                  onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value as UserRole }))}
                >
                  <option value="admin">管理员</option>
                  <option value="editor">编辑</option>
                  <option value="viewer">访客</option>
                </select>
              </div>
              <div className="admin-field">
                <label htmlFor="user-status">状态</label>
                <select
                  id="user-status"
                  value={draft.status}
                  onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as UserStatus }))}
                >
                  <option value="active">启用</option>
                  <option value="disabled">停用</option>
                </select>
              </div>
            </div>
            {formError ? <p className="admin-error">{formError}</p> : null}
            <div className="admin-dialog__actions">
              <button className="admin-btn admin-btn--ghost" type="button" onClick={closeDialog} disabled={saving}>
                取消
              </button>
              <button className="admin-btn admin-btn--primary" type="submit" disabled={saving}>
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  )
}
