import { Handle, Position, type NodeProps } from '@xyflow/react'
import styled from 'styled-components'
import { normalizeIdList, type CanvasNodeData } from '../../utils/canvasContent'

export default function StoryboardNode({ data }: NodeProps & { data: CanvasNodeData }) {
  return (
    <Style>
      <Handle type="target" position={Position.Left} id="in" className="handle" />
      <Handle type="source" position={Position.Right} id="out" className="handle" />
      <div className="head">
        <span className="badge">分镜</span>
        <span className="idx">{data.title}</span>
      </div>
      {data.imageUrl || data.videoUrl ? (
        <div className="media">
          {data.videoUrl ? (
            <video src={data.videoUrl} muted playsInline preload="metadata" />
          ) : (
            <img src={data.imageUrl} alt="" />
          )}
        </div>
      ) : null}
      <p className="body">{data.body}</p>
      {(normalizeIdList(data.characterIds).length > 0 ||
        data.sceneId ||
        normalizeIdList(data.propIds).length > 0) && (
        <div className="links">
          {normalizeIdList(data.characterIds).length > 0 ? (
            <span>角 {normalizeIdList(data.characterIds).length}</span>
          ) : null}
          {data.sceneId ? <span>场</span> : null}
          {normalizeIdList(data.propIds).length > 0 ? (
            <span>道 {normalizeIdList(data.propIds).length}</span>
          ) : null}
        </div>
      )}
      <div className="meta">
        <span className={data.imageUrl ? 'done' : ''}>生图</span>
        <span className={data.videoUrl ? 'done' : ''}>视频</span>
        <span>配音</span>
      </div>
    </Style>
  )
}

const Style = styled.div`
  width: 210px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(96, 165, 250, 0.45);
  background: rgba(30, 58, 138, 0.35);
  color: #e4e4e7;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);

  .handle {
    width: 8px;
    height: 8px;
    background: #60a5fa;
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
    font-size: 11px;
    font-weight: 700;
    color: #93c5fd;
    letter-spacing: 0.06em;
  }

  .idx {
    font-size: 11px;
    color: #d4d4d8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .media {
    margin: 0 0 8px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.12);
    aspect-ratio: 9 / 16;
    max-height: 160px;
    background: #0f172a;

    img,
    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  }

  .body {
    margin: 0 0 10px;
    font-size: 11px;
    line-height: 1.5;
    color: #e4e4e7;
    max-height: 4.5em;
    overflow: hidden;
  }

  .links {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    margin: -4px 0 8px;
  }

  .links span {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(52, 211, 153, 0.16);
    color: #86efac;
  }

  .meta {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .meta span {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    color: #a1a1aa;

    &.done {
      color: #86efac;
      background: rgba(52, 211, 153, 0.16);
    }
  }
`
