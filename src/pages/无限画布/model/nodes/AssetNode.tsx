import { Handle, Position, type NodeProps } from '@xyflow/react'
import styled from 'styled-components'
import type { CanvasNodeData } from '../../utils/canvasContent'

const ICONS: Record<string, string> = {
  character: '角',
  scene: '景',
  prop: '道',
}

export default function AssetNode({ data }: NodeProps & { data: CanvasNodeData }) {
  const icon = ICONS[data.kind] || '素'
  return (
    <Style data-kind={data.kind}>
      <Handle type="target" position={Position.Left} id="in" className="handle" />
      <Handle type="source" position={Position.Right} id="out" className="handle" />
      <div className="cover" aria-hidden={!data.imageUrl}>
        {data.imageUrl ? <img src={data.imageUrl} alt="" /> : icon}
      </div>
      <div className="info">
        <div className="name-row">
          <span className="name">{data.title}</span>
          <span className="kind">{data.label || '素材'}</span>
        </div>
        <p className="body">{data.body}</p>
      </div>
    </Style>
  )
}

const Style = styled.div`
  width: 176px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #3f3f46;
  background: #18181b;
  color: #e4e4e7;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);

  &[data-kind='character'] {
    border-color: rgba(129, 140, 248, 0.55);
  }
  &[data-kind='scene'] {
    border-color: rgba(52, 211, 153, 0.45);
  }
  &[data-kind='prop'] {
    border-color: rgba(251, 113, 133, 0.45);
  }

  .handle {
    width: 8px;
    height: 8px;
    background: #a1a1aa;
    border: none;
  }

  .cover {
    height: 96px;
    display: grid;
    place-items: center;
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: rgba(244, 244, 245, 0.85);
    background:
      linear-gradient(145deg, rgba(255, 255, 255, 0.06), transparent 55%),
      #27272a;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  }

  &[data-kind='character'] .cover {
    background:
      linear-gradient(145deg, rgba(129, 140, 248, 0.35), transparent 60%),
      #1e1b4b;
  }
  &[data-kind='scene'] .cover {
    background:
      linear-gradient(145deg, rgba(52, 211, 153, 0.28), transparent 60%),
      #052e2b;
  }
  &[data-kind='prop'] .cover {
    background:
      linear-gradient(145deg, rgba(251, 113, 133, 0.28), transparent 60%),
      #4c0519;
  }

  .info {
    padding: 10px 12px 12px;
  }

  .name-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }

  .name {
    font-size: 12px;
    font-weight: 650;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kind {
    flex: none;
    font-size: 10px;
    color: #a1a1aa;
  }

  .body {
    margin: 0;
    font-size: 10px;
    line-height: 1.45;
    color: #71717a;
    max-height: 2.9em;
    overflow: hidden;
  }
`
