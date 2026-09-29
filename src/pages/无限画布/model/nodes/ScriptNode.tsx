import { Handle, Position, type NodeProps } from '@xyflow/react'
import styled from 'styled-components'
import type { CanvasNodeData } from '../../utils/canvasContent'

export default function ScriptNode({ data }: NodeProps & { data: CanvasNodeData }) {
  return (
    <Style>
      <Handle type="target" position={Position.Left} id="in" className="handle" />
      <Handle type="source" position={Position.Right} id="out" className="handle" />
      <div className="head">
        <span className="badge">剧本</span>
        <span className="hint">AI 可扩写</span>
      </div>
      <h3 className="title">{data.title}</h3>
      <p className="body">{data.body}</p>
    </Style>
  )
}

const Style = styled.div`
  width: 220px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(251, 191, 36, 0.45);
  background: rgba(120, 53, 15, 0.42);
  color: #f4f4f5;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);

  .handle {
    width: 8px;
    height: 8px;
    background: #fbbf24;
    border: none;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .badge {
    font-size: 12px;
    font-weight: 700;
    color: #fcd34d;
  }

  .hint {
    font-size: 10px;
    color: #a1a1aa;
  }

  .title {
    margin: 0 0 6px;
    font-size: 13px;
    font-weight: 650;
    line-height: 1.35;
  }

  .body {
    margin: 0;
    font-size: 11px;
    line-height: 1.5;
    color: #d4d4d8;
    max-height: 4.5em;
    overflow: hidden;
  }
`
