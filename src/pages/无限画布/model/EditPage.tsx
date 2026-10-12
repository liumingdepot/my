import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import styled from 'styled-components'
import {
  ensureStoryboardVideoPipeline,
  getUpstreamPayload,
  kindMeta,
  parseCanvasDocument,
  serializeCanvasDocument,
  syncAssetStoryboardEdges,
  syncStoryboardVideoFields,
  type CanvasDocument,
  type CanvasNodeData,
  type CanvasNodeKind,
} from '../utils/canvasContent'
import {
  createProject,
  getProject,
  updateProject,
  type CanvasProject,
} from '../utils/projects'
import CanvasBoard from './CanvasBoard'
import NodeInspector from './NodeInspector'
import ProjectDialog, { type ProjectFormValues } from './ProjectDialog'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const FILTERS: { id: 'all' | CanvasNodeKind; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'text', label: '文本' },
  { id: 'image', label: '图片' },
  { id: 'video', label: '视频' },
  { id: 'script', label: '剧本' },
  { id: 'character', label: '角色' },
  { id: 'scene', label: '场景' },
  { id: 'prop', label: '道具' },
  { id: 'storyboard', label: '分镜' },
  { id: 'compose', label: '成片合成' },
]

export default function EditPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState<CanvasProject | null>(null)
  const [doc, setDoc] = useState<CanvasDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | CanvasNodeKind>('all')
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateNodeRef = useRef<
    ((nodeId: string, patch: Partial<CanvasNodeData>) => void) | null
  >(null)
  const autoLayoutRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setDoc(null)
    setSelectedId(null)
    void getProject(id)
      .then(async (data) => {
        if (cancelled) return
        const parsed = parseCanvasDocument(data.item.content, data.item.title)
        const pipeline = ensureStoryboardVideoPipeline(parsed.nodes, parsed.edges)
        const pipelineChanged =
          pipeline.nodes.length !== parsed.nodes.length ||
          pipeline.edges.length !== parsed.edges.length
        const withPipeline: CanvasDocument = {
          ...parsed,
          nodes: pipeline.nodes,
          edges: pipeline.edges,
        }
        setItem(data.item)
        setDoc(withPipeline)
        if (!data.item.content?.trim() || pipelineChanged) {
          try {
            const { item: saved } = await updateProject(id, {
              content: serializeCanvasDocument(withPipeline),
            })
            if (!cancelled) setItem(saved)
          } catch {
            /* first-time seed / pipeline sync best-effort */
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setItem(null)
          setDoc(null)
          setError(err instanceof Error ? err.message : '加载失败')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [id])

  const persistContent = useCallback(
    (next: CanvasDocument) => {
      if (!id) return
      if (saveTimer.current) clearTimeout(saveTimer.current)
      setSaveState('saving')
      saveTimer.current = setTimeout(() => {
        void updateProject(id, { content: serializeCanvasDocument(next) })
          .then(({ item: saved }) => {
            setItem(saved)
            setSaveState('saved')
          })
          .catch(() => setSaveState('error'))
      }, 500)
    },
    [id],
  )

  const onDocumentChange = useCallback(
    (slice: Pick<CanvasDocument, 'nodes' | 'edges' | 'viewport'>) => {
      setDoc((prev) => {
        const edges = syncAssetStoryboardEdges(slice.nodes, slice.edges)
        const next: CanvasDocument = {
          version: 1,
          nodes: slice.nodes,
          edges,
          viewport: slice.viewport,
          assetStyle: prev?.assetStyle,
        }
        if (
          prev &&
          serializeCanvasDocument(prev) === serializeCanvasDocument(next)
        ) {
          return prev
        }
        persistContent(next)
        return next
      })
    },
    [persistContent],
  )

  const onTitleBlur = () => {
    if (!item || !titleRef.current) return
    const title = titleRef.current.value.trim() || '未命名短剧'
    if (title === item.title) return
    setSaveState('saving')
    void updateProject(id, { title })
      .then(({ item: saved }) => {
        setItem(saved)
        setSaveState('saved')
      })
      .catch(() => setSaveState('error'))
  }

  const onCreateProject = async (values: ProjectFormValues) => {
    if (creating) return
    setCreating(true)
    setCreateError('')
    try {
      const { item: created } = await createProject({
        title: values.title,
        prompt: values.prompt,
      })
      navigate(`/canvas/edit/${created.id}`)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : '创建失败')
      setCreating(false)
    }
  }

  const elements = useMemo(() => {
    if (!doc) return []
    const q = query.trim().toLowerCase()
    return doc.nodes.filter((node) => {
      const kind = node.data.kind
      if (filter !== 'all' && kind !== filter) return false
      if (!q) return true
      return (
        node.data.title.toLowerCase().includes(q) ||
        (node.data.label || '').toLowerCase().includes(q) ||
        kindMeta(kind).label.toLowerCase().includes(q)
      )
    })
  }, [doc, filter, query])

  const selectedNode = useMemo(() => {
    if (!doc || !selectedId) return null
    return doc.nodes.find((n) => n.id === selectedId) || null
  }, [doc, selectedId])

  const upstream = useMemo(() => {
    if (!doc || !selectedId) return undefined
    return getUpstreamPayload(selectedId, doc.nodes, doc.edges)
  }, [doc, selectedId])

  const onPatchNode = useCallback(
    (nodeId: string, patch: Partial<CanvasNodeData>) => {
      updateNodeRef.current?.(nodeId, patch)
      setDoc((prev) => {
        if (!prev) return prev
        const patched = prev.nodes.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...patch } }
            : node,
        )
        return {
          ...prev,
          nodes: syncStoryboardVideoFields(patched, nodeId, patch),
        }
      })
    },
    [],
  )

  return (
    <Style>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Noto+Sans+SC:wght@400;500;600;700&display=swap"
      />

      <header className="header">
        <div className="header-inner">
          <Link to="/canvas/history" className="logo" aria-label="铭AI短剧 无限画布">
            <span className="logo-mark" aria-hidden="true">
              铭
            </span>
            <span className="logo-text">
              <span className="logo-main">铭AI短剧</span>
              <span className="logo-sub">画布模式</span>
            </span>
          </Link>

          <Link to={`/canvas/edit/${id}`} className="back" aria-label="返回列表模式">
            ←
          </Link>

          <input
            ref={titleRef}
            className="title-input"
            key={item?.id || 'loading'}
            defaultValue={item?.title || (loading ? '加载中…' : '未命名短剧')}
            disabled={!item}
            onBlur={onTitleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            aria-label="项目标题"
          />

          <span
            className="info"
            title="拖拽空白处可无限平移画布；滚轮缩放；节点可自由编排。"
          >
            i
          </span>

          {saveState === 'saving' ? (
            <span className="status saving">保存中…</span>
          ) : null}
          {saveState === 'saved' ? (
            <span className="status saved">已保存</span>
          ) : null}
          {saveState === 'error' ? (
            <span className="status error">保存失败</span>
          ) : null}

          <div className="header-actions">
            <button
              type="button"
              className="align-btn"
              disabled={!doc || loading}
              onClick={() => autoLayoutRef.current?.()}
              title="补齐分镜视频与成片合成，并按列竖排：资产 / 分镜图 / 分镜视频"
            >
              一键对齐
            </button>
            <Link to={`/canvas/edit/${id}`} className="list-mode">
              列表模式
            </Link>
          </div>
        </div>
      </header>

      <div className="shell">
        <aside className="sidebar">
          <button
            type="button"
            className="create"
            onClick={() => {
              setCreateError('')
              setCreateOpen(true)
            }}
          >
            <span aria-hidden="true">+</span>
            创建新项目
          </button>

          <div className="filter-row">
            <span className="filter-label">画布元素</span>
            <select
              className="filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              aria-label="筛选元素类型"
            >
              {FILTERS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <input
              className="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索"
              aria-label="搜索画布元素"
            />
          </div>

          <ul className="list">
            {loading ? (
              <li className="empty">加载中…</li>
            ) : !doc ? (
              <li className="empty">{error || '项目不存在'}</li>
            ) : elements.length === 0 ? (
              <li className="empty">暂无元素</li>
            ) : (
              elements.map((node) => (
                <li key={node.id}>
                  <button
                    type="button"
                    className={`item${selectedId === node.id ? ' active' : ''}`}
                    onClick={() => setSelectedId(node.id)}
                  >
                    <span className="item-kind">
                      {node.data.label || kindMeta(node.data.kind).label}
                    </span>
                    <span className="item-title">{node.data.title}</span>
                  </button>
                </li>
              ))
            )}
          </ul>

          <p className="tip">
            右键空白处添加节点；拖动手柄连线，上游输出会进入下游生成。
          </p>
        </aside>

        <main className="main">
          {loading ? (
            <div className="placeholder">正在加载画布…</div>
          ) : doc ? (
            <>
              <CanvasBoard
                key={id}
                initialNodes={doc.nodes}
                initialEdges={doc.edges}
                initialViewport={doc.viewport}
                selectedId={selectedId}
                onSelectNode={setSelectedId}
                onDocumentChange={onDocumentChange}
                updateNodeRef={updateNodeRef}
                autoLayoutRef={autoLayoutRef}
              />
              <NodeInspector
                nodeId={selectedId}
                data={selectedNode?.data || null}
                upstream={upstream}
                onChange={onPatchNode}
                onClose={() => setSelectedId(null)}
              />
            </>
          ) : (
            <div className="placeholder">
              <p>{error || '项目不存在或已删除'}</p>
              <Link to="/canvas/history">返回历史列表</Link>
            </div>
          )}
        </main>
      </div>

      <ProjectDialog
        mode="create"
        open={createOpen}
        submitting={creating}
        error={createError}
        initial={{ title: '', prompt: '' }}
        onClose={() => {
          if (creating) return
          setCreateOpen(false)
          setCreateError('')
        }}
        onSubmit={onCreateProject}
      />
    </Style>
  )
}

const Style = styled.div`
  --bg: #0f0f12;
  --card: #18181b;
  --ink: #e4e4e7;
  --muted: #a1a1aa;
  --faint: #71717a;
  --line: #27272a;
  --accent: #3dd6c6;
  --display: 'Syne', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --sans: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;

  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--sans);

  .header {
    flex: none;
    border-bottom: 1px solid var(--line);
    background: #121214;
  }

  .header-inner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    min-height: 52px;
  }

  .logo {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: inherit;
    flex: none;
  }

  .logo-mark {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    font-family: var(--display);
    font-weight: 800;
    font-size: 0.82rem;
    color: #061018;
    background: linear-gradient(135deg, var(--accent), #7ef0df 70%);
  }

  .logo-text {
    display: flex;
    flex-direction: column;
    line-height: 1.15;
  }

  .logo-main {
    font-size: 13px;
    font-weight: 700;
    color: #fafafa;
  }

  .logo-sub {
    font-size: 10px;
    color: #5eead4;
  }

  .back {
    flex: none;
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    text-decoration: none;
    color: var(--muted);
    border: 1px solid transparent;
    transition:
      color 0.15s,
      background 0.15s,
      border-color 0.15s;

    &:hover {
      color: #fafafa;
      background: rgba(255, 255, 255, 0.04);
      border-color: var(--line);
    }
  }

  .title-input {
    min-width: 0;
    max-width: 240px;
    flex: 1;
    height: 32px;
    padding: 0 8px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 14px;
    outline: none;

    &:hover:not(:disabled),
    &:focus {
      border-color: var(--line);
      background: rgba(255, 255, 255, 0.03);
      color: #fafafa;
    }

    &:disabled {
      opacity: 0.7;
    }
  }

  .info {
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1px solid #3f3f46;
    display: grid;
    place-items: center;
    font-size: 11px;
    font-style: italic;
    font-family: Georgia, serif;
    color: var(--faint);
    cursor: help;
  }

  .status {
    font-size: 12px;
    flex: none;
  }
  .status.saving {
    color: #60a5fa;
  }
  .status.saved {
    color: #34d399;
  }
  .status.error {
    color: #f87171;
  }

  .header-actions {
    margin-left: auto;
    display: flex;
    gap: 8px;
  }

  .align-btn {
    border: 1px solid #3f3f46;
    background: rgba(255, 255, 255, 0.04);
    color: var(--ink);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 10px;
    border-radius: 8px;
    cursor: pointer;
    transition:
      color 0.15s,
      border-color 0.15s,
      background 0.15s;

    &:hover:not(:disabled) {
      color: #fafafa;
      border-color: #52525b;
      background: rgba(255, 255, 255, 0.08);
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }

  .list-mode {
    text-decoration: none;
    color: #5eead4;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid rgba(61, 214, 198, 0.35);
    background: rgba(61, 214, 198, 0.08);
    transition:
      color 0.15s,
      border-color 0.15s,
      background 0.15s;

    &:hover {
      color: #99f6e4;
      border-color: rgba(61, 214, 198, 0.55);
      background: rgba(61, 214, 198, 0.14);
    }
  }

  .shell {
    flex: 1;
    display: flex;
    min-height: 0;
  }

  .sidebar {
    width: 220px;
    flex: none;
    border-right: 1px solid var(--line);
    background: var(--card);
    padding: 14px 12px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .create {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 36px;
    border: none;
    border-radius: 10px;
    background: linear-gradient(135deg, var(--accent), #7ef0df 70%);
    color: #061018;
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }

  .filter-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .filter-label {
    font-size: 11px;
    color: var(--faint);
  }

  .filter,
  .search {
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.03);
    color: var(--ink);
    font: inherit;
    font-size: 12px;
    padding: 0 8px;
    outline: none;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .empty {
    color: var(--faint);
    font-size: 12px;
    padding: 8px;
  }

  .item {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: left;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: inherit;
    font: inherit;
    padding: 8px;
    cursor: pointer;

    &:hover {
      background: rgba(255, 255, 255, 0.04);
    }

    &.active {
      border-color: rgba(61, 214, 198, 0.35);
      background: rgba(61, 214, 198, 0.08);
    }
  }

  .item-kind {
    font-size: 10px;
    color: var(--accent);
  }

  .item-title {
    font-size: 12px;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tip {
    margin: 0;
    font-size: 11px;
    line-height: 1.5;
    color: var(--faint);
  }

  .main {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
    background: #0a0a0c;
  }

  .placeholder {
    height: 100%;
    display: grid;
    place-content: center;
    gap: 10px;
    text-align: center;
    color: var(--muted);

    a {
      color: var(--accent);
    }
  }
`
