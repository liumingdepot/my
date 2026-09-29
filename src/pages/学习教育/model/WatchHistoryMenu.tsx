import { Link } from 'react-router'
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import styled from 'styled-components'
import {
  clearWatchHistory,
  deleteWatchHistory,
  readWatchHistory,
  subscribeWatchHistory,
  type WatchHistoryItem,
} from '../utils/history'

type Props = {
  accent?: string
}

const MOBILE_MQ = '(max-width: 900px)'

export default function WatchHistoryMenu({ accent = '#c9a46a' }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_MQ).matches : false,
  )
  const [list, setList] = useState<WatchHistoryItem[]>(() => readWatchHistory())

  useEffect(() => subscribeWatchHistory(() => setList(readWatchHistory())), [])

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ)
    const sync = () => setMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!open) return
    function onPointer(e: PointerEvent) {
      const target = e.target as Node
      if (wrapRef.current?.contains(target) || layerRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!open || !mobile) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open, mobile])

  function onDelete(e: MouseEvent, bvid: string) {
    e.preventDefault()
    e.stopPropagation()
    deleteWatchHistory(bvid)
  }

  const layer = open ? (
    <Layer
      ref={layerRef}
      data-mobile={mobile ? '1' : '0'}
      style={{ '--accent': accent } as CSSProperties}
    >
      {mobile ? (
        <button
          type="button"
          className="backdrop"
          aria-label="关闭观看历史"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <div className="panel" role="dialog" aria-label="观看历史">
        <div className="head">
          <p>观看历史</p>
          <div className="head-actions">
            {list.length ? (
              <button type="button" className="clear" onClick={() => clearWatchHistory()}>
                清空
              </button>
            ) : null}
            {mobile ? (
              <button
                type="button"
                className="close"
                aria-label="关闭"
                onClick={() => setOpen(false)}
              >
                关闭
              </button>
            ) : null}
          </div>
        </div>
        {list.length ? (
          <ul className="list">
            {list.map((item) => (
              <li key={item.bvid}>
                <Link
                  to={`/education/play/${encodeURIComponent(item.bvid)}`}
                  className="item"
                  onClick={() => setOpen(false)}
                >
                  <span className="thumb landscape">
                    {item.pic ? (
                      <img src={item.pic} alt="" loading="lazy" referrerPolicy="no-referrer" />
                    ) : null}
                  </span>
                  <span className="meta">
                    <span className="title">{item.title}</span>
                    <span className="sub">
                      {[item.episode, item.author].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  className="del"
                  aria-label={`删除 ${item.title}`}
                  onClick={(e) => onDelete(e, item.bvid)}
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">暂无观看记录</p>
        )}
      </div>
    </Layer>
  ) : null

  return (
    <Wrap ref={wrapRef} style={{ '--accent': accent } as CSSProperties}>
      <button
        type="button"
        className={`trigger${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        历史
        {list.length ? <span className="count">{list.length > 99 ? '99+' : list.length}</span> : null}
      </button>
      {mobile && layer ? createPortal(layer, document.body) : layer}
    </Wrap>
  )
}

const Wrap = styled.div`
  position: relative;
  flex-shrink: 0;

  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 2.1rem;
    padding: 0 0.85rem;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(240, 238, 232, 0.72);
    font: inherit;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    cursor: pointer;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
    transition:
      color 0.2s,
      border-color 0.2s,
      background 0.2s;

    &:hover,
    &.is-open {
      color: #f0eee8;
      border-color: color-mix(in srgb, var(--accent) 45%, transparent);
      background: color-mix(in srgb, var(--accent) 12%, transparent);
    }

    .count {
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      display: inline-grid;
      place-items: center;
      border-radius: 999px;
      background: var(--accent);
      color: #14110c;
      font-size: 10px;
      font-weight: 700;
    }
  }
`

const Layer = styled.div`
  &[data-mobile='0'] {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    z-index: 70;
  }

  &[data-mobile='1'] {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 12px;
    padding-bottom: max(12px, env(safe-area-inset-bottom, 0px));
    box-sizing: border-box;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    margin: 0;
    padding: 0;
    background: rgba(6, 2, 14, 0.62);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .panel {
    position: relative;
    width: min(360px, calc(100vw - 24px));
    max-height: min(70vh, 480px);
    display: flex;
    flex-direction: column;
    border-radius: 14px;
    border: 1px solid rgba(168, 130, 220, 0.28);
    background:
      linear-gradient(165deg, #2c1b42 0%, #1d1230 48%, #160e26 100%);
    box-shadow:
      0 16px 40px rgba(8, 2, 20, 0.55),
      0 0 0 1px rgba(120, 80, 180, 0.08) inset;
    overflow: hidden;
    z-index: 1;
  }

  &[data-mobile='1'] .panel {
    width: 100%;
    max-width: 520px;
    max-height: min(72vh, 560px);
    border-radius: 16px;
    box-shadow:
      0 20px 48px rgba(8, 2, 20, 0.65),
      0 0 0 1px rgba(120, 80, 180, 0.1) inset;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px 8px;
    flex-shrink: 0;

    p {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      color: #f0eee8;
    }
  }

  .head-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .clear,
  .close {
    border: 0;
    background: transparent;
    color: rgba(240, 238, 232, 0.42);
    font-size: 12px;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 6px;
    -webkit-tap-highlight-color: transparent;

    &:hover {
      color: #e07070;
    }
  }

  .close {
    color: rgba(240, 238, 232, 0.55);
    min-height: 32px;
    padding: 0 10px;
    font-size: 13px;

    &:hover {
      color: #f0eee8;
      background: rgba(255, 255, 255, 0.06);
    }
  }

  &[data-mobile='1'] .clear {
    min-height: 32px;
    padding: 0 10px;
    font-size: 13px;

    &:hover {
      background: rgba(224, 112, 112, 0.1);
    }
  }

  &[data-mobile='1'] .head {
    padding: 14px 14px 10px;

    p {
      font-size: 14px;
    }
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 4px 8px 10px;
    overflow: auto;
    flex: 1;
    min-height: 0;
    -webkit-overflow-scrolling: touch;
  }

  &[data-mobile='1'] .list {
    padding: 2px 8px 12px;
  }

  li {
    display: flex;
    align-items: center;
    gap: 6px;
    border-radius: 10px;
    transition: background 0.15s;

    &:hover {
      background: rgba(255, 255, 255, 0.05);
    }
  }

  .item {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    text-decoration: none;
    color: inherit;
    -webkit-tap-highlight-color: transparent;
  }

  &[data-mobile='1'] .item {
    padding: 10px 8px;
    gap: 12px;
  }

  .thumb {
    width: 40px;
    height: 56px;
    flex-shrink: 0;
    border-radius: 6px;
    overflow: hidden;
    background: #1a1a1f;

    &.landscape {
      width: 72px;
      height: 42px;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  }

  &[data-mobile='1'] .thumb.landscape {
    width: 80px;
    height: 46px;
    border-radius: 8px;
  }

  .meta {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .title {
    font-size: 13px;
    font-weight: 600;
    color: #f0eee8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sub {
    font-size: 11px;
    color: rgba(240, 238, 232, 0.42);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &[data-mobile='1'] .title {
    font-size: 14px;
  }

  &[data-mobile='1'] .sub {
    font-size: 12px;
  }

  .del {
    flex-shrink: 0;
    margin-right: 6px;
    border: 0;
    background: transparent;
    color: rgba(240, 238, 232, 0.35);
    font-size: 12px;
    cursor: pointer;
    padding: 6px 8px;
    border-radius: 6px;
    -webkit-tap-highlight-color: transparent;

    &:hover {
      color: #e07070;
      background: rgba(224, 112, 112, 0.1);
    }
  }

  &[data-mobile='1'] .del {
    min-height: 36px;
    min-width: 44px;
    margin-right: 4px;
    padding: 8px 10px;
    font-size: 13px;
  }

  .empty {
    margin: 0;
    padding: 28px 16px;
    text-align: center;
    font-size: 13px;
    color: rgba(240, 238, 232, 0.42);
  }

  &[data-mobile='1'] .empty {
    padding: 36px 16px;
    font-size: 14px;
  }

  @media (max-width: 420px) {
    &[data-mobile='1'] {
      padding: 8px;
      padding-bottom: max(8px, env(safe-area-inset-bottom, 0px));
    }

    &[data-mobile='1'] .panel {
      max-height: min(78vh, calc(100dvh - 24px));
    }
  }
`
