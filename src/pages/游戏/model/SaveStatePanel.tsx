import { useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'
import {
  listSaves,
  readSave,
  removeSave,
  writeSave,
  type PlayerSaveApi,
  type SavePlatform,
  type SaveStateSummary,
} from '../utils/saveStore'

/** 存档槽位数量 */
export const SAVE_SLOTS = 6

type Props = {
  gameId: string
  platform: SavePlatform
  /** 播放器暴露的存取能力；为 null 时提示不可用 */
  saveApi: PlayerSaveApi | null
  onClose: () => void
}

type Busy = { slot: number; kind: 'save' | 'load' | 'delete' } | null

function formatTime(ts: number) {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function SaveStatePanel({ gameId, platform, saveApi, onClose }: Props) {
  const [saves, setSaves] = useState<SaveStateSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Busy>(null)
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    const list = await listSaves(gameId)
    setSaves(list)
    setLoading(false)
  }, [gameId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSave(slot: number) {
    if (!saveApi || busy) return
    setBusy({ slot, kind: 'save' })
    setMessage('')
    const snapshot = saveApi.save()
    if (!snapshot) {
      setMessage('存档失败：模拟器尚未就绪')
      setBusy(null)
      return
    }
    const row = await writeSave({
      gameId,
      slot,
      platform,
      data: snapshot.data,
      thumbnail: snapshot.thumbnail,
    })
    setBusy(null)
    if (!row) {
      setMessage('存档失败：浏览器存储不可用')
      return
    }
    setMessage(`已保存到存档 ${slot}`)
    await refresh()
  }

  async function handleLoad(slot: number) {
    if (!saveApi || busy) return
    setBusy({ slot, kind: 'load' })
    setMessage('')
    const row = await readSave(gameId, slot)
    if (!row) {
      setMessage(`存档 ${slot} 不存在`)
      setBusy(null)
      return
    }
    const ok = saveApi.load(row.data)
    setBusy(null)
    setMessage(ok ? `已读取存档 ${slot}` : '读取失败：存档与当前游戏不匹配')
    if (ok) onClose()
  }

  async function handleDelete(slot: number) {
    if (busy) return
    setBusy({ slot, kind: 'delete' })
    await removeSave(gameId, slot)
    await refresh()
    setBusy(null)
  }

  const bySlot = new Map(saves.map((s) => [s.slot, s]))

  return (
    <Overlay
      role="dialog"
      aria-modal="true"
      aria-label="存档"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <Panel>
        <Head>
          <h3>存档</h3>
          <Close type="button" aria-label="关闭" onClick={onClose}>
            ✕
          </Close>
        </Head>

        {!saveApi ? (
          <Empty>当前模拟器暂不支持即时存档</Empty>
        ) : (
          <>
            {message ? <Tip>{message}</Tip> : null}
            <List>
              {Array.from({ length: SAVE_SLOTS }, (_, i) => i + 1).map((slot) => {
                const row = bySlot.get(slot)
                return (
                  <Row key={slot}>
                    <Badge>{slot}</Badge>
                    {row?.thumbnail ? (
                      <Thumb src={row.thumbnail} alt="" />
                    ) : (
                      <ThumbEmpty aria-hidden>空</ThumbEmpty>
                    )}
                    <Meta>
                      <strong>存档 {slot}</strong>
                      <span>{row ? formatTime(row.updatedAt) : '空'}</span>
                    </Meta>
                    <Ops>
                      <Action
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => void handleLoad(slot)}
                      >
                        {busy?.slot === slot && busy.kind === 'load' ? '读取中…' : '读取'}
                      </Action>
                      <Action
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => void handleSave(slot)}
                      >
                        {busy?.slot === slot && busy.kind === 'save' ? '保存中…' : '保存'}
                      </Action>
                      <Action
                        type="button"
                        disabled={Boolean(busy) || !row}
                        onClick={() => void handleDelete(slot)}
                      >
                        删除
                      </Action>
                    </Ops>
                  </Row>
                )
              })}
            </List>
            {loading ? <Empty>读取中…</Empty> : null}
          </>
        )}
      </Panel>
    </Overlay>
  )
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  background: rgba(8, 10, 18, 0.5);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  animation: save-fade 0.16s ease;

  @keyframes save-fade {
    from {
      opacity: 0;
    }
  }
`

const Panel = styled.div`
  width: min(30rem, 100%);
  max-height: min(76dvh, 34rem);
  display: flex;
  flex-direction: column;
  border-radius: 1rem;
  border: 1px solid var(--line);
  background: var(--bg-elev);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.32);
  overflow: hidden;
  animation: save-pop 0.18s ease;

  @keyframes save-pop {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.98);
    }
  }
`

const Head = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.7rem 0.75rem 0.7rem 0.95rem;
  border-bottom: 1px solid var(--line);

  h3 {
    margin: 0;
    font-size: 0.82rem;
    font-weight: 720;
  }
`

const Close = styled.button`
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 0.45rem;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text-soft);
  font-size: 0.8rem;
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    color: var(--purple);
    border-color: color-mix(in srgb, var(--purple) 40%, transparent);
  }
`

const Tip = styled.p`
  margin: 0;
  padding: 0.5rem 0.95rem;
  border-bottom: 1px solid var(--line);
  background: var(--accent-soft);
  color: var(--purple);
  font-size: 0.76rem;
`

const List = styled.ul`
  margin: 0;
  padding: 0.35rem;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  overflow-y: auto;
`

const Row = styled.li`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.4rem;
  border-radius: 0.55rem;
  transition: background 0.15s ease;

  &:hover {
    background: color-mix(in srgb, var(--purple) 8%, transparent);
  }
`

const Badge = styled.span`
  width: 1.35rem;
  height: 1.35rem;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 0.4rem;
  background: var(--accent-soft);
  color: var(--purple);
  font-size: 0.74rem;
  font-weight: 750;
`

const Thumb = styled.img`
  width: 54px;
  height: 41px;
  flex-shrink: 0;
  border-radius: 0.4rem;
  border: 1px solid var(--line);
  background: #0a0c12;
  object-fit: cover;
`

const ThumbEmpty = styled.span`
  width: 54px;
  height: 41px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 0.4rem;
  border: 1px solid var(--line);
  background: #0a0c12;
  font-size: 0.66rem;
  color: var(--muted);
`

const Meta = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;

  strong {
    font-size: 0.8rem;
    font-weight: 650;
    color: var(--ink);
  }

  span {
    font-size: 0.68rem;
    color: var(--muted);
  }
`

const Ops = styled.div`
  display: flex;
  gap: 0.3rem;
`

const Action = styled.button`
  height: 26px;
  padding: 0 0.55rem;
  border-radius: 0.45rem;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text-soft);
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease;

  &:hover:not(:disabled) {
    color: var(--purple);
    border-color: color-mix(in srgb, var(--purple) 40%, transparent);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`

const Empty = styled.p`
  margin: 0;
  padding: 1.6rem 0.95rem;
  text-align: center;
  color: var(--muted);
  font-size: 0.82rem;
`