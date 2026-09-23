import { type FormEvent, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import {
  ApiError,
  createGame,
  deleteGame,
  GAME_CATEGORIES,
  importGamesFromYikm,
  listGames,
  patchGameRecommended,
  updateGame,
  type Game,
  type GameCategory,
} from '../auth'
import Select from '../../../components/Select'
import ListPagination, { LIST_PAGE_SIZE } from '../model/ListPagination'

type Draft = {
  name: string
  downloadUrl: string
  imageUrl: string
  category: GameCategory
  genre: string
  recommended: boolean
}

const EMPTY_DRAFT: Draft = {
  name: '',
  downloadUrl: '',
  imageUrl: '',
  category: 'FC',
  genre: '',
  recommended: false,
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

export default function GamesAdminPage() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const [editing, setEditing] = useState<Game | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [page, setPage] = useState(1)
  const [importing, setImporting] = useState(false)
  const [importFromPage, setImportFromPage] = useState(1)
  const [importToPage, setImportToPage] = useState(1)

  useLayoutEffect(() => {
    document.title = '游戏管理 · 后台管理'
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setListError('')
      try {
        const next = await listGames()
        if (!cancelled) setGames(next)
      } catch (error) {
        if (!cancelled) {
          setListError(error instanceof ApiError ? error.message : '游戏列表加载失败')
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
    if (!q) return games
    return games.filter(
      (game) =>
        game.name.toLowerCase().includes(q) ||
        game.genre.toLowerCase().includes(q) ||
        game.category.toLowerCase().includes(q) ||
        game.downloadUrl.toLowerCase().includes(q),
    )
  }, [games, query])

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

  const stats = useMemo(() => {
    const byCategory = Object.fromEntries(GAME_CATEGORIES.map((c) => [c, 0])) as Record<
      GameCategory,
      number
    >
    for (const game of games) {
      byCategory[game.category] = (byCategory[game.category] ?? 0) + 1
    }
    return { total: games.length, byCategory }
  }, [games])

  function openCreate() {
    setEditing(null)
    setCreating(true)
    setDraft(EMPTY_DRAFT)
    setFormError('')
  }

  function openEdit(game: Game) {
    setCreating(false)
    setEditing(game)
    setDraft({
      name: game.name,
      downloadUrl: game.downloadUrl,
      imageUrl: game.imageUrl,
      category: game.category,
      genre: game.genre,
      recommended: game.recommended,
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
    const downloadUrl = draft.downloadUrl.trim()
    const imageUrl = draft.imageUrl.trim()
    const genre = draft.genre.trim()

    if (!name) {
      setFormError('请填写游戏名称')
      return
    }
    if (!downloadUrl) {
      setFormError('请填写游戏下载地址')
      return
    }
    if (!genre) {
      setFormError('请填写游戏类型')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      const payload = {
        name,
        downloadUrl,
        imageUrl,
        category: draft.category,
        genre,
        recommended: draft.recommended,
      }
      if (editing) {
        const updated = await updateGame(editing.id, payload)
        setGames((current) =>
          current
            .map((item) => (item.id === updated.id ? updated : item))
            .sort(
              (a, b) =>
                Number(b.recommended) - Number(a.recommended) ||
                b.updatedAt.localeCompare(a.updatedAt) ||
                a.name.localeCompare(b.name),
            ),
        )
        setToast('已保存')
      } else {
        const created = await createGame(payload)
        setGames((current) =>
          [created, ...current].sort(
            (a, b) =>
              Number(b.recommended) - Number(a.recommended) ||
              b.updatedAt.localeCompare(a.updatedAt) ||
              a.name.localeCompare(b.name),
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

  async function removeGame(game: Game) {
    const ok = window.confirm(`确定删除游戏「${game.name}」？`)
    if (!ok) return
    try {
      await deleteGame(game.id)
      setGames((current) => current.filter((item) => item.id !== game.id))
      setToast('已删除')
    } catch (error) {
      setToast(error instanceof ApiError ? error.message : '操作失败')
    }
  }

  async function toggleRecommended(game: Game) {
    try {
      const updated = await patchGameRecommended(game.id, !game.recommended)
      setGames((current) =>
        current
          .map((item) => (item.id === updated.id ? updated : item))
          .sort(
            (a, b) =>
              Number(b.recommended) - Number(a.recommended) ||
              b.updatedAt.localeCompare(a.updatedAt) ||
              a.name.localeCompare(b.name),
          ),
      )
      setToast(updated.recommended ? '已设为推荐' : '已取消推荐')
    } catch (error) {
      setToast(error instanceof ApiError ? error.message : '操作失败')
    }
  }

  async function onImportYikm() {
    const from = Math.max(1, Math.floor(Number(importFromPage)) || 1)
    const to = Math.max(from, Math.floor(Number(importToPage)) || from)
    if (to - from > 9) {
      setToast('单次最多采集 10 页')
      return
    }
    const pageLabel = from === to ? `第 ${from} 页` : `第 ${from}–${to} 页`
    const ok = window.confirm(
      `从 yikm.net 采集 FC 游戏${pageLabel}？已存在的记录会按来源更新。`,
    )
    if (!ok) return
    setImportFromPage(from)
    setImportToPage(to)
    setImporting(true)
    setListError('')
    let created = 0
    let updated = 0
    let scraped = 0
    try {
      for (let pageNo = from; pageNo <= to; pageNo++) {
        setToast(`采集中… 第 ${pageNo}/${to} 页`)
        const result = await importGamesFromYikm(pageNo, pageNo)
        created += result.created
        updated += result.updated
        scraped += result.scraped
        setGames(result.games)
      }
      setToast(`采集完成：新增 ${created}，更新 ${updated}（共 ${scraped}）`)
    } catch (error) {
      setToast(error instanceof ApiError ? error.message : '采集失败')
    } finally {
      setImporting(false)
    }
  }

  const dialogOpen = creating || Boolean(editing)

  return (
    <Style>
      {toast ? <div className="toast">{toast}</div> : null}

      <div className="head">
        <div>
          <h1 className="title">游戏管理</h1>
          <p className="desc">管理 FC / SFC / 街机游戏资源：名称、下载地址、图片、分类与类型。</p>
        </div>
        <div className="head-actions">
          <label className="import-page">
            <span>从第</span>
            <input
              type="number"
              min={1}
              max={999}
              value={importFromPage}
              disabled={importing}
              onChange={(event) => setImportFromPage(Number(event.target.value) || 1)}
              aria-label="采集起始页"
            />
            <span>页到</span>
            <input
              type="number"
              min={1}
              max={999}
              value={importToPage}
              disabled={importing}
              onChange={(event) => setImportToPage(Number(event.target.value) || 1)}
              aria-label="采集结束页"
            />
            <span>页</span>
          </label>
          <button
            type="button"
            className="btn"
            disabled={importing}
            onClick={() => void onImportYikm()}
          >
            {importing ? '采集中…' : '采集 yikm FC'}
          </button>
          <button type="button" className="btn-primary" onClick={openCreate}>
            + 新增游戏
          </button>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <span>全部</span>
          <strong>{stats.total}</strong>
        </div>
        {GAME_CATEGORIES.map((category) => (
          <div className="stat" key={category}>
            <span>{category}</span>
            <strong>{stats.byCategory[category]}</strong>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="toolbar">
          <input
            className="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索名称 / 类型 / 分类 / 地址"
          />
          <span className="hint">共 {filtered.length} 条</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>封面</th>
                <th>名称</th>
                <th>分类</th>
                <th>类型</th>
                <th>推荐</th>
                <th>下载地址</th>
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
                    {listError || '暂无游戏'}
                  </td>
                </tr>
              ) : (
                paged.map((game) => (
                  <tr key={game.id}>
                    <td>
                      {game.imageUrl ? (
                        <img
                          className="cover"
                          src={game.imageUrl}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="cover cover--empty">无图</span>
                      )}
                    </td>
                    <td>
                      <div className="name">
                        {game.recommended ? <span className="hot">荐</span> : null}
                        {game.name}
                      </div>
                    </td>
                    <td>
                      <span className="tag">{game.category}</span>
                    </td>
                    <td>{game.genre}</td>
                    <td>
                      <button
                        type="button"
                        className={`rec-btn${game.recommended ? ' rec-btn--on' : ''}`}
                        onClick={() => void toggleRecommended(game)}
                      >
                        {game.recommended ? '取消' : '推荐'}
                      </button>
                    </td>
                    <td>
                      <a
                        className="url"
                        href={game.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={game.downloadUrl}
                      >
                        {game.downloadUrl}
                      </a>
                    </td>
                    <td>{formatDate(game.updatedAt)}</td>
                    <td>
                      <div className="actions">
                        <button type="button" className="link-btn" onClick={() => openEdit(game)}>
                          编辑
                        </button>
                        <button
                          type="button"
                          className="link-btn danger"
                          onClick={() => void removeGame(game)}
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
            <h2 className="modal-title">{creating ? '新增游戏' : '编辑游戏'}</h2>

            <label className="field">
              <span>游戏名称</span>
              <input
                value={draft.name}
                onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                autoComplete="off"
                placeholder="如：魂斗罗"
                required
              />
            </label>

            <label className="field">
              <span>游戏下载地址</span>
              <input
                value={draft.downloadUrl}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, downloadUrl: event.target.value }))
                }
                placeholder="https://…"
                required
              />
            </label>

            <label className="field">
              <span>游戏图片</span>
              <input
                value={draft.imageUrl}
                onChange={(event) => setDraft((prev) => ({ ...prev, imageUrl: event.target.value }))}
                placeholder="https://…（图片 URL，可空）"
              />
            </label>

            {draft.imageUrl.trim() ? (
              <div className="preview">
                <img src={draft.imageUrl.trim()} alt="预览" referrerPolicy="no-referrer" />
              </div>
            ) : null}

            <div className="row">
              <label className="field">
                <span>游戏分类</span>
                <Select
                  value={draft.category}
                  aria-label="游戏分类"
                  options={GAME_CATEGORIES.map((category) => ({
                    value: category,
                    label: category,
                  }))}
                  onChange={(category) => setDraft((prev) => ({ ...prev, category }))}
                />
              </label>

              <label className="field">
                <span>游戏类型</span>
                <input
                  value={draft.genre}
                  onChange={(event) => setDraft((prev) => ({ ...prev, genre: event.target.value }))}
                  placeholder="如：格斗、射击、动作"
                  required
                />
              </label>
            </div>

            <label className="check">
              <input
                type="checkbox"
                checked={draft.recommended}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, recommended: event.target.checked }))
                }
              />
              <span>推荐到前端热门</span>
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

  .import-page {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #4b5563;
  }

  .import-page input {
    width: 56px;
    height: 36px;
    padding: 0 8px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    text-align: center;
    outline: none;
    background: #fff;
    color: #111827;
  }

  .import-page input:focus {
    border-color: #0f766e;
  }

  .import-page input:disabled {
    opacity: 0.7;
    cursor: not-allowed;
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
    min-width: 860px;
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

  .cover {
    width: 44px;
    height: 44px;
    border-radius: 8px;
    object-fit: cover;
    background: #f3f4f6;
    display: block;
  }

  .cover--empty {
    display: grid;
    place-items: center;
    font-size: 11px;
    color: #9ca3af;
  }

  .name {
    font-weight: 600;
    line-height: 1.3;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .hot {
    display: inline-grid;
    place-items: center;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border-radius: 4px;
    background: #fef3c7;
    color: #b45309;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
  }

  .rec-btn {
    height: 28px;
    padding: 0 10px;
    border-radius: 999px;
    border: 1px solid #e5e7eb;
    background: #fff;
    color: #6b7280;
    font-size: 12px;
    cursor: pointer;
  }

  .rec-btn:hover {
    border-color: #fbbf24;
    color: #b45309;
  }

  .rec-btn--on {
    border-color: #fbbf24;
    background: #fffbeb;
    color: #b45309;
    font-weight: 600;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #374151;
    cursor: pointer;
    user-select: none;
  }

  .check input {
    width: 16px;
    height: 16px;
    accent-color: #0f766e;
  }

  .url {
    display: block;
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #0f766e;
    font-size: 13px;
    text-decoration: none;
  }

  .url:hover {
    text-decoration: underline;
  }

  .tag {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    background: #ecfdf5;
    color: #0f766e;
    font-size: 12px;
    font-weight: 600;
    line-height: 20px;
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
    max-height: min(90dvh, 720px);
    overflow: auto;
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

  .preview {
    width: 88px;
    height: 88px;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 12px 16px;
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

    .search {
      width: 100%;
    }
  }
`
