import { useEffect, useLayoutEffect, useMemo, useState, type FormEvent } from 'react'
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
  sortOrder: string
  enabled: boolean
}

const EMPTY_DRAFT: Draft = {
  name: '',
  url: '',
  sortOrder: '',
  enabled: true,
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
  const [editing, setEditing] = useState<VideoSource | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  useLayoutEffect(() => {
    document.title = '视频源管理 · 后台管理'
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
          setListError(error instanceof ApiError ? error.message : '视频源列表加载失败')
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
    if (!q) return sources
    return sources.filter(
      (source) => source.name.toLowerCase().includes(q) || source.url.toLowerCase().includes(q),
    )
  }, [sources, query])

  const stats = useMemo(
    () => ({
      total: sources.length,
      enabled: sources.filter((source) => source.enabled).length,
    }),
    [sources],
  )

  function openCreate() {
    setEditing(null)
    setCreating(true)
    setDraft({
      ...EMPTY_DRAFT,
      sortOrder: String((sources.reduce((max, s) => Math.max(max, s.sortOrder), 0) || 0) + 1),
    })
    setFormError('')
  }

  function openEdit(source: VideoSource) {
    setCreating(false)
    setEditing(source)
    setDraft({
      name: source.name,
      url: source.url,
      sortOrder: String(source.sortOrder),
      enabled: source.enabled,
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
    const name = draft.name.trim()
    const url = draft.url.trim()
    const sortOrder = Number(draft.sortOrder)

    if (!name) {
      setFormError('请填写名称')
      return
    }
    if (!url) {
      setFormError('请填写接口地址')
      return
    }
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setFormError('接口地址须为 http/https')
        return
      }
    } catch {
      setFormError('接口地址格式不正确')
      return
    }
    if (!Number.isFinite(sortOrder)) {
      setFormError('排序须为数字')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      if (editing) {
        const updated = await updateVideoSource(editing.id, {
          name,
          url,
          sortOrder,
          enabled: draft.enabled,
        })
        setSources((current) =>
          current
            .map((source) => (source.id === updated.id ? updated : source))
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
        )
      } else {
        const created = await createVideoSource({
          name,
          url,
          sortOrder,
          enabled: draft.enabled,
        })
        setSources((current) =>
          [...current, created].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
        )
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
    } catch (error) {
      window.alert(error instanceof ApiError ? error.message : '操作失败，请稍后再试')
    }
  }

  async function removeSource(source: VideoSource) {
    if (!window.confirm(`确定删除「${source.name}」？`)) return
    try {
      await deleteVideoSource(source.id)
      setSources((current) => current.filter((item) => item.id !== source.id))
    } catch (error) {
      window.alert(error instanceof ApiError ? error.message : '操作失败，请稍后再试')
    }
  }

  const dialogOpen = creating || Boolean(editing)

  return (
    <>
      <div className="admin-page-head">
        <div>
          <h1>视频源管理</h1>
          <p>维护视频站搜索源（名称与 MacCMS 接口地址）</p>
          <div className="admin-meta">
            <span>
              全部 <b>{stats.total}</b>
            </span>
            <span>
              启用 <b>{stats.enabled}</b>
            </span>
          </div>
        </div>
        <button className="admin-btn admin-btn--primary" type="button" onClick={openCreate}>
          新建视频源
        </button>
      </div>

      <div className="admin-panel">
        <div className="admin-toolbar">
          <input
            className="admin-search"
            type="search"
            placeholder="搜索名称 / 地址"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {loading ? (
          <div className="admin-empty">加载中…</div>
        ) : listError ? (
          <div className="admin-empty">{listError}</div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty">暂无视频源</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>排序</th>
                  <th>状态</th>
                  <th>接口地址</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((source) => (
                  <tr key={source.id}>
                    <td>
                      <strong>{source.name}</strong>
                    </td>
                    <td className="admin-cell-muted">{source.sortOrder}</td>
                    <td>
                      <span className={`admin-badge admin-badge--${source.enabled ? 'active' : 'disabled'}`}>
                        {source.enabled ? '启用' : '停用'}
                      </span>
                    </td>
                    <td className="admin-cell-muted" title={source.url}>
                      <span className="admin-url">{source.url}</span>
                    </td>
                    <td className="admin-cell-muted">{formatDate(source.updatedAt)}</td>
                    <td>
                      <div className="admin-row-actions">
                        <button
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                          type="button"
                          onClick={() => openEdit(source)}
                        >
                          编辑
                        </button>
                        <button
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                          type="button"
                          onClick={() => void toggleEnabled(source)}
                        >
                          {source.enabled ? '停用' : '启用'}
                        </button>
                        <button
                          className="admin-btn admin-btn--danger admin-btn--sm"
                          type="button"
                          onClick={() => void removeSource(source)}
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
          <form
            className="admin-dialog"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => void onSave(event)}
          >
            <h2>{creating ? '新建视频源' : '编辑视频源'}</h2>
            <div className="admin-field">
              <label htmlFor="vs-name">名称</label>
              <input
                id="vs-name"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                autoComplete="off"
                placeholder="如：量子"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="vs-url">接口地址</label>
              <input
                id="vs-url"
                value={draft.url}
                onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))}
                placeholder="https://…/api.php/provide/vod/"
              />
            </div>
            <div className="admin-field-row">
              <div className="admin-field">
                <label htmlFor="vs-sort">排序</label>
                <input
                  id="vs-sort"
                  type="number"
                  value={draft.sortOrder}
                  onChange={(event) => setDraft((current) => ({ ...current, sortOrder: event.target.value }))}
                />
              </div>
              <div className="admin-field">
                <label htmlFor="vs-enabled">状态</label>
                <select
                  id="vs-enabled"
                  value={draft.enabled ? '1' : '0'}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, enabled: event.target.value === '1' }))
                  }
                >
                  <option value="1">启用</option>
                  <option value="0">停用</option>
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
