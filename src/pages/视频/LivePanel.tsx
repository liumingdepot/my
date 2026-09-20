import { useEffect, useState } from 'react'
import { fetchLiveChannels } from './api'
import { useVideoCopy } from './i18n'
import type { LiveChannel } from './types'
import './live.css'

type Props = {
  onOpen: (channel: LiveChannel, channels: LiveChannel[]) => void
}

export function LivePanel({ onOpen }: Props) {
  const { t } = useVideoCopy()
  const [channels, setChannels] = useState<LiveChannel[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [group, setGroup] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await fetchLiveChannels()
      setChannels(res.list)
      setGroups(res.groups)
    } catch {
      setChannels([])
      setGroups([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = channels.filter((c) => {
    if (group && c.group !== group) return false
    if (!q) return true
    return (
      c.name.toLowerCase().includes(q) ||
      c.tvgId.toLowerCase().includes(q) ||
      c.group.toLowerCase().includes(q)
    )
  })

  return (
    <div className="live">
      <header className="live-head">
        <div className="live-head__copy">
          <span className="live-badge" aria-hidden>
            <i />
            LIVE
          </span>
          <div>
            <h2>{t.liveTitle}</h2>
            <p>{t.liveLead}</p>
          </div>
        </div>
        <button type="button" className="live-refresh" onClick={() => void load()} disabled={loading}>
          {t.refresh}
        </button>
      </header>

      <form
        className="live-search"
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.liveSearch}
          aria-label={t.liveSearch}
        />
      </form>

      <div className="live-groups" role="tablist" aria-label={t.liveGroups}>
        <button
          type="button"
          role="tab"
          aria-selected={!group}
          className={!group ? 'is-active' : ''}
          onClick={() => setGroup('')}
        >
          {t.liveAll}
        </button>
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={group === g}
            className={group === g ? 'is-active' : ''}
            onClick={() => setGroup(g)}
          >
            {g}
          </button>
        ))}
      </div>

      {loading && !channels.length ? (
        <p className="live-status">{t.loading}</p>
      ) : !filtered.length ? (
        <p className="live-status">{t.emptyLive}</p>
      ) : (
        <ul className="live-list">
          {filtered.map((channel) => (
            <li key={`${channel.name}-${channel.url}`}>
              <button type="button" className="live-channel" onClick={() => onOpen(channel, channels)}>
                <span className="live-channel__logo">
                  {channel.logo ? (
                    <img src={channel.logo} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="live-channel__fallback">{channel.name.slice(0, 2)}</span>
                  )}
                </span>
                <span className="live-channel__meta">
                  <strong>{channel.name}</strong>
                  <em>{channel.group || t.liveTitle}</em>
                </span>
                <span className="live-channel__go" aria-hidden>
                  ▶
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
