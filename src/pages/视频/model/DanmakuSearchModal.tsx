import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import {
  PLATFORM_LABEL,
  fetchDanmakuComments,
  fetchDanmakuParts,
  matchDanmaku,
  parseEpisodeNumber,
  searchDanmaku,
  type DanmakuComment,
  type DanmakuPart,
  type DanmakuSearchItem,
} from '../utils/danmaku'

const ACCENT = '#e8a54b'

type Props = {
  open: boolean
  defaultQuery: string
  episodeLabel?: string
  hasDanmaku?: boolean
  danmakuEnabled?: boolean
  onClose: () => void
  onToggleEnabled?: () => void
  onClear?: () => void
  onLoaded: (payload: {
    comments: DanmakuComment[]
    label: string
  }) => void
}

export default function DanmakuSearchModal({
  open,
  defaultQuery,
  episodeLabel = '',
  hasDanmaku = false,
  danmakuEnabled = true,
  onClose,
  onToggleEnabled,
  onClear,
  onLoaded,
}: Props) {
  const [query, setQuery] = useState(defaultQuery)
  const [list, setList] = useState<DanmakuSearchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [matching, setMatching] = useState(false)
  const [error, setError] = useState('')
  const [picked, setPicked] = useState<DanmakuSearchItem | null>(null)
  const [parts, setParts] = useState<DanmakuPart[]>([])
  const [partsLoading, setPartsLoading] = useState(false)
  const [loadingPartId, setLoadingPartId] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const searchedFor = useRef('')
  const autoMatchedFor = useRef('')

  useEffect(() => {
    if (!open) {
      searchedFor.current = ''
      return
    }
    setQuery(defaultQuery)
    setError('')
    setPicked(null)
    setParts([])
    setLoadingPartId('')
    const t = window.setTimeout(() => inputRef.current?.focus(), 40)
    return () => window.clearTimeout(t)
  }, [open, defaultQuery])

  useEffect(() => {
    if (!open) {
      autoMatchedFor.current = ''
      return
    }
    const q = defaultQuery.trim()
    if (!q || searchedFor.current === q) return
    searchedFor.current = q
    void runSearch(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultQuery])

  useEffect(() => {
    if (!open) return
    const q = defaultQuery.trim()
    if (!q || autoMatchedFor.current === q) return
    autoMatchedFor.current = q
    void runAutoMatch(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultQuery, episodeLabel])

  async function runAutoMatch(raw?: string) {
    const q = (raw ?? query).trim()
    if (!q || matching) return
    setMatching(true)
    setError('')
    try {
      const episode = parseEpisodeNumber(episodeLabel)
      const data = await matchDanmaku(q, episode)
      if (!data.list.length) throw new Error('自动匹配未找到弹幕')
      const platform = PLATFORM_LABEL[data.item.platform]
      onLoaded({
        comments: data.list,
        label: `${platform} · ${data.item.title}${data.part.title ? ` · ${data.part.title}` : ''} · ${data.count} 条`,
      })
      onClose()
    } catch (err) {
      // 自动匹配失败不打断手动搜索，只提示
      setError(err instanceof Error ? err.message : '自动匹配失败，可手动选择')
    } finally {
      setMatching(false)
    }
  }

  async function runSearch(raw?: string) {
    const q = (raw ?? query).trim()
    if (!q) {
      setError('请输入影片名')
      return
    }
    setLoading(true)
    setError('')
    setPicked(null)
    setParts([])
    searchedFor.current = q
    try {
      const data = await searchDanmaku(q)
      setList(data.list)
      if (!data.list.length) {
        setError('未找到弹幕源，试试更短的片名（不要带集数）')
      } else {
        setError('')
      }
    } catch (err) {
      setList([])
      setError(err instanceof Error ? err.message : '搜索失败')
    } finally {
      setLoading(false)
    }
  }

  async function pickItem(item: DanmakuSearchItem) {
    setPicked(item)
    setParts([])
    setPartsLoading(true)
    setError('')
    try {
      const data = await fetchDanmakuParts(item.platform, item.id, item.type)
      if (data.pages.length <= 1) {
        const part = data.pages[0]
        if (!part) throw new Error('无分集')
        await loadComments(item, part)
        return
      }
      setParts(data.pages)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载分集失败')
      setPicked(null)
    } finally {
      setPartsLoading(false)
    }
  }

  async function loadComments(item: DanmakuSearchItem, part: DanmakuPart) {
    setLoadingPartId(part.id)
    setError('')
    try {
      const data = await fetchDanmakuComments(item.platform, part.id)
      if (!data.list.length) throw new Error('该分集暂无弹幕')
      const platform = PLATFORM_LABEL[item.platform]
      onLoaded({
        comments: data.list,
        label: `${platform} · ${item.title}${part.title ? ` · ${part.title}` : ''} · ${data.count} 条`,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '弹幕加载失败')
    } finally {
      setLoadingPartId('')
    }
  }

  if (!open) return null

  return (
    <Mask
      role="dialog"
      aria-modal="true"
      aria-label="搜索弹幕"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <Panel onClick={(e) => e.stopPropagation()}>
        <header className="head">
          <h2>搜索弹幕</h2>
          <button type="button" className="close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </header>
        <p className="hint">
          腾讯 / 爱奇艺 / 优酷 多源自动匹配
          {episodeLabel ? ` · 当前 ${episodeLabel}` : ''}
        </p>

        <div className="actions">
          <button type="button" disabled={matching || !query.trim()} onClick={() => void runAutoMatch()}>
            {matching ? '匹配中…' : '自动匹配'}
          </button>
          {hasDanmaku ? (
            <>
              <button type="button" onClick={onToggleEnabled}>
                {danmakuEnabled ? '隐藏弹幕' : '显示弹幕'}
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  onClear?.()
                }}
              >
                清除弹幕
              </button>
            </>
          ) : null}
        </div>

        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault()
            void runSearch()
          }}
        >
          <input
            ref={inputRef}
            value={query}
            placeholder="输入片名搜索弹幕"
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" disabled={loading || matching}>
            {loading ? '搜索中' : '搜索'}
          </button>
        </form>

        {error ? <p className="err">{error}</p> : null}

        <div className="body">
          {picked && (partsLoading || parts.length > 0) ? (
            <div className="parts">
              <button
                type="button"
                className="back"
                onClick={() => {
                  setPicked(null)
                  setParts([])
                }}
              >
                ← 返回结果
              </button>
              <div className="picked-title">
                <span className={`plat ${picked.platform}`}>{PLATFORM_LABEL[picked.platform]}</span>
                {picked.title}
              </div>
              {partsLoading ? (
                <p className="empty">加载分集…</p>
              ) : (
                <div className="part-list">
                  {parts.map((part) => (
                    <button
                      key={part.id}
                      type="button"
                      disabled={loadingPartId === part.id}
                      onClick={() => void loadComments(picked, part)}
                    >
                      <span className="p-num">E{part.episodeIndex}</span>
                      <span className="p-name">{part.title || `第${part.episodeIndex}集`}</span>
                      <span className="p-act">
                        {loadingPartId === part.id ? '加载中…' : '加载弹幕'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="results">
              {matching && !list.length ? (
                <p className="empty">正在自动匹配多源弹幕…</p>
              ) : loading ? (
                <p className="empty">正在搜索多源弹幕…</p>
              ) : list.length === 0 ? (
                <p className="empty">输入片名开始搜索，或点「自动匹配」</p>
              ) : (
                list.map((item) => (
                  <button
                    key={`${item.platform}:${item.id}`}
                    type="button"
                    className="row"
                    onClick={() => void pickItem(item)}
                  >
                    <div className="cover">
                      {item.pic ? (
                        <img src={item.pic} alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="ph" />
                      )}
                    </div>
                    <div className="meta">
                      <div className="title">
                        <span className={`plat ${item.platform}`}>{PLATFORM_LABEL[item.platform]}</span>
                        {item.kind === '解说' ? <span className="kind">解说</span> : null}
                        {item.title}
                      </div>
                      <div className="sub">
                        {[
                          item.type,
                          item.year ? String(item.year) : '',
                          item.episodeCount ? `${item.episodeCount}集` : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </Panel>
    </Mask>
  )
}

const Mask = styled.div`
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
`

const Panel = styled.div`
  width: min(520px, 100%);
  max-height: min(78vh, 640px);
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  background: #1a1c1e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
  color: rgba(255, 255, 255, 0.9);
  overflow: hidden;

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 18px 0;
  }

  h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
  }

  .close {
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 255, 255, 0.55);
    font-size: 22px;
    line-height: 1;
    cursor: pointer;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
    }
  }

  .hint {
    margin: 6px 18px 0;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }

  .actions {
    display: flex;
    gap: 8px;
    padding: 10px 18px 0;

    button {
      height: 30px;
      padding: 0 12px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.75);
      font-size: 12px;
      cursor: pointer;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }

      &.danger:hover {
        border-color: rgba(224, 112, 112, 0.45);
        color: #e07070;
      }
    }
  }

  .search {
    display: flex;
    gap: 8px;
    padding: 14px 18px 10px;

    input {
      flex: 1;
      min-width: 0;
      height: 40px;
      padding: 0 12px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(0, 0, 0, 0.35);
      color: #fff;
      font-size: 14px;
      outline: none;

      &:focus {
        border-color: rgba(232, 165, 75, 0.55);
      }
    }

    button {
      height: 40px;
      padding: 0 16px;
      border: 0;
      border-radius: 10px;
      background: rgba(232, 165, 75, 0.9);
      color: #1a1208;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;

      &:disabled {
        opacity: 0.6;
        cursor: default;
      }
    }
  }

  .err {
    margin: 0 18px 8px;
    font-size: 13px;
    color: #e07070;
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 10px 14px;

    &::-webkit-scrollbar {
      width: 4px;
    }
    &::-webkit-scrollbar-thumb {
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.14);
    }
  }

  .empty {
    margin: 28px 0;
    text-align: center;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.35);
  }

  .row {
    display: flex;
    gap: 12px;
    width: 100%;
    padding: 10px 8px;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;

    &:hover {
      background: rgba(255, 255, 255, 0.06);
    }
  }

  .cover {
    width: 96px;
    height: 54px;
    flex-shrink: 0;
    border-radius: 8px;
    overflow: hidden;
    background: #2a2a2e;

    img,
    .ph {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  }

  .meta {
    min-width: 0;
    flex: 1;
    padding-top: 2px;
  }

  .title {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
    color: rgba(255, 255, 255, 0.92);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;

    .plat,
    .kind {
      display: inline-block;
      margin-right: 6px;
      padding: 0 5px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.6;
      vertical-align: 1px;
    }

    .plat {
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.75);

      &.tencent {
        background: rgba(0, 180, 255, 0.18);
        color: #7ad4ff;
      }
      &.iqiyi {
        background: rgba(0, 190, 120, 0.18);
        color: #6de0ad;
      }
      &.bilibili {
        background: rgba(255, 100, 150, 0.18);
        color: #ff8eb0;
      }
      &.youku {
        background: rgba(232, 165, 75, 0.2);
        color: ${ACCENT};
      }
    }

    .kind {
      background: rgba(232, 165, 75, 0.15);
      color: rgba(232, 165, 75, 0.9);
    }
  }

  .picked-title .plat {
    display: inline-block;
    margin-right: 8px;
    padding: 0 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.75);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.6;
    vertical-align: 1px;
  }

  .sub {
    margin-top: 6px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }

  .parts {
    padding: 4px 8px 0;
  }

  .back {
    padding: 0;
    border: 0;
    background: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    cursor: pointer;
    margin-bottom: 8px;

    &:hover {
      color: ${ACCENT};
    }
  }

  .picked-title {
    margin-bottom: 10px;
    font-size: 14px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.85);
  }

  .part-list {
    display: flex;
    flex-direction: column;
    gap: 6px;

    button {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      min-height: 42px;
      padding: 8px 12px;
      border: 0;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.06);
      color: inherit;
      cursor: pointer;
      text-align: left;

      &:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.1);
      }

      &:disabled {
        opacity: 0.7;
      }
    }

    .p-num {
      flex-shrink: 0;
      color: ${ACCENT};
      font-size: 12px;
      font-weight: 600;
    }

    .p-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
    }

    .p-act {
      flex-shrink: 0;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.45);
    }
  }
`
