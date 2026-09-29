import styled from 'styled-components'
import type { CanvasNodeKind, WorkflowMenuAction } from '../utils/canvasContent'

export type ContextMenuState = {
  x: number
  y: number
  flowX: number
  flowY: number
}

type Item = {
  id: WorkflowMenuAction
  label: string
  enabled: boolean
  icon: 'text' | 'image' | 'video' | 'audio' | 'compose' | 'director' | 'upload' | 'library'
}

const NODE_ITEMS: Item[] = [
  { id: 'text', label: '文本', enabled: true, icon: 'text' },
  { id: 'image', label: '图片', enabled: true, icon: 'image' },
  { id: 'video', label: '视频', enabled: true, icon: 'video' },
  { id: 'audio', label: '音频', enabled: false, icon: 'audio' },
  { id: 'compose', label: '成片合成', enabled: true, icon: 'compose' },
  { id: 'director', label: '导演台', enabled: false, icon: 'director' },
]

const RESOURCE_ITEMS: Item[] = [
  { id: 'upload', label: '上传', enabled: false, icon: 'upload' },
  { id: 'library', label: '从资产库添加', enabled: false, icon: 'library' },
]

type Props = {
  state: ContextMenuState
  onClose: () => void
  onAddNode: (kind: CanvasNodeKind, position: { x: number; y: number }) => void
}

function Icon({ name }: { name: Item['icon'] }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (name) {
    case 'text':
      return (
        <svg {...common}>
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <path d="M14 3v6h6" />
          <path d="M8 13h8M8 17h5" />
        </svg>
      )
    case 'image':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="10" r="1.5" />
          <path d="m21 15-4.5-4.5L7 20" />
        </svg>
      )
    case 'video':
      return (
        <svg {...common}>
          <rect x="3" y="6" width="14" height="12" rx="2" />
          <path d="m17 10 4-2v8l-4-2z" />
        </svg>
      )
    case 'audio':
      return (
        <svg {...common}>
          <path d="M9 18V6l10-2v12" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="17" cy="16" r="2" />
        </svg>
      )
    case 'compose':
      return (
        <svg {...common}>
          <rect x="4" y="5" width="12" height="10" rx="1.5" />
          <path d="m10 8 4 2.5L10 13z" />
          <path d="M8 18h12a2 2 0 0 0 2-2v-5" />
        </svg>
      )
    case 'director':
      return (
        <svg {...common}>
          <rect x="4" y="8" width="12" height="10" rx="1.5" />
          <rect x="7" y="5" width="12" height="10" rx="1.5" />
          <rect x="10" y="2" width="10" height="10" rx="1.5" />
        </svg>
      )
    case 'upload':
      return (
        <svg {...common}>
          <path d="M12 16V5" />
          <path d="m8 9 4-4 4 4" />
          <path d="M5 19h14" />
        </svg>
      )
    case 'library':
      return (
        <svg {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      )
    default:
      return null
  }
}

export default function ContextMenu({ state, onClose, onAddNode }: Props) {
  const style = {
    left: Math.min(state.x, window.innerWidth - 220),
    top: Math.min(state.y, window.innerHeight - 360),
  }

  const pick = (item: Item) => {
    if (!item.enabled) return
    if (
      item.id === 'text' ||
      item.id === 'image' ||
      item.id === 'video' ||
      item.id === 'compose'
    ) {
      onAddNode(item.id, { x: state.flowX, y: state.flowY })
      onClose()
    }
  }

  return (
    <Style
      style={style}
      role="menu"
      aria-label="画布菜单"
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="section">添加节点</p>
      {NODE_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className={`item${item.enabled ? '' : ' disabled'}`}
          disabled={!item.enabled}
          title={item.enabled ? undefined : '即将推出'}
          onClick={() => pick(item)}
        >
          <span className="icon">
            <Icon name={item.icon} />
          </span>
          <span>{item.label}</span>
          {!item.enabled ? <em>即将</em> : null}
        </button>
      ))}

      <div className="divider" />

      <p className="section">添加资源</p>
      {RESOURCE_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className="item disabled"
          disabled
          title="即将推出"
        >
          <span className="icon">
            <Icon name={item.icon} />
          </span>
          <span>{item.label}</span>
          <em>即将</em>
        </button>
      ))}
    </Style>
  )
}

const Style = styled.div`
  position: fixed;
  z-index: 40;
  width: 200px;
  padding: 8px;
  border-radius: 12px;
  background: #fff;
  box-shadow:
    0 0 0 1px rgba(15, 23, 42, 0.06),
    0 16px 40px rgba(15, 23, 42, 0.18);
  color: #1f2937;
  font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;

  .section {
    margin: 4px 8px 6px;
    font-size: 12px;
    color: #9ca3af;
    font-weight: 500;
  }

  .divider {
    height: 1px;
    margin: 6px 4px;
    background: #e5e7eb;
  }

  .item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    border: none;
    background: transparent;
    color: #111827;
    font: inherit;
    font-size: 14px;
    padding: 8px 10px;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;

    &:hover:not(:disabled) {
      background: #f3f4f6;
    }

    &.disabled {
      color: #9ca3af;
      cursor: not-allowed;
    }

    em {
      margin-left: auto;
      font-style: normal;
      font-size: 11px;
      color: #d1d5db;
    }
  }

  .icon {
    width: 18px;
    height: 18px;
    display: grid;
    place-items: center;
    color: #4b5563;
    flex: none;
  }

  .disabled .icon {
    color: #d1d5db;
  }
`
