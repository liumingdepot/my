import { useEffect, useId, useRef, useState } from 'react'
import styled from 'styled-components'
import {
  kindMeta,
  type CanvasNodeData,
  type CanvasNodeKind,
  type UpstreamPayload,
} from '../utils/canvasContent'
import {
  createCanvasVideo,
  generateCanvasImage,
  generateCanvasText,
  waitCanvasVideo,
} from '../utils/server'

type Props = {
  nodeId: string | null
  data: CanvasNodeData | null
  upstream?: UpstreamPayload
  onChange: (nodeId: string, patch: Partial<CanvasNodeData>) => void
  onClose: () => void
}

type Busy = '' | 'text' | 'image' | 'video' | 'compose'

const TEXT_KINDS = new Set<CanvasNodeKind>([
  'text',
  'script',
  'character',
  'scene',
  'prop',
  'storyboard',
  'image',
  'video',
])
const IMAGE_KINDS = new Set<CanvasNodeKind>([
  'image',
  'character',
  'scene',
  'prop',
  'storyboard',
  'video',
])
const VIDEO_KINDS = new Set<CanvasNodeKind>(['video', 'storyboard'])

export default function NodeInspector({
  nodeId,
  data,
  upstream,
  onChange,
  onClose,
}: Props) {
  const titleId = useId()
  const composeVideoRef = useRef<HTMLVideoElement>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState<Busy>('')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [composeIndex, setComposeIndex] = useState(0)
  const [composePlaying, setComposePlaying] = useState(false)
  const [lightbox, setLightbox] = useState<null | { type: 'image' | 'video'; url: string }>(
    null,
  )

  useEffect(() => {
    if (!data) return
    setTitle(data.title)
    setBody(data.body)
    setPrompt('')
    setError('')
    setProgress('')
    setBusy('')
    setComposeIndex(0)
    setComposePlaying(false)
    setLightbox(null)
  }, [nodeId, data])

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  if (!nodeId || !data) return null

  const meta = kindMeta(data.kind)
  const isCompose = data.kind === 'compose'
  const canText = !isCompose && TEXT_KINDS.has(data.kind)
  const canImage = !isCompose && IMAGE_KINDS.has(data.kind)
  const canVideo = !isCompose && VIDEO_KINDS.has(data.kind)
  const locked = Boolean(busy)
  const upTexts = upstream?.texts || []
  const upImages = upstream?.imageUrls || []
  const upVideos = upstream?.videoUrls || []

  const commitField = (patch: Partial<CanvasNodeData>) => {
    onChange(nodeId, patch)
  }

  const buildPrompt = () => {
    const custom = prompt.trim()
    if (custom) return custom
    const local = [title.trim() || data.title, body.trim() || data.body]
      .filter(Boolean)
      .join('\n')
    if (local) return local
    if (upTexts.length) return upTexts.join('\n\n')
    return ''
  }

  const runText = async () => {
    const p = buildPrompt()
    if (!p) {
      setError('请填写内容，或连接上游文本节点')
      return
    }
    setBusy('text')
    setError('')
    setProgress('正在生成文本…')
    try {
      const result = await generateCanvasText({
        prompt: p,
        kind: data.kind,
        title: title.trim() || data.title,
        context: [body.trim() || data.body, ...upTexts].filter(Boolean).join('\n\n'),
      })
      setBody(result.text)
      commitField({ body: result.text })
      setProgress('文本已更新')
    } catch (err) {
      setError(err instanceof Error ? err.message : '文本生成失败')
      setProgress('')
    } finally {
      setBusy('')
    }
  }

  const runImage = async () => {
    const p = buildPrompt()
    if (!p) {
      setError('请填写内容，或连接上游文本节点')
      return
    }
    setBusy('image')
    setError('')
    setProgress('正在生成图片（1K）…')
    try {
      const visualPrompt = [
        `${meta.label}：${title.trim() || data.title}`,
        ...upTexts,
        body.trim() || data.body,
        prompt.trim(),
        'cinematic still, high detail, short drama key visual',
      ]
        .filter(Boolean)
        .join('\n')
      const result = await generateCanvasImage({
        prompt: visualPrompt,
        size: '1K',
        ratio:
          data.kind === 'storyboard' || data.kind === 'video' || data.kind === 'image'
            ? '9:16'
            : '1:1',
        images: upImages.length ? upImages.slice(0, 3) : undefined,
      })
      commitField({ imageUrl: result.url })
      setProgress('图片已生成')
    } catch (err) {
      setError(err instanceof Error ? err.message : '图片生成失败')
      setProgress('')
    } finally {
      setBusy('')
    }
  }

  const runVideo = async () => {
    const p = buildPrompt()
    if (!p) {
      setError('请填写内容，或连接上游文本/图片节点')
      return
    }
    setBusy('video')
    setError('')
    setProgress('提交视频任务（720P）…')
    try {
      const firstFrame = data.imageUrl || upImages[0]
      const mode = firstFrame ? 'keyframe' : 'text'
      const created = await createCanvasVideo({
        prompt: [
          title.trim() || data.title,
          ...upTexts,
          body.trim() || data.body,
          prompt.trim(),
          'short drama shot, natural motion, cinematic',
        ]
          .filter(Boolean)
          .join('\n'),
        mode,
        seconds: '5',
        aspectRatio: '9:16',
        firstFrame: mode === 'keyframe' ? firstFrame : undefined,
      })
      if (!created.keyId) throw new Error('未返回 keyId，无法查询视频结果')
      commitField({ videoId: created.videoId, videoKeyId: created.keyId })
      setProgress('视频生成中，请稍候…')
      const done = await waitCanvasVideo(created.videoId, created.keyId)
      commitField({
        videoId: created.videoId,
        videoKeyId: created.keyId,
        videoUrl: done.url,
        ...(firstFrame && !data.imageUrl ? { imageUrl: firstFrame } : {}),
      })
      setProgress('视频已生成')
    } catch (err) {
      setError(err instanceof Error ? err.message : '视频生成失败')
      setProgress('')
    } finally {
      setBusy('')
    }
  }

  const playComposeFrom = (start: number) => {
    if (!upVideos.length) {
      setError('请先生成分镜视频，并确认已连到合成节点')
      return
    }
    const idx = Math.max(0, Math.min(start, upVideos.length - 1))
    setComposeIndex(idx)
    setComposePlaying(true)
    setError('')
    setProgress(`成片预览 ${idx + 1}/${upVideos.length}`)
    requestAnimationFrame(() => {
      const el = composeVideoRef.current
      if (!el) return
      el.src = upVideos[idx]!
      void el.play().catch(() => {
        setError('无法自动播放，请点击播放器手动播放')
      })
    })
  }

  const onComposeEnded = () => {
    if (!composePlaying) return
    const next = composeIndex + 1
    if (next >= upVideos.length) {
      setComposePlaying(false)
      setProgress(`成片预览完成（共 ${upVideos.length} 镜）`)
      if (upVideos[0]) commitField({ videoUrl: upVideos[0] })
      return
    }
    playComposeFrom(next)
  }

  return (
    <Style role="complementary" aria-labelledby={titleId}>
      <div className="head">
        <div>
          <p className="kind">{data.label || meta.label}</p>
          <h2 id={titleId} className="heading">
            节点编辑
          </h2>
        </div>
        <button type="button" className="close" onClick={onClose} aria-label="关闭">
          ×
        </button>
      </div>

      {(upTexts.length > 0 || upImages.length > 0 || upVideos.length > 0) && (
        <p className="upstream">
          上游输入：
          {[
            upTexts.length ? `${upTexts.length} 段文本` : '',
            upImages.length ? `${upImages.length} 张图` : '',
            upVideos.length ? `${upVideos.length} 段视频` : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      <label className="field">
        <span>标题</span>
        <input
          value={title}
          disabled={locked}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            const next = title.trim() || meta.title
            setTitle(next)
            if (next !== data.title) commitField({ title: next })
          }}
        />
      </label>

      <label className="field">
        <span>正文</span>
        <textarea
          value={body}
          disabled={locked}
          rows={isCompose ? 4 : 8}
          onChange={(e) => setBody(e.target.value)}
          onBlur={() => {
            if (body !== data.body) commitField({ body })
          }}
        />
      </label>

      {isCompose ? (
        <>
          <p className="compose-tip">
            按分镜顺序连续播放全部上游镜头视频，作为成片预览。
          </p>
          <div className="actions">
            <button
              type="button"
              className="btn"
              disabled={!upVideos.length}
              onClick={() => playComposeFrom(0)}
            >
              {composePlaying ? '重新播放成片' : '合成预览全部镜头'}
            </button>
            {composePlaying ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setComposePlaying(false)
                  composeVideoRef.current?.pause()
                  setProgress('已停止预览')
                }}
              >
                停止
              </button>
            ) : null}
          </div>
          {upVideos.length ? (
            <div className="media">
              <span className="media-label">
                成片预览 {composeIndex + 1}/{upVideos.length}
              </span>
              <video
                ref={composeVideoRef}
                key={upVideos[composeIndex] || 'empty'}
                src={upVideos[composeIndex]}
                controls
                playsInline
                preload="metadata"
                onEnded={onComposeEnded}
              />
            </div>
          ) : (
            <p className="compose-empty">尚未接入分镜视频。点「一键对齐」可自动连线。</p>
          )}
          {upVideos.length > 0 ? (
            <ol className="compose-list">
              {upVideos.map((url, i) => (
                <li key={`${url}-${i}`}>
                  <button
                    type="button"
                    className={i === composeIndex ? 'active' : ''}
                    onClick={() => playComposeFrom(i)}
                  >
                    镜头 {String(i + 1).padStart(2, '0')}
                  </button>
                </li>
              ))}
            </ol>
          ) : null}
        </>
      ) : (
        <>
          <label className="field">
            <span>AI 提示（可选）</span>
            <textarea
              value={prompt}
              disabled={locked}
              rows={3}
              placeholder="覆盖正文；也可留空，自动使用上游输入"
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>

          <div className="actions">
            {canText ? (
              <button
                type="button"
                className="btn"
                disabled={locked}
                onClick={() => void runText()}
              >
                {busy === 'text' ? '生成中…' : '生成文本'}
              </button>
            ) : null}
            {canImage ? (
              <button
                type="button"
                className="btn"
                disabled={locked}
                onClick={() => void runImage()}
              >
                {busy === 'image' ? '生图中…' : '生成图片'}
              </button>
            ) : null}
            {canVideo ? (
              <button
                type="button"
                className="btn"
                disabled={locked}
                onClick={() => void runVideo()}
              >
                {busy === 'video' ? '生视频中…' : '生成视频'}
              </button>
            ) : null}
          </div>

          <p className="models">
            {canVideo
              ? '文本 agnes-2.5-flash · 图片 agnes-image-2.5-flash / 1K · 视频 agnes-video-2.5-flash / 720P'
              : canImage
                ? '文本 agnes-2.5-flash · 图片 agnes-image-2.5-flash / 1K'
                : '文本 agnes-2.5-flash'}
          </p>
        </>
      )}

      {progress ? <p className="progress">{progress}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!isCompose && data.imageUrl ? (
        <div className="media">
          <div className="media-head">
            <span className="media-label">
              {data.kind === 'storyboard' ? '分镜图' : '图片预览'}
            </span>
            <button
              type="button"
              className="preview-btn"
              onClick={() => setLightbox({ type: 'image', url: data.imageUrl! })}
            >
              放大预览
            </button>
          </div>
          <button
            type="button"
            className="media-thumb"
            onClick={() => setLightbox({ type: 'image', url: data.imageUrl! })}
            aria-label="放大预览图片"
          >
            <img src={data.imageUrl} alt="" />
          </button>
        </div>
      ) : null}

      {!isCompose && data.videoUrl ? (
        <div className="media">
          <div className="media-head">
            <span className="media-label">视频预览</span>
            <button
              type="button"
              className="preview-btn"
              onClick={() => setLightbox({ type: 'video', url: data.videoUrl! })}
            >
              放大预览
            </button>
          </div>
          <video
            src={data.videoUrl}
            controls
            playsInline
            preload="metadata"
            className="media-player"
          />
        </div>
      ) : null}

      {!isCompose && !data.imageUrl && upImages[0] ? (
        <div className="media">
          <div className="media-head">
            <span className="media-label">上游图片</span>
            <button
              type="button"
              className="preview-btn"
              onClick={() => setLightbox({ type: 'image', url: upImages[0]! })}
            >
              放大预览
            </button>
          </div>
          <button
            type="button"
            className="media-thumb"
            onClick={() => setLightbox({ type: 'image', url: upImages[0]! })}
            aria-label="放大预览上游图片"
          >
            <img src={upImages[0]} alt="" />
          </button>
        </div>
      ) : null}

      {!isCompose && !data.videoUrl && upVideos[0] ? (
        <div className="media">
          <div className="media-head">
            <span className="media-label">上游视频</span>
            <button
              type="button"
              className="preview-btn"
              onClick={() => setLightbox({ type: 'video', url: upVideos[0]! })}
            >
              放大预览
            </button>
          </div>
          <video
            src={upVideos[0]}
            controls
            playsInline
            preload="metadata"
            className="media-player"
          />
        </div>
      ) : null}

      {lightbox ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.type === 'image' ? '图片预览' : '视频预览'}
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="lightbox-close"
            aria-label="关闭预览"
            onClick={() => setLightbox(null)}
          >
            ×
          </button>
          <div className="lightbox-body" onClick={(e) => e.stopPropagation()}>
            {lightbox.type === 'image' ? (
              <img src={lightbox.url} alt="" />
            ) : (
              <video src={lightbox.url} controls autoPlay playsInline />
            )}
          </div>
        </div>
      ) : null}
    </Style>
  )
}

const Style = styled.aside`
  width: 300px;
  flex: none;
  border-left: 1px solid #27272a;
  background: #18181b;
  padding: 14px 12px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;

  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .kind {
    margin: 0;
    font-size: 11px;
    color: #71717a;
  }

  .heading {
    margin: 2px 0 0;
    font-size: 15px;
    font-weight: 700;
    color: #fafafa;
  }

  .upstream {
    margin: 0;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid rgba(61, 214, 198, 0.25);
    background: rgba(61, 214, 198, 0.08);
    color: #5eead4;
    font-size: 12px;
  }

  .close {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: 1px solid #3f3f46;
    background: transparent;
    color: #a1a1aa;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;

    &:hover {
      color: #fafafa;
      background: rgba(255, 255, 255, 0.04);
    }
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    color: #a1a1aa;

    input,
    textarea {
      width: 100%;
      box-sizing: border-box;
      border-radius: 8px;
      border: 1px solid #3f3f46;
      background: #0f0f12;
      color: #e4e4e7;
      font: inherit;
      font-size: 13px;
      padding: 8px 10px;
      outline: none;
      resize: vertical;

      &:focus {
        border-color: rgba(61, 214, 198, 0.55);
      }

      &:disabled {
        opacity: 0.7;
      }
    }
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .btn {
    border: 1px solid #3f3f46;
    background: #27272a;
    color: #e4e4e7;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    padding: 7px 10px;
    border-radius: 8px;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: rgba(61, 214, 198, 0.14);
      border-color: rgba(61, 214, 198, 0.45);
      color: #5eead4;
    }

    &:disabled {
      opacity: 0.65;
      cursor: wait;
    }
  }

  .models {
    margin: 0;
    font-size: 10px;
    line-height: 1.45;
    color: #52525b;
  }

  .progress {
    margin: 0;
    font-size: 12px;
    color: #60a5fa;
  }

  .error {
    margin: 0;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid rgba(248, 113, 113, 0.35);
    background: rgba(248, 113, 113, 0.08);
    color: #fca5a5;
    font-size: 12px;
    line-height: 1.45;
  }

  .media {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .media-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .media-label {
    font-size: 11px;
    color: #71717a;
  }

  .preview-btn {
    border: 1px solid #3f3f46;
    background: rgba(255, 255, 255, 0.04);
    color: #5eead4;
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 6px;
    cursor: pointer;

    &:hover {
      border-color: rgba(61, 214, 198, 0.45);
      background: rgba(61, 214, 198, 0.1);
    }
  }

  .media-thumb {
    display: block;
    width: 100%;
    padding: 0;
    border: 1px solid #3f3f46;
    border-radius: 10px;
    overflow: hidden;
    background: #0f0f12;
    cursor: zoom-in;

    &:hover {
      border-color: rgba(61, 214, 198, 0.45);
    }

    img {
      width: 100%;
      display: block;
      max-height: 280px;
      object-fit: contain;
      background: #0f0f12;
    }
  }

  .media-player {
    width: 100%;
    border-radius: 10px;
    border: 1px solid #3f3f46;
    background: #0f0f12;
    display: block;
    max-height: 320px;
  }

  .lightbox {
    position: fixed;
    inset: 0;
    z-index: 80;
    background: rgba(0, 0, 0, 0.82);
    display: grid;
    place-items: center;
    padding: 24px;
  }

  .lightbox-close {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid #3f3f46;
    background: #18181b;
    color: #fafafa;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
  }

  .lightbox-body {
    max-width: min(960px, 100%);
    max-height: min(90vh, 100%);
    display: grid;
    place-items: center;

    img,
    video {
      max-width: 100%;
      max-height: min(86vh, 900px);
      border-radius: 12px;
      background: #0f0f12;
      display: block;
    }

    video {
      width: min(720px, 100%);
    }
  }

  .compose-tip,
  .compose-empty {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: #a1a1aa;
  }

  .compose-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 180px;
    overflow: auto;

    button {
      width: 100%;
      text-align: left;
      border: 1px solid #3f3f46;
      background: transparent;
      color: #d4d4d8;
      font: inherit;
      font-size: 12px;
      padding: 6px 8px;
      border-radius: 8px;
      cursor: pointer;

      &:hover {
        border-color: rgba(251, 191, 36, 0.45);
      }

      &.active {
        border-color: rgba(251, 191, 36, 0.55);
        background: rgba(251, 191, 36, 0.12);
        color: #fcd34d;
      }
    }
  }

  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 8;
  box-shadow: -12px 0 32px rgba(0, 0, 0, 0.35);
`
