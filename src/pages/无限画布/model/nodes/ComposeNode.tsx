import { Handle, Position, type NodeProps } from '@xyflow/react'
import styled from 'styled-components'
import type { CanvasNodeData } from '../../utils/canvasContent'

export default function ComposeNode({ data }: NodeProps & { data: CanvasNodeData }) {
  return (
    <Style>
      <Handle type="target" position={Position.Left} id="in" className="handle in" />
      <Handle type="source" position={Position.Right} id="out" className="handle out" />
      <div className="head">
        <span className="badge">成片合成</span>
        <span className="hint">全部镜头</span>
      </div>
      <div className="cover">
        {data.videoUrl ? (
          <video src={data.videoUrl} muted playsInline preload="metadata" />
        ) : (
          <span>接入分镜视频后预览</span>
        )}
      </div>
      <h3 className="title">{data.title}</h3>
      <p className="body">{data.body}</p>
      <div className="meta">
        <span className={data.videoUrl ? 'done' : ''}>顺序拼接</span>
        <span>成片</span>
      </div>
    </Style>
  )
}

const Style = styled.div`
  width: 240px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(251, 191, 36, 0.55);
  background: linear-gradient(160deg, rgba(120, 53, 15, 0.55), rgba(24, 24, 27, 0.94));
  color: #f4f4f5;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);

  .handle {
    width: 10px;
    height: 10px;
    border: 2px solid #0f0f12;
    border-radius: 50%;
  }
  .handle.in {
    background: #fbbf24;
  }
  .handle.out {
    background: #f59e0b;
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

  .cover {
    aspect-ratio: 9 / 16;
    max-height: 160px;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 8px;
    display: grid;
    place-items: center;
    background: #1c1917;
    color: #78716c;
    font-size: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);

    video {
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
    margin: 0 0 8px;
    font-size: 11px;
    line-height: 1.45;
    color: #d6d3d1;
    max-height: 2.9em;
    overflow: hidden;
  }

  .meta {
    display: flex;
    gap: 6px;
  }

  .meta span {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    color: #a1a1aa;

    &.done {
      color: #fcd34d;
      background: rgba(251, 191, 36, 0.18);
    }
  }
`
