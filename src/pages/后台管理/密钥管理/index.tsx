import { type FormEvent, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import Select from '../../../components/Select'
import {
  AGNES_BASE_OPTIONS,
  ApiError,
  bulkPatchAgnesKeysEnabled,
  createAgnesKey,
  deleteAgnesKey,
  listAgnesKeys,
  patchAgnesKeyEnabled,
  updateAgnesKey,
  type AgnesApiKey,
  type AgnesBaseUrl,
} from '../auth'
import ListPagination, { LIST_PAGE_SIZE } from '../model/ListPagination'

type Draft = {
  apiKey: string
  baseUrl: AgnesBaseUrl
  enabled: boolean
}

const EMPTY_DRAFT: Draft = {
  apiKey: '',
  baseUrl: 'https://api.agnes-ai.cn/v1',
  enabled: true,
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 16)
  }
}

export default function AgnesKeysPage() {
  const [items, setItems] = useState<AgnesApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [draftQuery, setDraftQuery] = useState('')
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const [editing, setEditing] = useState<AgnesApiKey | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [page, setPage] = useState(1)
  const [bulkBusy, setBulkBusy] = useState(false)

  const INTL_BASE = 'https://apihub.agnes-ai.com/v1' as AgnesBaseUrl

  useLayoutEffect(() => {
    document.title = '密钥管理 · 后台管理'
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setListError('')
      try {
        const next = await listAgnesKeys()
        if (!cancelled) setItems(next)
      } catch (error) {
        if (!cancelled) {
          setListError(error instanceof ApiError ? error.message : '密钥列表加载失败')
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
    if (!q) return items
    return items.filter(
      (item) =>
        item.apiKey.toLowerCase().includes(q) ||
        item.apiKeyMasked.toLowerCase().includes(q) ||
        item.baseUrl.toLowerCase().includes(q) ||
        item.baseLabel.toLowerCase().includes(q),
    )
  }, [items, query])

  useEffect(() => {
    setPage(1)
  }, [query, items.length])

  const totalPages = Math.max(1, Math.ceil(filtered.length / LIST_PAGE_SIZE))
  const pageSafe = Math.min(page, totalPages)
  const paged = filtered.slice((pageSafe - 1) * LIST_PAGE_SIZE, pageSafe * LIST_PAGE_SIZE)

  const stats = useMemo(() => {
    const enabled = items.filter((item) => item.enabled).length
    return {
      total: items.length,
      enabled,
      disabled: items.length - enabled,
      cn: items.filter((item) => item.baseLabel === '中国').length,
      intl: items.filter((item) => item.baseLabel === '国际').length,
    }
  }, [items])

  function openCreate() {
    setCreating(true)
    setEditing(null)
    setDraft(EMPTY_DRAFT)
    setFormError('')
  }

  function openEdit(item: AgnesApiKey) {
    setCreating(false)
    setEditing(item)
    setDraft({
      apiKey: item.apiKey,
      baseUrl: (AGNES_BASE_OPTIONS.find((opt) => opt.value === item.baseUrl)?.value ||
        AGNES_BASE_OPTIONS[0].value) as AgnesBaseUrl,
      enabled: item.enabled,
    })
    setFormError('')
  }

  function closeDialog() {
    if (saving) return
    setCreating(false)
    setEditing(null)
    setFormError('')
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const apiKey = draft.apiKey.trim()
    if (!apiKey) {
      setFormError('请填写密钥')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      if (editing) {
        const updated = await updateAgnesKey(editing.id, {
          apiKey,
          baseUrl: draft.baseUrl,
          enabled: draft.enabled,
        })
        setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)))
        setToast('已更新')
      } else {
        const created = await createAgnesKey({
          apiKey,
          baseUrl: draft.baseUrl,
          enabled: draft.enabled,
        })
        setItems((current) => [created, ...current])
        setToast('已新增')
      }
      setCreating(false)
      setEditing(null)
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function toggleEnabled(item: AgnesApiKey) {
    try {
      const updated = await patchAgnesKeyEnabled(item.id, !item.enabled)
      setItems((current) => current.map((row) => (row.id === updated.id ? updated : row)))
      setToast(updated.enabled ? '已启用' : '已停用')
    } catch (error) {
      setToast(error instanceof ApiError ? error.message : '操作失败')
    }
  }

  async function removeItem(item: AgnesApiKey) {
    const ok = window.confirm(`确定删除密钥「${item.apiKeyMasked}」？`)
    if (!ok) return
    try {
      await deleteAgnesKey(item.id)
      setItems((current) => current.filter((row) => row.id !== item.id))
      setToast('已删除')
    } catch (error) {
      setToast(error instanceof ApiError ? error.message : '删除失败')
    }
  }

  async function toggleIntlKeys(enabled: boolean) {
    const intlCount = items.filter((item) => item.baseUrl === INTL_BASE).length
    if (intlCount === 0) {
      setToast('暂无国际密钥')
      return
    }
    const action = enabled ? '开启' : '关闭'
    const ok = window.confirm(`确定一键${action}全部 ${intlCount} 条国际密钥？`)
    if (!ok) return
    setBulkBusy(true)
    try {
      const result = await bulkPatchAgnesKeysEnabled(INTL_BASE, enabled)
      setItems(result.items)
      setToast(enabled ? `已开启 ${result.updated} 条国际密钥` : `已关闭 ${result.updated} 条国际密钥`)
    } catch (error) {
      setToast(error instanceof ApiError ? error.message : '操作失败')
    } finally {
      setBulkBusy(false)
    }
  }

  const dialogOpen = creating || Boolean(editing)

  return (
    <Style>
      {toast ? <div className="toast">{toast}</div> : null}

      <div className="head">
        <div>
          <h1 className="title">密钥管理</h1>
          <p className="desc">
            管理 Agnes API 密钥；周易 / 画布等会优先使用已启用密钥，并按 Base URL 请求对应节点。
          </p>
        </div>
        <div className="head-actions">
          <button
            type="button"
            className="btn"
            disabled={bulkBusy || stats.intl === 0}
            onClick={() => void toggleIntlKeys(true)}
          >
            {bulkBusy ? '处理中…' : '一键开启国际 Key'}
          </button>
          <button
            type="button"
            className="btn btn-warn"
            disabled={bulkBusy || stats.intl === 0}
            onClick={() => void toggleIntlKeys(false)}
          >
            {bulkBusy ? '处理中…' : '一键关闭国际 Key'}
          </button>
          <button type="button" className="btn-primary" onClick={openCreate}>
            + 新增密钥
          </button>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <span>全部</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="stat">
          <span>启用</span>
          <strong className="ok">{stats.enabled}</strong>
        </div>
        <div className="stat">
          <span>停用</span>
          <strong>{stats.disabled}</strong>
        </div>
        <div className="stat">
          <span>中国 / 国际</span>
          <strong>
            {stats.cn} / {stats.intl}
          </strong>
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
              placeholder="搜索密钥 / Base URL"
            />
            <button type="button" className="btn-primary" onClick={() => setQuery(draftQuery)}>
              搜索
            </button>
          </div>
          <span className="hint">共 {filtered.length} 条</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>密钥</th>
                <th>Base URL</th>
                <th>状态</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="empty">
                    加载中…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty">
                    {listError || '暂无密钥，可新增或重启服务以从 .env 自动导入'}
                  </td>
                </tr>
              ) : (
                paged.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <code className="key">{item.apiKeyMasked}</code>
                    </td>
                    <td>
                      <div className="base">
                        <span className={`tag${item.baseLabel === '中国' ? ' tag-ok' : ''}`}>
                          {item.baseLabel}
                        </span>
                        <span className="url" title={item.baseUrl}>
                          {item.baseUrl}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`tag${item.enabled ? ' tag-ok' : ''}`}>
                        {item.enabled ? '启用' : '停用'}
                      </span>
                    </td>
                    <td>{formatDate(item.updatedAt)}</td>
                    <td>
                      <div className="actions">
                        <button type="button" className="link-btn" onClick={() => openEdit(item)}>
                          编辑
                        </button>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => void toggleEnabled(item)}
                        >
                          {item.enabled ? '停用' : '启用'}
                        </button>
                        <button
                          type="button"
                          className="link-btn danger"
                          onClick={() => void removeItem(item)}
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
          page={pageSafe}
          pageCount={totalPages}
          total={filtered.length}
          onChange={setPage}
        />
      </div>

      {dialogOpen ? (
        <div className="modal-mask" onClick={closeDialog}>
          <form
            className="modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => void onSubmit(event)}
          >
            <h2 className="modal-title">{editing ? '编辑密钥' : '新增密钥'}</h2>

            <label className="field">
              <span>密钥 Key</span>
              <input
                value={draft.apiKey}
                onChange={(event) => setDraft((prev) => ({ ...prev, apiKey: event.target.value }))}
                placeholder="sk-..."
                autoComplete="off"
                spellCheck={false}
              />
            </label>

            <label className="field">
              <span>Base URL</span>
              <Select
                value={draft.baseUrl}
                options={AGNES_BASE_OPTIONS}
                onChange={(value) => setDraft((prev) => ({ ...prev, baseUrl: value }))}
                aria-label="Base URL"
              />
              <span className="field-hint">
                中国默认 https://api.agnes-ai.cn/v1 · 国际 https://apihub.agnes-ai.com/v1
              </span>
            </label>

            <label className="check">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, enabled: event.target.checked }))
                }
              />
              <span>启用</span>
            </label>

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

  .head-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
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
    max-width: 42rem;
  }

  .btn-primary,
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    height: 36px;
    padding: 0 14px;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    line-height: 1;
    white-space: nowrap;
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

  .btn:hover:not(:disabled) {
    background: #f9fafb;
  }

  .btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .btn-warn {
    border-color: #fecaca;
    color: #b91c1c;
  }

  .btn-warn:hover:not(:disabled) {
    background: #fef2f2;
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
    min-width: 760px;
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

  .key {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px;
    color: #111827;
  }

  .base {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .url {
    max-width: 360px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #6b7280;
    font-size: 12px;
  }

  .tag {
    display: inline-block;
    width: fit-content;
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
    width: min(100%, 520px);
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
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  .field input:focus {
    border-color: #0f766e;
  }

  .field-hint {
    font-size: 12px;
    color: #9ca3af;
    line-height: 1.4;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 38px;
    font-size: 14px;
    color: #374151;
    cursor: pointer;
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
      grid-template-columns: 1fr 1fr;
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
