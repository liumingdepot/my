import { type FormEvent, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import {
  ApiError,
  createEducationSource,
  deleteEducationSource,
  getEducationCookie,
  importEducationSources,
  listEducationSources,
  updateEducationCookie,
  updateEducationSource,
  type EducationSource,
} from '../auth'
import ListPagination, { LIST_PAGE_SIZE } from '../model/ListPagination'

type Draft = {
  name: string
  ext: string
  sortOrder: string
}

const EMPTY_DRAFT: Draft = {
  name: '',
  ext: '',
  sortOrder: '0',
}

const EXT_PLACEHOLDER = `{
  "key": "少儿教育",
  "name": "📚┃少儿┃教育",
  "type": 3,
  "api": "csp_Bili",
  "ext": "https://gitee.com/zybal/tv/raw/master/json/少儿教育.json"
}`

const IMPORT_PLACEHOLDER = `[
  {
    "key": "少儿教育",
    "name": "📚┃少儿┃教育",
    "type": 3,
    "api": "csp_Bili",
    "ext": "https://gitee.com/zybal/tv/raw/master/json/少儿教育.json"
  },
  {
    "key": "小学课堂",
    "name": "📚┃小学┃课堂",
    "type": 3,
    "api": "csp_Bili",
    "ext": "https://gitee.com/zybal/tv/raw/master/json/小学课堂.json"
  }
]`

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

function summarizeExt(ext: string) {
  try {
    const data = JSON.parse(ext) as Record<string, unknown>
    const classCount = Array.isArray(data.classes) ? data.classes.length : 0
    const filterCount =
      data.filter && typeof data.filter === 'object' && !Array.isArray(data.filter)
        ? Object.keys(data.filter as object).length
        : 0
    const parts = [
      classCount > 0 ? `${classCount} 分类` : null,
      filterCount > 0 ? `${filterCount} 筛选` : null,
    ].filter(Boolean)
    return parts.join(' · ') || '无 classes / filter'
  } catch {
    return '无效 JSON'
  }
}

function maskCookie(cookie: string) {
  const trimmed = cookie.trim()
  if (!trimmed) return '未配置'
  if (trimmed.length <= 18) return '已配置'
  return `已配置（${trimmed.slice(0, 10)}…${trimmed.slice(-6)}）`
}

export default function EducationAdminPage() {
  const [sources, setSources] = useState<EducationSource[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [draftQuery, setDraftQuery] = useState('')
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const [editing, setEditing] = useState<EducationSource | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [page, setPage] = useState(1)

  const [cookieOpen, setCookieOpen] = useState(false)
  const [cookieValue, setCookieValue] = useState('')
  const [cookiePreview, setCookiePreview] = useState('')
  const [cookieUpdatedAt, setCookieUpdatedAt] = useState('')
  const [cookieSaving, setCookieSaving] = useState(false)
  const [cookieError, setCookieError] = useState('')

  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importSaving, setImportSaving] = useState(false)
  const [importError, setImportError] = useState('')

  useLayoutEffect(() => {
    document.title = '教育管理 · 后台管理'
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setListError('')
      try {
        const [next, cookieConfig] = await Promise.all([
          listEducationSources(),
          getEducationCookie(),
        ])
        if (!cancelled) {
          setSources(next)
          setCookiePreview(cookieConfig.cookie)
          setCookieUpdatedAt(cookieConfig.updatedAt)
        }
      } catch (error) {
        if (!cancelled) {
          setListError(error instanceof ApiError ? error.message : '教育源列表加载失败')
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
        source.name.toLowerCase().includes(q) || source.ext.toLowerCase().includes(q),
    )
  }, [sources, query])

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

  function openEdit(source: EducationSource) {
    setCreating(false)
    setEditing(source)
    setDraft({
      name: source.name,
      ext: source.ext,
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

  function openCookie() {
    setCookieValue(cookiePreview)
    setCookieError('')
    setCookieOpen(true)
  }

  function closeCookie() {
    setCookieOpen(false)
    setCookieSaving(false)
    setCookieError('')
  }

  function openImport() {
    setImportText('')
    setImportError('')
    setImportOpen(true)
  }

  function closeImport() {
    setImportOpen(false)
    setImportSaving(false)
    setImportError('')
  }

  async function onImport(event: FormEvent) {
    event.preventDefault()
    const raw = importText.trim()
    if (!raw) {
      setImportError('请粘贴 TVBox csp_Bili 源 JSON')
      return
    }
    setImportSaving(true)
    setImportError('')
    try {
      const result = await importEducationSources(raw)
      setSources(result.sources)
      const failTip =
        result.failed.length > 0
          ? `，失败 ${result.failed.length}：${result.failed
              .slice(0, 2)
              .map((f) => f.label)
              .join('、')}`
          : ''
      setToast(`导入完成：新建 ${result.created} · 更新 ${result.updated}${failTip}`)
      closeImport()
    } catch (error) {
      setImportError(error instanceof ApiError ? error.message : '导入失败')
      setImportSaving(false)
    }
  }

  async function onSaveCookie(event: FormEvent) {
    event.preventDefault()
    setCookieSaving(true)
    setCookieError('')
    try {
      const config = await updateEducationCookie(cookieValue)
      setCookiePreview(config.cookie)
      setCookieUpdatedAt(config.updatedAt)
      setToast(config.cookie.trim() ? 'Cookie 已保存' : 'Cookie 已清空')
      closeCookie()
    } catch (error) {
      setCookieError(error instanceof ApiError ? error.message : '保存失败')
      setCookieSaving(false)
    }
  }

  async function onSave(event: FormEvent) {
    event.preventDefault()
    // 新增不填名称：由后端从 homeContent / key 解析
    const name = creating ? '' : draft.name.trim()
    const ext = draft.ext.trim()
    const sortOrder = Number(draft.sortOrder)

    if (!ext) {
      setFormError('请填写 TVBox 源 / ext URL / classes JSON')
      return
    }
    if (!Number.isFinite(sortOrder)) {
      setFormError('排序需为数字')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      const payload = { name, ext, sortOrder: Math.trunc(sortOrder) }
      if (editing) {
        const updated = await updateEducationSource(editing.id, payload)
        setSources((current) =>
          current
            .map((item) => (item.id === updated.id ? updated : item))
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
        )
        setToast('已保存')
      } else {
        const created = await createEducationSource(payload)
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

  async function removeSource(source: EducationSource) {
    const ok = window.confirm(`确定删除教育源「${source.name}」？`)
    if (!ok) return
    try {
      await deleteEducationSource(source.id)
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
          <h1 className="title">教育管理</h1>
          <p className="desc">
            管理 B 站教育源（TVBox <code>csp_Bili</code>）：可粘贴站点配置或 Gitee{' '}
            <code>ext</code> URL，自动拉取 <code>classes</code> / <code>filter</code>
            ；cookie 用右侧单独配置。
          </p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn" onClick={openCookie}>
            Cookie 配置
          </button>
          <button type="button" className="btn" onClick={openImport}>
            导入 TVBox 源
          </button>
          <button type="button" className="btn-primary" onClick={openCreate}>
            + 新增教育源
          </button>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <span>全部</span>
          <strong>{sources.length}</strong>
        </div>
        <div className="stat">
          <span>B 站 Cookie</span>
          <strong className="stat-text">{maskCookie(cookiePreview)}</strong>
          {cookieUpdatedAt ? (
            <em className="stat-sub">更新 {formatDate(cookieUpdatedAt)}</em>
          ) : null}
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
              placeholder="搜索名称 / classes / filter"
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
                <th>排序</th>
                <th>名称</th>
                <th>classes / filter</th>
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
                    {listError || '暂无教育源'}
                  </td>
                </tr>
              ) : (
                paged.map((source) => (
                  <tr key={source.id}>
                    <td>{source.sortOrder}</td>
                    <td>
                      <div className="name">{source.name}</div>
                    </td>
                    <td>
                      <span className="ext-summary">{summarizeExt(source.ext)}</span>
                    </td>
                    <td>{formatDate(source.updatedAt)}</td>
                    <td>
                      <div className="actions">
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => openEdit(source)}
                        >
                          编辑
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
            <h2 className="modal-title">{creating ? '新增教育源' : '编辑教育源'}</h2>

            {editing ? (
              <label className="field">
                <span>名称</span>
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                  autoComplete="off"
                  placeholder="可空：默认取 ext.homeContent"
                />
              </label>
            ) : null}

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

            <label className="field">
              <span>ext（TVBox 源 / URL / classes JSON）</span>
              <textarea
                value={draft.ext}
                onChange={(event) => setDraft((prev) => ({ ...prev, ext: event.target.value }))}
                placeholder={EXT_PLACEHOLDER}
                spellCheck={false}
                rows={14}
                required
              />
            </label>
            <p className="field-hint">
              支持：① TVBox 站点对象（api=csp_Bili，ext 为 Gitee URL）② 直接填 ext URL ③
              粘贴 classes/filter JSON。远程 cookie 会丢弃，用全局 Cookie 配置。
            </p>

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

      {cookieOpen ? (
        <div className="modal-mask" onClick={closeCookie}>
          <form
            className="modal modal--cookie"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => void onSaveCookie(event)}
          >
            <h2 className="modal-title">B 站 Cookie 配置</h2>
            <p className="field-hint top-hint">
              全局共用，所有教育源请求 B 站时使用。可随时修改，与各源 ext 无关。
            </p>
            <label className="field">
              <span>Cookie</span>
              <textarea
                value={cookieValue}
                onChange={(event) => setCookieValue(event.target.value)}
                placeholder="SESSDATA=…; bili_jct=…; DedeUserID=…"
                spellCheck={false}
                rows={8}
              />
            </label>
            {cookieError ? <div className="form-error">{cookieError}</div> : null}
            <div className="modal-actions">
              <button type="button" className="btn" onClick={closeCookie}>
                取消
              </button>
              <button type="submit" className="btn-primary" disabled={cookieSaving}>
                {cookieSaving ? '保存中…' : '保存 Cookie'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {importOpen ? (
        <div className="modal-mask" onClick={closeImport}>
          <form
            className="modal modal--import"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => void onImport(event)}
          >
            <h2 className="modal-title">导入 TVBox 源</h2>
            <p className="field-hint top-hint">
              粘贴 csp_Bili 站点数组（或单条）。服务端会拉取 Gitee{' '}
              <code>ext</code> URL，解析 classes/filter 后入库；同名则更新。
            </p>
            <label className="field">
              <span>TVBox JSON</span>
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder={IMPORT_PLACEHOLDER}
                spellCheck={false}
                rows={16}
                required
              />
            </label>
            {importError ? <div className="form-error">{importError}</div> : null}
            <div className="modal-actions">
              <button type="button" className="btn" onClick={closeImport}>
                取消
              </button>
              <button type="submit" className="btn-primary" disabled={importSaving}>
                {importSaving ? '拉取并导入…' : '开始导入'}
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
    max-width: 52rem;
  }

  .desc code {
    font-size: 12px;
    padding: 1px 4px;
    border-radius: 4px;
    background: #f3f4f6;
    color: #374151;
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
    grid-template-columns: repeat(2, minmax(0, 1fr));
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

  .stat-text {
    font-size: 16px !important;
    font-weight: 600 !important;
  }

  .stat-sub {
    font-style: normal;
    font-size: 12px;
    color: #9ca3af;
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
    width: min(100%, 300px);
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
    min-width: 640px;
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

  .name {
    font-weight: 600;
    line-height: 1.3;
    color: #111827;
  }

  .ext-summary {
    color: #4b5563;
    font-size: 13px;
    line-height: 1.4;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .link-btn {
    border: 0;
    background: transparent;
    color: #0f766e;
    font-size: 13px;
    cursor: pointer;
    padding: 0;
  }

  .link-btn:hover {
    text-decoration: underline;
  }

  .link-btn.danger {
    color: #dc2626;
  }

  .modal-mask {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgba(15, 23, 42, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .modal {
    width: min(100%, 560px);
    max-height: min(90dvh, 720px);
    overflow: auto;
    background: #fff;
    border-radius: 14px;
    padding: 20px 20px 16px;
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .modal--cookie {
    width: min(100%, 520px);
  }

  .modal--import {
    width: min(100%, 640px);
  }

  .modal-title {
    margin: 0 0 4px;
    font-size: 18px;
    font-weight: 700;
    color: #111827;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field span {
    font-size: 13px;
    font-weight: 600;
    color: #374151;
  }

  .field input,
  .field textarea {
    width: 100%;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    color: #111827;
    outline: none;
    background: #fff;
  }

  .field input {
    height: 38px;
    padding: 0 12px;
  }

  .field textarea {
    padding: 10px 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    line-height: 1.5;
    resize: vertical;
    min-height: 180px;
  }

  .field input:focus,
  .field textarea:focus {
    border-color: #0f766e;
  }

  .field-hint {
    margin: -4px 0 0;
    font-size: 12px;
    line-height: 1.4;
    color: #9ca3af;
  }

  .top-hint {
    margin: 0;
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

  @media (max-width: 720px) {
    .stats {
      grid-template-columns: 1fr;
    }
  }
`
