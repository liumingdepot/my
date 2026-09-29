import { Handle, Position, type NodeProps } from '@xyflow/react'
import styled from 'styled-components'
import type { CanvasNodeData } from '../../utils/canvasContent'

export default function TextFlowNode({ data }: NodeProps & { data: CanvasNodeData }) {
  return (
    <Style>
      <Handle type="target" position={Position.Left} id="in" className="handle in" />
      <Handle type="source" position={Position.Right} id="out" className="handle out" />
      <div className="head">
        <span className="badge">文本</span>
        <span className="io">输入 / 输出</span>
      </div>
      <h3 className="title">{data.title}</h3>
      <p className="body">{data.body}</p>
    </Style>
  )
}

const Style = styled.div`
  width: 230px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(251, 191, 36, 0.5);
  background: linear-gradient(160deg, rgba(120, 53, 15, 0.55), rgba(24, 24, 27, 0.92));
  color: #f4f4f5;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);

  .handle {
    width: 10px;
    height: 10px;
    border: 2px solid #0f0f12;
    border-radius: 50%;
  }
  .handle.in {
    background: #a1a1aa;
  }
  .handle.out {
    background: #fbbf24;
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

  .io {
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
    max-height: 5.5em;
    overflow: hidden;
    white-space: pre-wrap;
  }
`
