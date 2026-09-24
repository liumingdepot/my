import { type FormEvent, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router'
import styled from 'styled-components'
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
import Select from '../../../components/Select'
import ListPagination, { LIST_PAGE_SIZE } from '../model/ListPagination'

type Draft = {
  username: string
  displayName: string
  email: string
  role: UserRole
  status: UserStatus
  password: string
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

const EMPTY_DRAFT: Draft = {
  username: '',
  displayName: '',
  email: '',
  role: 'viewer',
  status: 'active',
  password: '',
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

function initials(name: string) {
  const text = name.trim()
  if (!text) return '?'
  return text.slice(0, 1).toUpperCase()
}

export default function UsersPage() {
  const { session } = useOutletContext<AdminOutletContext>()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [draftQuery, setDraftQuery] = useState('')
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [page, setPage] = useState(1)

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

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

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

  const pageCount = Math.max(1, Math.ceil(filtered.length / LIST_PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * LIST_PAGE_SIZE, safePage * LIST_PAGE_SIZE),
    [filtered, safePage],
  )

  useEffect(() => {
    setPage(1)
  }, [query])

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => user.status === 'active').length,
      disabled: users.filter((user) => user.status === 'disabled').length,
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
    setSaving(false)
    setFormError('')
    setDraft(EMPTY_DRAFT)
  }

  async function onSave(event: FormEvent) {
    event.preventDefault()
    const username = draft.username.trim()
    const displayName = draft.displayName.trim()
    const email = draft.email.trim()
    const password = draft.password

    if (!username || !displayName) {
      setFormError('请填写用户名和显示名称')
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
        setToast('已保存')
      } else {
        const created = await createUser({ ...payload, password })
        setUsers((current) => [created, ...current])
        setToast('已创建')
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
      setToast(nextStatus === 'active' ? '已启用' : '已停用')
    } catch (error) {
      setToast(error instanceof ApiError ? error.message : '操作失败')
    }
  }

  async function removeUser(user: AdminUser) {
    const ok = window.confirm(`确定删除「${user.displayName}」(@${user.username})？`)
    if (!ok) return
    try {
      await deleteUser(user.id)
      setUsers((current) => current.filter((item) => item.id !== user.id))
      setToast('已删除')
    } catch (error) {
      setToast(error instanceof ApiError ? error.message : '操作失败')
    }
  }

  const dialogOpen = creating || Boolean(editing)

  return (
    <Style>
      {toast ? <div className="toast">{toast}</div> : null}

      <div className="head">
        <div>
          <h1 className="title">用户管理</h1>
          <p className="desc">查看与维护后台账号权限与状态</p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          + 新增用户
        </button>
      </div>

      <div className="stats">
        <div className="stat">
          <span>全部</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="stat">
          <span>启用</span>
          <strong className="ok">{stats.active}</strong>
        </div>
        <div className="stat">
          <span>停用</span>
          <strong>{stats.disabled}</strong>
        </div>
        <div className="stat">
          <span>管理员</span>
          <strong className="ok">{stats.admin}</strong>
        </div>
      </div>

      <div className="panel">
        <div className="toolbar">
          <div className="search-group">
            <input
              className="search"
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') setQuery(draftQuery)
              }}
              placeholder="搜索用户名 / 姓名 / 邮箱"
            />
            <button type="button" className="btn" onClick={() => setQuery(draftQuery)}>
              确认
            </button>
          </div>
          <span className="hint">共 {filtered.length} 条</span>
        </div>

        <div className="table-wrap">
          <table>
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
              {loading ? (
                <tr>
                  <td colSpan={6} className="empty">
                    加载中…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    {listError || '暂无用户'}
                  </td>
                </tr>
              ) : (
                paged.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-cell">
                        <span className="avatar">{initials(user.displayName)}</span>
                        <div>
                          <div className="user-name">{user.displayName}</div>
                          <div className="user-handle">@{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`tag${user.role === 'admin' ? ' tag-ok' : ''}`}>
                        {ROLE_LABEL[user.role]}
                      </span>
                    </td>
                    <td>
                      <span className={`tag${user.status === 'active' ? ' tag-ok' : ''}`}>
                        {STATUS_LABEL[user.status]}
                      </span>
                    </td>
                    <td>{user.email || '—'}</td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>
                      <div className="actions">
                        <button type="button" className="link-btn" onClick={() => openEdit(user)}>
                          编辑
                        </button>
                        <button
                          type="button"
                          className="link-btn"
                          disabled={user.id === session.userId && user.status === 'active'}
                          onClick={() => void toggleStatus(user)}
                        >
                          {user.status === 'active' ? '停用' : '启用'}
                        </button>
                        <button
                          type="button"
                          className="link-btn danger"
                          disabled={user.id === session.userId}
                          onClick={() => void removeUser(user)}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <ListPagination
          page={safePage}
          pageCount={pageCount}
          total={filtered.length}
          onChange={setPage}
        />
      </div>

      {dialogOpen ? (
        <div className="modal-mask" onClick={closeDialog}>
          <form
            className="modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => void onSave(event)}
          >
            <h2 className="modal-title">{creating ? '新增用户' : '编辑用户'}</h2>

            <label className="field">
              <span>用户名</span>
              <input
                value={draft.username}
                onChange={(event) => setDraft((prev) => ({ ...prev, username: event.target.value }))}
                autoComplete="off"
                required
              />
            </label>

            <label className="field">
              <span>显示名称</span>
              <input
                value={draft.displayName}
                onChange={(event) => setDraft((prev) => ({ ...prev, displayName: event.target.value }))}
                required
              />
            </label>

            <label className="field">
              <span>邮箱</span>
              <input
                type="email"
                value={draft.email}
                onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))}
              />
            </label>

            <label className="field">
              <span>{creating ? '密码' : '密码（可选）'}</span>
              <input
                type="password"
                value={draft.password}
                onChange={(event) => setDraft((prev) => ({ ...prev, password: event.target.value }))}
                autoComplete="new-password"
                placeholder={creating ? '至少 6 位' : '留空则不修改'}
                required={creating}
              />
            </label>

            <div className="row">
              <label className="field">
                <span>角色</span>
                <Select
                  value={draft.role}
                  aria-label="角色"
                  options={[
                    { value: 'admin', label: '管理员' },
                    { value: 'editor', label: '编辑' },
                    { value: 'viewer', label: '访客' },
                  ]}
                  onChange={(role) => setDraft((prev) => ({ ...prev, role }))}
                />
              </label>
              <label className="field">
                <span>状态</span>
                <Select
                  value={draft.status}
                  aria-label="状态"
                  options={[
                    { value: 'active', label: '启用' },
                    { value: 'disabled', label: '停用' },
                  ]}
                  onChange={(status) => setDraft((prev) => ({ ...prev, status }))}
                />
              </label>
            </div>

            {formError ? <div className="form-error">{formError}</div> : null}

            <div className="modal-actions">
              <button type="button" className="btn" onClick={closeDialog}>
                取消
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </Style>
  )
}

const Style = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;

  .toast {
    position: fixed;
    top: 72px;
    right: 24px;
    z-index: 50;
    padding: 10px 14px;
    border-radius: 10px;
    background: #111827;
    color: #fff;
    font-size: 13px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
    flex-shrink: 0;
  }

  .title {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    line-height: 1.3;
    color: #111827;
  }

  .desc {
    margin: 4px 0 0;
    font-size: 13px;
    line-height: 1.4;
    color: #6b7280;
  }

  .btn-primary,
  .btn {
    height: 36px;
    padding: 0 14px;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    line-height: 1;
  }

  .btn-primary {
    border: 0;
    background: #0f766e;
    color: #fff;
    font-weight: 600;
  }

  .btn-primary:hover:not(:disabled) {
    background: #0d9488;
  }

  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .btn {
    border: 1px solid #e5e7eb;
    background: #fff;
    color: #374151;
  }

  .btn:hover {
    background: #f9fafb;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
    flex-shrink: 0;
  }

  .stat {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .stat span {
    color: #6b7280;
    font-size: 13px;
  }

  .stat strong {
    font-size: 24px;
    font-weight: 700;
    line-height: 1.2;
    color: #111827;
  }

  .stat strong.ok {
    color: #0f766e;
  }

  .panel {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
    flex-shrink: 0;
  }

  .search-group {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .search {
    width: min(100%, 280px);
    height: 36px;
    padding: 0 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
  }

  .search:focus {
    border-color: #0f766e;
  }

  .hint {
    font-size: 13px;
    color: #6b7280;
    white-space: nowrap;
  }

  .table-wrap {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 720px;
  }

  th,
  td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid #f0f2f5;
    vertical-align: middle;
    font-size: 14px;
  }

  th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: #f9fafb;
    color: #6b7280;
    font-size: 13px;
    font-weight: 600;
  }

  .empty {
    text-align: center;
    color: #9ca3af;
    padding: 32px 16px;
  }

  .user-cell {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .avatar {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: #ecfdf5;
    color: #0f766e;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
    line-height: 1;
    flex-shrink: 0;
  }

  .user-name {
    font-weight: 600;
    line-height: 1.3;
  }

  .user-handle {
    margin-top: 2px;
    color: #9ca3af;
    font-size: 12px;
    line-height: 1.3;
  }

  .tag {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    background: #f3f4f6;
    color: #4b5563;
    font-size: 12px;
    font-weight: 600;
    line-height: 20px;
  }

  .tag-ok {
    background: #ecfdf5;
    color: #0f766e;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
  }

  .link-btn {
    border: 0;
    background: transparent;
    color: #0f766e;
    font-size: 13px;
    cursor: pointer;
    padding: 0;
  }

  .link-btn.danger {
    color: #dc2626;
  }

  .link-btn:disabled {
    color: #9ca3af;
    cursor: not-allowed;
  }

  .modal-mask {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgba(17, 24, 39, 0.45);
    display: grid;
    place-items: center;
    padding: 16px;
  }

  .modal {
    width: min(100%, 460px);
    background: #fff;
    border-radius: 14px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.18);
  }

  .modal-title {
    margin: 0 0 4px;
    font-size: 18px;
    font-weight: 700;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    color: #374151;
    flex: 1;
  }

  .field input {
    height: 38px;
    padding: 0 10px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    color: #111827;
    background: #fff;
    outline: none;
  }

  .field input:focus {
    border-color: #0f766e;
  }

  .row {
    display: flex;
    gap: 12px;
  }

  .form-error {
    padding: 8px 10px;
    border-radius: 8px;
    background: #fef2f2;
    color: #b91c1c;
    font-size: 13px;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
  }

  @media (max-width: 860px) {
    .stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .toolbar {
      flex-wrap: wrap;
    }

    .search-group {
      width: 100%;
    }

    .search {
      flex: 1;
      width: auto;
      min-width: 0;
    }
  }
`
