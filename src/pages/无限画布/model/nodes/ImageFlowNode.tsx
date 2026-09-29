import { Handle, Position, type NodeProps } from '@xyflow/react'
import styled from 'styled-components'
import type { CanvasNodeData } from '../../utils/canvasContent'

export default function ImageFlowNode({ data }: NodeProps & { data: CanvasNodeData }) {
  return (
    <Style>
      <Handle type="target" position={Position.Left} id="in" className="handle in" />
      <Handle type="source" position={Position.Right} id="out" className="handle out" />
      <div className="head">
        <span className="badge">图片</span>
        <span className="io">输入文本 → 输出图</span>
      </div>
      <div className="cover">
        {data.imageUrl ? <img src={data.imageUrl} alt="" /> : <span>待生成</span>}
      </div>
      <h3 className="title">{data.title}</h3>
      <p className="body">{data.body}</p>
    </Style>
  )
}

const Style = styled.div`
  width: 210px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(129, 140, 248, 0.5);
  background: linear-gradient(160deg, rgba(49, 46, 129, 0.55), rgba(24, 24, 27, 0.94));
  color: #e4e4e7;
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
    background: #818cf8;
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
    color: #c7d2fe;
  }

  .io {
    font-size: 10px;
    color: #a1a1aa;
  }

  .cover {
    height: 120px;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 8px;
    display: grid;
    place-items: center;
    background: #1e1b4b;
    color: #71717a;
    font-size: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  }

  .title {
    margin: 0 0 4px;
    font-size: 13px;
    font-weight: 650;
  }

  .body {
    margin: 0;
    font-size: 11px;
    line-height: 1.45;
    color: #a1a1aa;
    max-height: 2.9em;
    overflow: hidden;
  }
`
