import { type ChangeEvent, type FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import {
  ApiError,
  createWork,
  deleteWork,
  listWorks,
  patchWorkEnabled,
  updateWork,
  type Work,
} from '../auth'
import ListPagination, { LIST_PAGE_SIZE } from '../model/ListPagination'
import { estimateImageSize, fileToImageDataUrl } from '../model/imageInput'

type Draft = {
  title: string
  role: string
  period: string
  description: string
  image: string
  enabled: boolean
  sortOrder: string
}

const EMPTY_DRAFT: Draft = {
  title: '',
  role: '',
  period: '',
  description: '',
  image: '',
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

function sortWorks(list: Work[]) {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
}

export default function WorksPage() {
  const [works, setWorks] = useState<Work[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [draftQuery, setDraftQuery] = useState('')
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const [editing, setEditing] = useState<Work | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState('')
  const [page, setPage] = useState(1)
  const fileRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    document.title = '作品管理 · 后台管理'
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setListError('')
      try {
        const next = await listWorks()
        if (!cancelled) setWorks(sortWorks(next))
      } catch (error) {
        if (!cancelled) {
          setListError(error instanceof ApiError ? error.message : '作品列表加载失败')
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
    if (!q) return works
    return works.filter(
      (work) =>
        work.title.toLowerCase().includes(q) ||
        work.role.toLowerCase().includes(q) ||
        work.description.toLowerCase().includes(q),
    )
  }, [works, query])

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
      total: works.length,
      enabled: works.filter((work) => work.enabled).length,
      disabled: works.filter((work) => !work.enabled).length,
    }),
    [works],
  )

  function openCreate() {
    setEditing(null)
    setCreating(true)
    setDraft({
      ...EMPTY_DRAFT,
      sortOrder: String(works.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1),
    })
    setFormError('')
  }

  function openEdit(work: Work) {
    setCreating(false)
    setEditing(work)
    setDraft({
      title: work.title,
      role: work.role,
      period: work.period,
      description: work.description,
      image: work.image,
      enabled: work.enabled,
      sortOrder: String(work.sortOrder),
    })
    setFormError('')
  }

  function closeDialog() {
    setCreating(false)
    setEditing(null)
    setSaving(false)
    setUploading(false)
    setFormError('')
    setDraft(EMPTY_DRAFT)
  }

  async function onPickImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setUploading(true)
    setFormError('')
    try {
      const dataUrl = await fileToImageDataUrl(file)
      setDraft((prev) => ({ ...prev, image: dataUrl }))
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '图片处理失败')
    } finally {
      setUploading(false)
    }
  }

  async function onSave(event: FormEvent) {
    event.preventDefault()
    const title = draft.title.trim()
    const image = draft.image.trim()
    const sortOrder = Number(draft.sortOrder)

    if (!title) {
      setFormError('请填写作品标题')
      return
    }
    if (!image) {
      setFormError('请上传作品图片或填写图片地址')
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
        title,
        role: draft.role.trim(),
        period: draft.period.trim(),
        description: draft.description.trim(),
        image,
        enabled: draft.enabled,
        sortOrder,
      }
      if (editing) {
        const updated = await updateWork(editing.id, payload)
        setWorks((current) => sortWorks(current.map((item) => (item.id === updated.id ? updated : item))))
        setToast('已保存')
      } else {
        const created = await createWork(payload)
        setWorks((current) => sortWorks([...current, created]))
        setToast('已创建')
      }
      closeDialog()
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : '保存失败')
      setSaving(false)
    }
  }

  async function toggleEnabled(work: Work) {
    try {
      const updated = await patchWorkEnabled(work.id, !work.enabled)
      setWorks((current) =>
        sortWorks(current.map((item) => (item.id === updated.id ? updated : item))),
      )
      setToast(updated.enabled ? '已启用' : '已停用')
    } catch (error) {
      setToast(error instanceof ApiError ? error.message : '操作失败')
    }
  }

  async function removeWork(work: Work) {
    const ok = window.confirm(`确定删除作品「${work.title}」？`)
    if (!ok) return
    try {
      await deleteWork(work.id)
      setWorks((current) => current.filter((item) => item.id !== work.id))
      setToast('已删除')
    } catch (error) {
      setToast(error instanceof ApiError ? error.message : '操作失败')
    }
  }

  const dialogOpen = creating || Boolean(editing)
  const isBase64 = draft.image.startsWith('data:image/')

  return (
    <Style>
      {toast ? <div className="toast">{toast}</div> : null}

      <div className="head">
        <div>
          <h1 className="title">作品管理</h1>
          <p className="desc">
            维护前台「作品集 → 项目经历」的每一条记录；停用后前台不再展示，排序越小越靠前。
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          + 新增作品
        </button>
      </div>

      <div className="stats">
        <div className="stat">
          <span>全部</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="stat">
          <span>展示中</span>
          <strong className="ok">{stats.enabled}</strong>
        </div>
        <div className="stat">
          <span>已停用</span>
          <strong>{stats.disabled}</strong>
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
              placeholder="搜索标题 / 角色 / 描述"
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
                <th>作品图</th>
                <th>标题</th>
                <th>角色</th>
                <th>时间</th>
                <th>状态</th>
                <th>排序</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="empty">
                    加载中…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty">
                    {listError || '暂无作品'}
                  </td>
                </tr>
              ) : (
                paged.map((work) => (
                  <tr key={work.id}>
                    <td>
                      <div className="thumb">
                        <img src={work.image} alt="" loading="lazy" />
                      </div>
                    </td>
                    <td>
                      <div className="name">{work.title}</div>
                      <div className="sub" title={work.description}>
                        {work.description || '—'}
                      </div>
                    </td>
                    <td>{work.role || '—'}</td>
                    <td>{work.period || '—'}</td>
                    <td>
                      <span className={`tag${work.enabled ? ' tag-ok' : ''}`}>
                        {work.enabled ? '展示中' : '已停用'}
                      </span>
                    </td>
                    <td>{work.sortOrder}</td>
                    <td>{formatDate(work.updatedAt)}</td>
                    <td>
                      <div className="actions">
                        <button type="button" className="link-btn" onClick={() => openEdit(work)}>
                          编辑
                        </button>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => void toggleEnabled(work)}
                        >
                          {work.enabled ? '停用' : '启用'}
                        </button>
                        <button
                          type="button"
                          className="link-btn danger"
                          onClick={() => void removeWork(work)}
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
            <h2 className="modal-title">{creating ? '新增作品' : '编辑作品'}</h2>

            <label className="field">
              <span>标题</span>
              <input
                value={draft.title}
                onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                autoComplete="off"
                placeholder="如：内容创作中台"
                required
              />
            </label>

            <div className="row">
              <label className="field">
                <span>角色</span>
                <input
                  value={draft.role}
                  onChange={(event) => setDraft((prev) => ({ ...prev, role: event.target.value }))}
                  placeholder="如：全栈开发"
                />
              </label>
              <label className="field">
                <span>时间</span>
                <input
                  value={draft.period}
                  onChange={(event) => setDraft((prev) => ({ ...prev, period: event.target.value }))}
                  placeholder="如：2023.06 — 2024.02"
                />
              </label>
            </div>

            <label className="field">
              <span>描述</span>
              <textarea
                className="textarea"
                value={draft.description}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, description: event.target.value }))
                }
                rows={3}
                placeholder="一句话说明项目背景与成果"
              />
            </label>

            <div className="field">
              <span>作品图片</span>
              <div className="picker">
                <div className="picker__preview">
                  {draft.image ? (
                    <img src={draft.image} alt="作品图片预览" />
                  ) : (
                    <span className="picker__empty">暂无图片</span>
                  )}
                </div>
                <div className="picker__body">
                  <div className="picker__actions">
                    <button
                      type="button"
                      className="btn"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                    >
                      {uploading ? '处理中…' : '选择图片'}
                    </button>
                    {draft.image ? (
                      <button
                        type="button"
                        className="link-btn danger"
                        onClick={() => setDraft((prev) => ({ ...prev, image: '' }))}
                      >
                        移除
                      </button>
                    ) : null}
                  </div>
                  <input
                    className="picker__url"
                    value={isBase64 ? '' : draft.image}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, image: event.target.value }))
                    }
                    placeholder="或填写图片地址：/xxx.jpg"
                    disabled={isBase64}
                  />
                  <span className="picker__hint">
                    上传的图片会自动压缩并转成 base64 存库
                    {isBase64 ? `（当前约 ${estimateImageSize(draft.image)}）` : ''}
                  </span>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => void onPickImage(event)}
                />
              </div>
            </div>

            <div className="row">
              <label className="field">
                <span>排序（越小越靠前）</span>
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
                <span>前台展示</span>
              </label>
            </div>

            {formError ? <div className="form-error">{formError}</div> : null}

            <div className="modal-actions">
              <button type="button" className="btn" onClick={closeDialog}>
                取消
              </button>
              <button type="submit" className="btn-primary" disabled={saving || uploading}>
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
    opacity: 0.6;
    cursor: not-allowed;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
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
    min-width: 980px;
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

  .thumb {
    width: 88px;
    height: 56px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #e5e7eb;
    background: #f3f4f6;
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .name {
    font-weight: 600;
    line-height: 1.3;
  }

  .sub {
    margin-top: 2px;
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

  .modal-mask {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgba(17, 24, 39, 0.45);
    display: grid;
    place-items: center;
    padding: 16px;
    overflow: auto;
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

  .field input,
  .textarea {
    width: 100%;
    height: 38px;
    padding: 0 10px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    color: #111827;
    background: #fff;
    outline: none;
    font-family: inherit;
  }

  .textarea {
    height: auto;
    padding: 9px 10px;
    line-height: 1.5;
    resize: vertical;
  }

  .field input:focus,
  .textarea:focus {
    border-color: #0f766e;
  }

  .field input:disabled {
    background: #f9fafb;
    color: #9ca3af;
    cursor: not-allowed;
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

  .picker {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .picker__preview {
    width: 120px;
    height: 80px;
    flex-shrink: 0;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .picker__preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .picker__empty {
    color: #9ca3af;
    font-size: 12px;
  }

  .picker__body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .picker__actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .picker__url {
    height: 36px;
  }

  .picker__hint {
    color: #9ca3af;
    font-size: 12px;
    line-height: 1.4;
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

    .search-group {
      width: 100%;
    }

    .search {
      flex: 1;
      width: auto;
      min-width: 0;
    }

    .picker {
      flex-direction: column;
    }

    .picker__preview {
      width: 100%;
      height: 140px;
    }
  }
`