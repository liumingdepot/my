import { type FormEvent, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import {
  ApiError,
  createVideoSource,
  deleteVideoSource,
  listVideoSources,
  patchVideoSourceEnabled,
  updateVideoSource,
  type VideoSource,
} from '../auth'

type Draft = {
  name: string
  url: string
  enabled: boolean
  sortOrder: string
}

const EMPTY_DRAFT: Draft = {
  name: '',
  url: '',
  enabled: true,
  sortOrder: '0',
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

export default function VideoSourcesPage() {
  const [sources, setSources] = useState<VideoSource[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const [editing, setEditing] = useState<VideoSource | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useLayoutEffect(() => {
    document.title = '采集源 · 后台管理'
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setListError('')
      try {
        const next = await listVideoSources()
        if (!cancelled) setSources(next)
      } catch (error) {
        if (!cancelled) {
          setListError(error instanceof ApiError ? error.message : '采集源列表加载失败')
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
    if (!q) return sources
    return sources.filter(
      (source) =>
        source.name.toLowerCase().includes(q) || source.url.toLowerCase().includes(q),
    )
  }, [sources, query])

  const primaryName = useMemo(
    () => sources.find((source) => source.enabled)?.name ?? '—',
    [sources],
  )

  const stats = useMemo(
    () => ({
      total: sources.length,
      enabled: sources.filter((source) => source.enabled).length,
      disabled: sources.filter((source) => !source.enabled).length,
    }),
    [sources],
  )

  function openCreate() {
    setEditing(null)
    setCreating(true)
    const maxOrder = sources.reduce((max, item) => Math.max(max, item.sortOrder), 0)
    setDraft({
      ...EMPTY_DRAFT,
      sortOrder: String(maxOrder + 1),
    })
    setFormError('')
  }

  function openEdit(source: VideoSource) {
    setCreating(false)
    setEditing(source)
    setDraft({
      name: source.name,
      url: source.url,
      enabled: source.enabled,
      sortOrder: String(source.sortOrder),
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
    const name = draft.name.trim()
    const url = draft.url.trim()
    const sortOrder = Number(draft.sortOrder)

    if (!name || !url) {
      setFormError('请填写名称和接口地址')
      return
    }
    if (!Number.isFinite(sortOrder)) {
      setFormError('排序需为数字')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      const payload = {
        name,
        url,
        enabled: draft.enabled,
        sortOrder,
      }
      if (editing) {
        const updated = await updateVideoSource(editing.id, payload)
        setSources((current) =>
          current
            .map((item) => (item.id === updated.id ? updated : item))
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
        )
        setToast('已保存')
      } else {
        const created = await createVideoSource(payload)
        setSources((current) =>
          [created, ...current].sort(
            (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
          ),
        )
        setToast('已创建')
      }
      closeDialog()
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : '保存失败')
      setSaving(false)
    }
  }

  async function toggleEnabled(source: VideoSource) {
    try {
      const updated = await patchVideoSourceEnabled(source.id, !source.enabled)
      setSources((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setToast(updated.enabled ? '已启用' : '已停用')
    } catch (error) {
      setToast(error instanceof ApiError ? error.message : '操作失败')
    }
  }

  async function removeSource(source: VideoSource) {
    const ok = window.confirm(`确定删除采集源「${source.name}」？`)
    if (!ok) return
    try {
      await deleteVideoSource(source.id)
      setSources((current) => current.filter((item) => item.id !== source.id))
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
          <h1 className="title">采集源</h1>
          <p className="desc">
            管理视频站可用的采集接口；停用后前台不再使用。排序最靠前的启用源为主源（当前：
            {primaryName}）
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          + 新增采集源
        </button>
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
      </div>

      <div className="panel">
        <div className="toolbar">
          <input
            className="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索名称 / 地址"
          />
          <span className="hint">共 {filtered.length} 条</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>接口地址</th>
                <th>状态</th>
                <th>排序</th>
                <th>更新时间</th>
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
                    {listError || '暂无采集源'}
                  </td>
                </tr>
              ) : (
                filtered.map((source) => (
                  <tr key={source.id}>
                    <td>
                      <div className="name">
                        {source.name}
                        {source.enabled && source.name === primaryName ? (
                          <span className="tag tag-ok">主源</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className="url" title={source.url}>
                        {source.url}
                      </div>
                    </td>
                    <td>
                      <span className={`tag${source.enabled ? ' tag-ok' : ''}`}>
                        {source.enabled ? '启用' : '停用'}
                      </span>
                    </td>
                    <td>{source.sortOrder}</td>
                    <td>{formatDate(source.updatedAt)}</td>
                    <td>
                      <div className="actions">
                        <button type="button" className="link-btn" onClick={() => openEdit(source)}>
                          编辑
                        </button>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => void toggleEnabled(source)}
                        >
                          {source.enabled ? '停用' : '启用'}
                        </button>
                        <button
                          type="button"
                          className="link-btn danger"
                          onClick={() => void removeSource(source)}
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
      </div>

      {dialogOpen ? (
        <div className="modal-mask" onClick={closeDialog}>
          <form
            className="modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => void onSave(event)}
          >
            <h2 className="modal-title">{creating ? '新增采集源' : '编辑采集源'}</h2>

            <label className="field">
              <span>名称</span>
              <input
                value={draft.name}
                onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                autoComplete="off"
                placeholder="如：量子"
                required
              />
            </label>

            <label className="field">
              <span>接口地址</span>
              <input
                value={draft.url}
                onChange={(event) => setDraft((prev) => ({ ...prev, url: event.target.value }))}
                placeholder="https://…/provide/vod/"
                required
              />
            </label>

            <div className="row">
              <label className="field">
                <span>排序（越小越靠前，启用中最靠前为主源）</span>
                <input
                  type="number"
                  value={draft.sortOrder}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, sortOrder: event.target.value }))
                  }
                />
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
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
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
    overflow-x: auto;
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

  .name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    line-height: 1.3;
  }

  .url {
    max-width: 360px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #6b7280;
    font-size: 13px;
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
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 12px 16px;
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
      grid-template-columns: 1fr;
    }

    .toolbar {
      flex-wrap: wrap;
    }

    .search {
      width: 100%;
    }
  }
`
