import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import styled from 'styled-components'
import {
  createProject,
  deleteProject,
  formatRelativeTime,
  listProjects,
  updateProject,
  type CanvasProject,
} from '../utils/server'
import ProjectDialog, { type ProjectFormValues } from './ProjectDialog'

type DialogState =
  | { type: 'closed' }
  | { type: 'create' }
  | { type: 'rename'; item: CanvasProject }

export default function HistoryPage() {
  const navigate = useNavigate()
  const [list, setList] = useState<CanvasProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>({ type: 'closed' })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listProjects()
      setList(data.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
      setList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const closeDialog = () => {
    if (submitting) return
    setDialog({ type: 'closed' })
    setFormError('')
  }

  const openCreate = () => {
    setFormError('')
    setDialog({ type: 'create' })
  }

  const openRename = (item: CanvasProject) => {
    setFormError('')
    setDialog({ type: 'rename', item })
  }

  const onDialogSubmit = async (values: ProjectFormValues) => {
    if (submitting) return
    setSubmitting(true)
    setFormError('')
    try {
      if (dialog.type === 'create') {
        const { item } = await createProject({
          title: values.title,
          prompt: values.prompt,
        })
        navigate(`/canvas/edit/${item.id}`)
        return
      }
      if (dialog.type === 'rename') {
        const { item } = await updateProject(dialog.item.id, { title: values.title })
        setList((prev) => prev.map((row) => (row.id === item.id ? item : row)))
        setDialog({ type: 'closed' })
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = async (id: string, title: string) => {
    if (busyId) return
    if (!window.confirm(`确定删除「${title}」？此操作不可恢复。`)) return
    setBusyId(id)
    setError('')
    try {
      await deleteProject(id)
      setList((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Style>
      <div className="toolbar">
        <div className="toolbar-left">
          <h1 className="page-title">历史项目</h1>
          <p className="page-sub">
            {loading ? '加载中…' : list.length ? `${list.length} 个项目` : '还没有项目'}
          </p>
        </div>
        <button type="button" className="add" onClick={openCreate}>
          <span className="add-icon" aria-hidden="true">
            +
          </span>
          新增
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}

      {loading ? (
        <div className="skeleton-grid" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="empty">
          <div className="empty-visual" aria-hidden="true">
            <div className="empty-grid" />
            <div className="empty-plus">+</div>
          </div>
          <h2 className="empty-title">历史为空</h2>
          <p className="empty-desc">点击右上角「新增」，填写名称后创建你的第一部 AI 短剧草稿。</p>
          <button type="button" className="empty-cta" onClick={openCreate}>
            立即新增
          </button>
        </div>
      ) : (
        <ul className="grid">
          {list.map((item, index) => (
            <li key={item.id}>
              <article className="card">
                <Link to={`/canvas/edit/${item.id}`} className="card-link">
                  <div className={`preview preview--${index % 4}`} aria-hidden="true">
                    <div className="preview-grid" />
                    <div className="preview-nodes">
                      <span className="dot d1" />
                      <span className="dot d2" />
                      <span className="dot d3" />
                    </div>
                    <span className="preview-badge">短剧</span>
                  </div>
                </Link>
                <div className="card-body">
                  <Link to={`/canvas/edit/${item.id}`} className="card-info">
                    <h3 className="card-title">{item.title}</h3>
                    <p className="card-meta">更新于 {formatRelativeTime(item.updatedAt)}</p>
                  </Link>
                  <div className="card-actions">
                    <button
                      type="button"
                      className="act"
                      aria-label={`编辑名称 ${item.title}`}
                      disabled={busyId === item.id}
                      onClick={() => openRename(item)}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="act danger"
                      aria-label={`删除 ${item.title}`}
                      disabled={busyId === item.id}
                      onClick={() => void onDelete(item.id, item.title)}
                    >
                      {busyId === item.id ? '…' : '删除'}
                    </button>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      <ProjectDialog
        mode={dialog.type === 'rename' ? 'rename' : 'create'}
        open={dialog.type !== 'closed'}
        submitting={submitting}
        error={formError}
        initial={
          dialog.type === 'rename'
            ? { title: dialog.item.title, prompt: dialog.item.prompt }
            : { title: '', prompt: '' }
        }
        onClose={closeDialog}
        onSubmit={onDialogSubmit}
      />
    </Style>
  )
}

const Style = styled.div`
  flex: 1;
  width: 90vw;
  max-width: 90vw;
  margin: 0 auto;
  padding: 1.5rem 20px 3rem;

  .toolbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .page-title {
    margin: 0;
    font-family: var(--display);
    font-size: 1.45rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .page-sub {
    margin: 0.35rem 0 0;
    font-size: 0.875rem;
    color: var(--soft);
  }

  .add {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.65rem 1.05rem;
    border: none;
    border-radius: 999px;
    cursor: pointer;
    font: inherit;
    font-weight: 600;
    font-size: 0.9rem;
    color: #061018;
    background: linear-gradient(135deg, var(--accent) 0%, #7ef0df 70%);
    box-shadow: 0 10px 28px rgba(61, 214, 198, 0.2);
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease,
      opacity 0.2s;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 14px 32px rgba(61, 214, 198, 0.28);
    }
  }

  .add-icon {
    font-size: 1.15rem;
    line-height: 1;
    font-weight: 700;
  }

  .error {
    margin: 0 0 1rem;
    padding: 0.7rem 0.9rem;
    border-radius: 10px;
    border: 1px solid rgba(253, 164, 164, 0.35);
    background: rgba(253, 164, 164, 0.08);
    color: #fda4a4;
    font-size: 0.875rem;
  }

  .empty {
    margin-top: 1.5rem;
    padding: 3.5rem 1.5rem;
    border-radius: 20px;
    border: 1px dashed rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.02);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .empty-visual {
    position: relative;
    width: 120px;
    height: 120px;
    margin-bottom: 1.25rem;
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
    background: rgba(0, 0, 0, 0.25);
  }

  .empty-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
    background-size: 16px 16px;
    opacity: 0.7;
  }

  .empty-plus {
    position: relative;
    height: 100%;
    display: grid;
    place-items: center;
    font-size: 2.5rem;
    font-weight: 300;
    color: var(--accent);
  }

  .empty-title {
    margin: 0 0 0.5rem;
    font-size: 1.2rem;
    font-weight: 650;
  }

  .empty-desc {
    margin: 0;
    max-width: 22rem;
    font-size: 0.95rem;
    line-height: 1.6;
    color: var(--muted);
  }

  .empty-cta {
    margin-top: 1.35rem;
    padding: 0.7rem 1.2rem;
    border-radius: 10px;
    border: 1px solid rgba(61, 214, 198, 0.35);
    background: rgba(61, 214, 198, 0.1);
    color: var(--accent);
    font: inherit;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: rgba(61, 214, 198, 0.16);
    }
  }

  .skeleton-grid,
  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(400px, 100%), 1fr));
    gap: 1rem;
  }

  .skeleton-card {
    aspect-ratio: 4 / 3.4;
    border-radius: 16px;
    border: 1px solid var(--line);
    background: linear-gradient(
      110deg,
      rgba(255, 255, 255, 0.03) 20%,
      rgba(255, 255, 255, 0.07) 40%,
      rgba(255, 255, 255, 0.03) 60%
    );
    background-size: 200% 100%;
    animation: shimmer 1.4s ease-in-out infinite;
  }

  .card {
    position: relative;
    height: 100%;
    border-radius: 16px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.03);
    overflow: hidden;
    transition:
      border-color 0.2s,
      transform 0.2s,
      box-shadow 0.2s;

    &:hover {
      border-color: rgba(61, 214, 198, 0.4);
      transform: translateY(-3px);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.28);
    }
  }

  .card-link {
    display: block;
    text-decoration: none;
    color: inherit;
  }

  .preview {
    position: relative;
    aspect-ratio: 16 / 10;
    overflow: hidden;
  }

  .preview--0 {
    background: linear-gradient(145deg, #12242a, #0d151c 55%, #1a2830);
  }
  .preview--1 {
    background: linear-gradient(145deg, #1a2230, #0e141c 55%, #243040);
  }
  .preview--2 {
    background: linear-gradient(145deg, #18261f, #0c1412 55%, #1e3028);
  }
  .preview--3 {
    background: linear-gradient(145deg, #261c18, #140f0c 55%, #30241e);
  }

  .preview-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    background-size: 18px 18px;
    mask-image: radial-gradient(ellipse at 50% 40%, black 20%, transparent 75%);
  }

  .preview-nodes {
    position: absolute;
    inset: 0;
  }

  .dot {
    position: absolute;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1.5px solid rgba(61, 214, 198, 0.7);
    background: rgba(61, 214, 198, 0.25);
    box-shadow: 0 0 12px rgba(61, 214, 198, 0.35);
  }

  .d1 {
    top: 28%;
    left: 22%;
  }
  .d2 {
    top: 42%;
    right: 24%;
  }
  .d3 {
    bottom: 24%;
    left: 48%;
  }

  .preview-badge {
    position: absolute;
    top: 10px;
    left: 10px;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: #061018;
    background: rgba(126, 240, 223, 0.9);
  }

  .card-body {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
    padding: 0.85rem 0.9rem 0.95rem;
    min-width: 0;
  }

  .card-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    text-decoration: none;
    color: inherit;
  }

  .card-title {
    margin: 0;
    font-size: 0.98rem;
    font-weight: 650;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-meta {
    margin: 0;
    font-size: 0.78rem;
    color: var(--soft);
  }

  .card-actions {
    flex: none;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .act {
    padding: 0.28rem 0.55rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(238, 242, 247, 0.78);
    font: inherit;
    font-size: 0.72rem;
    cursor: pointer;
    transition:
      color 0.2s,
      border-color 0.2s,
      background 0.2s;

    &:hover:not(:disabled) {
      color: var(--accent);
      border-color: rgba(61, 214, 198, 0.4);
      background: rgba(61, 214, 198, 0.1);
    }

    &.danger:hover:not(:disabled) {
      color: #fda4a4;
      border-color: rgba(253, 164, 164, 0.4);
      background: rgba(253, 164, 164, 0.1);
    }

    &:disabled {
      cursor: wait;
      opacity: 0.7;
    }
  }

  @keyframes shimmer {
    0% {
      background-position: 100% 0;
    }
    100% {
      background-position: -100% 0;
    }
  }
`
