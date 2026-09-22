import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import {
  fetchChartSongs,
  fetchCharts,
  fetchLyric,
  fetchPlaylistSongs,
  fetchPlaylists,
  fetchTagPlaylists,
  fetchTags,
  searchMusic,
} from '../utils/server'
import { useMusicCopy } from '../utils/i18n'
import type { ChartGroup, LyricLine, PlaylistCard, Song, TagGroup } from '../utils/types'
import { formatTime, usePlayer, type PlayError } from '../utils/usePlayer'
import styled from 'styled-components'

type Tab = 'search' | 'recommend' | 'charts' | 'tags'

type PlayerApi = ReturnType<typeof usePlayer>

const DEFAULT_QUERY = '周杰伦'

export function SearchPanel({ onPlay }: { onPlay: (list: Song[], index: number) => void }) {
  const { t } = useMusicCopy()
  const [key, setKey] = useState(DEFAULT_QUERY)
  const [pn, setPn] = useState(0)
  const [list, setList] = useState<Song[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<PlayError | 'search'>('')

  async function load(query: string, page: number, append = false) {
    setLoading(true)
    setError('')
    try {
      const res = await searchMusic(query, page)
      setList((prev) => (append ? [...prev, ...res.list] : res.list))
      setPn(page)
    } catch {
      setError('search')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(DEFAULT_QUERY, 0)
  }, [])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const q = key.trim() || DEFAULT_QUERY
    void load(q, 0)
  }

  return (
    <Style>
    <div className="panel">
      <form className="search-form" onSubmit={onSubmit}>
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={t.searchPlaceholder}
          enterKeyHint="search"
        />
        <button type="submit">{t.search}</button>
      </form>
      {error === 'search' && <p className="state-msg">{t.errors.search}</p>}
      <SongList list={list} onPlay={onPlay} />
      {list.length > 0 && (
        <button
          type="button"
          className="more-btn"
          disabled={loading}
          onClick={() => void load(key.trim() || DEFAULT_QUERY, pn + 1, true)}
        >
          {loading ? t.loading : t.loadMore}
        </button>
      )}
    </div></Style>
  )
}

export function RecommendPanel({ onPlay }: { onPlay: (list: Song[], index: number) => void }) {
  const { t } = useMusicCopy()
  const [cards, setCards] = useState<PlaylistCard[]>([])
  const [songs, setSongs] = useState<Song[] | null>(null)
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<'' | 'recommend' | 'playlist'>('')

  useEffect(() => {
    void fetchPlaylists()
      .then((res) => setCards(res.list))
      .catch(() => setError('recommend'))
      .finally(() => setLoading(false))
  }, [])

  async function openPlaylist(card: PlaylistCard) {
    setLoading(true)
    setError('')
    try {
      const res = await fetchPlaylistSongs(card.id)
      setSongs(res.list)
      setTitle(card.name)
    } catch {
      setError('playlist')
    } finally {
      setLoading(false)
    }
  }

  if (songs) {
    return (
      <Style>
      <div className="panel">
        <button type="button" className="back-row" onClick={() => setSongs(null)}>
          ← {title}
        </button>
        <SongList list={songs} onPlay={onPlay} />
      </div></Style>
    )
  }

  return (
    <Style>
    <div className="panel">
      {error && <p className="state-msg">{t.errors[error]}</p>}
      {loading && !cards.length && <p className="state-msg">{t.loading}</p>}
      <div className="card-grid">
        {cards.map((card) => (
          <button key={String(card.id)} type="button" className="cover-card" onClick={() => void openPlaylist(card)}>
            <span className="cover-card__img" style={{ backgroundImage: card.img ? `url(${card.img})` : undefined }} />
            <span className="cover-card__name">{card.name}</span>
          </button>
        ))}
      </div>
    </div></Style>
  )
}

export function ChartsPanel({ onPlay }: { onPlay: (list: Song[], index: number) => void }) {
  const { t } = useMusicCopy()
  const [groups, setGroups] = useState<ChartGroup[]>([])
  const [songs, setSongs] = useState<Song[] | null>(null)
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<'' | 'charts' | 'chart'>('')

  useEffect(() => {
    void fetchCharts()
      .then((res) => setGroups(res.list))
      .catch(() => setError('charts'))
      .finally(() => setLoading(false))
  }, [])

  async function openChart(id: string | number, name: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetchChartSongs(id)
      setSongs(res.list)
      setTitle(name)
    } catch {
      setError('chart')
    } finally {
      setLoading(false)
    }
  }

  if (songs) {
    return (
      <Style>
      <div className="panel">
        <button type="button" className="back-row" onClick={() => setSongs(null)}>
          ← {title}
        </button>
        <SongList list={songs} onPlay={onPlay} />
      </div></Style>
    )
  }

  return (
    <Style>
    <div className="panel">
      {error && <p className="state-msg">{t.errors[error]}</p>}
      {loading && !groups.length && <p className="state-msg">{t.loading}</p>}
      {groups.map((group, gi) => (
        <section key={group.disname || group.name || gi} className="chart-group">
          <h3>{group.disname || group.name}</h3>
          <div className="card-grid card-grid--charts">
            {(group.child || []).map((item) => (
              <button
                key={String(item.sourceid)}
                type="button"
                className="cover-card"
                onClick={() => void openChart(item.sourceid!, item.name || t.chartFallback)}
              >
                <span
                  className="cover-card__img"
                  style={{ backgroundImage: item.pic5 || item.pic2 ? `url(${item.pic5 || item.pic2})` : undefined }}
                />
                <span className="cover-card__name">{item.name}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div></Style>
  )
}

export function TagsPanel({ onPlay }: { onPlay: (list: Song[], index: number) => void }) {
  const { t } = useMusicCopy()
  const [groups, setGroups] = useState<TagGroup[]>([])
  const [playlists, setPlaylists] = useState<PlaylistCard[] | null>(null)
  const [songs, setSongs] = useState<Song[] | null>(null)
  const [crumb, setCrumb] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<'' | 'tags' | 'tagList' | 'playlist'>('')

  useEffect(() => {
    void fetchTags()
      .then((res) => setGroups(res.list))
      .catch(() => setError('tags'))
      .finally(() => setLoading(false))
  }, [])

  async function openTag(id: string | number, name: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetchTagPlaylists(id)
      setPlaylists(res.list)
      setCrumb(name)
      setSongs(null)
    } catch {
      setError('tagList')
    } finally {
      setLoading(false)
    }
  }

  async function openPlaylist(card: PlaylistCard) {
    setLoading(true)
    setError('')
    try {
      const res = await fetchPlaylistSongs(card.id)
      setSongs(res.list)
      setCrumb(card.name)
    } catch {
      setError('playlist')
    } finally {
      setLoading(false)
    }
  }

  if (songs) {
    return (
      <Style>
      <div className="panel">
        <button type="button" className="back-row" onClick={() => setSongs(null)}>
          ← {crumb}
        </button>
        <SongList list={songs} onPlay={onPlay} />
      </div></Style>
    )
  }

  if (playlists) {
    return (
      <Style>
      <div className="panel">
        <button type="button" className="back-row" onClick={() => setPlaylists(null)}>
          ← {crumb}
        </button>
        <div className="card-grid">
          {playlists.map((card) => (
            <button key={String(card.id)} type="button" className="cover-card" onClick={() => void openPlaylist(card)}>
              <span className="cover-card__img" style={{ backgroundImage: card.img ? `url(${card.img})` : undefined }} />
              <span className="cover-card__name">{card.name}</span>
            </button>
          ))}
        </div>
      </div></Style>
    )
  }

  return (
    <Style>
    <div className="panel">
      {error && <p className="state-msg">{t.errors[error]}</p>}
      {loading && !groups.length && <p className="state-msg">{t.loading}</p>}
      {groups.map((group) => (
        <section key={group.name} className="tag-group">
          <h3>{group.name}</h3>
          <div className="tag-chips">
            {(group.data || []).map((tag) =>
              tag.id ? (
                <button
                  key={String(tag.id)}
                  type="button"
                  className="tag-chip"
                  onClick={() => void openTag(tag.id!, tag.name || '')}
                >
                  {tag.name}
                </button>
              ) : null,
            )}
          </div>
        </section>
      ))}
    </div></Style>
  )
}

function SongList({ list, onPlay }: { list: Song[]; onPlay: (list: Song[], index: number) => void }) {
  const { t } = useMusicCopy()
  if (!list.length) {
    return (
      <Style>
        <p className="state-msg">{t.empty}</p>
      </Style>
    )
  }
  return (
    <Style>
    <ul className="song-list">
      {list.map((song, i) => (
        <li key={`${song.id}-${i}`}>
          <button type="button" className="song-row" onClick={() => onPlay(list, i)}>
            <span
              className="song-row__cover"
              style={{ backgroundImage: song.cover ? `url(${song.cover})` : undefined }}
            />
            <span className="song-row__meta">
              <span className="song-row__title">{song.title}</span>
              <span className="song-row__artist">{song.artist}</span>
            </span>
            <span className="song-row__play" aria-hidden>
              ▶
            </span>
          </button>
        </li>
      ))}
    </ul></Style>
  )
}

export function PlayerDock({
  player,
  onOpenFull,
  onOpenQueue,
}: {
  player: PlayerApi
  onOpenFull: () => void
  onOpenQueue: () => void
}) {
  const { current, playing, loading, currentTime, duration, error, toggle, next, prev, seek } = player
  const { t } = useMusicCopy()
  if (!current) return null

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <Style>
    <div className="player-dock">
      {error && <p className="player-dock__error">{t.errors[error]}</p>}
      <div className="player-dock__progress">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          aria-label={t.progress}
          onChange={(e) => seek(Number(e.target.value))}
          style={{ '--p': `${progress}%` } as CSSProperties}
        />
      </div>
      <div className="player-dock__main">
        <button type="button" className="player-dock__info" onClick={onOpenFull}>
          <span
            className={`player-dock__cover ${playing ? 'is-spinning' : ''}`}
            style={{ backgroundImage: current.cover ? `url(${current.cover})` : undefined }}
          />
          <span className="player-dock__text">
            <span className="player-dock__title">{current.title}</span>
            <span className="player-dock__artist">{current.artist}</span>
          </span>
        </button>
        <div className="player-dock__controls">
          <button type="button" aria-label={t.prev} onClick={prev}>
            ‹
          </button>
          <button type="button" className="is-primary" aria-label={playing ? t.pause : t.play} onClick={toggle}>
            {loading ? '…' : playing ? '❚❚' : '▶'}
          </button>
          <button type="button" aria-label={t.next} onClick={next}>
            ›
          </button>
          <button type="button" aria-label={t.queue} onClick={onOpenQueue}>
            ≡
          </button>
        </div>
      </div>
    </div></Style>
  )
}

export function FullPlayer({ player, onClose }: { player: PlayerApi; onClose: () => void }) {
  const { t } = useMusicCopy()
  const { current, playing, loading, currentTime, duration, mode, toggle, next, prev, seek, toggleMode } = player
  const [lines, setLines] = useState<LyricLine[]>([])
  const [lyricErr, setLyricErr] = useState(false)
  const activeRef = useRef<HTMLLIElement | null>(null)

  useEffect(() => {
    if (!current?.id) return
    setLines([])
    setLyricErr(false)
    void fetchLyric(current.id)
      .then((res) => setLines(res.lines))
      .catch(() => setLyricErr(true))
  }, [current?.id])

  const activeIndex = (() => {
    if (!lines.length) return -1
    let idx = 0
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= currentTime + 0.15) idx = i
      else break
    }
    return idx
  })()

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeIndex])

  if (!current) return null
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <Style>
    <div className="full-player" role="dialog" aria-label={t.nowPlaying}>
      <div className="full-player__bg" style={{ backgroundImage: current.cover ? `url(${current.cover})` : undefined }} />
      <div className="full-player__shade" />
      <header className="full-player__top">
        <button type="button" onClick={onClose} aria-label={t.collapse}>
          ↓
        </button>
        <div>
          <p className="full-player__title">{current.title}</p>
          <p className="full-player__artist">{current.artist}</p>
        </div>
        <button type="button" onClick={toggleMode} aria-label={t.mode}>
          {mode === 'list' ? t.modeList : t.modeSingle}
        </button>
      </header>

      <div className="full-player__art-wrap">
        <div
          className={`full-player__art ${playing ? 'is-spinning' : ''}`}
          style={{ backgroundImage: current.cover ? `url(${current.cover})` : undefined }}
        />
      </div>

      <div className="full-player__lyrics">
        {lyricErr && <p className="state-msg">{t.noLyric}</p>}
        <ul>
          {lines.map((line, i) => (
            <li key={`${line.time}-${i}`} ref={i === activeIndex ? activeRef : null} className={i === activeIndex ? 'is-active' : ''}>
              {line.text}
            </li>
          ))}
        </ul>
      </div>

      <div className="full-player__bottom">
        <div className="full-player__times">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={(e) => seek(Number(e.target.value))}
            style={{ '--p': `${progress}%` } as CSSProperties}
          />
          <span>{formatTime(duration)}</span>
        </div>
        <div className="full-player__controls">
          <button type="button" onClick={prev} aria-label={t.prev}>
            ‹‹
          </button>
          <button type="button" className="is-primary" onClick={toggle} aria-label={playing ? t.pause : t.play}>
            {loading ? '…' : playing ? '❚❚' : '▶'}
          </button>
          <button type="button" onClick={next} aria-label={t.next}>
            ››
          </button>
        </div>
      </div>
    </div></Style>
  )
}

export function QueueSheet({
  player,
  onClose,
}: {
  player: PlayerApi
  onClose: () => void
}) {
  const { queue, index, playAt } = player
  const { t } = useMusicCopy()
  return (
    <Style>
    <div className="sheet" role="dialog" aria-label={t.queue}>
      <button type="button" className="sheet__backdrop" aria-label={t.close} onClick={onClose} />
      <div className="sheet__panel">
        <header>
          <h3>{t.queueTitle.replace('{n}', String(queue.length))}</h3>
          <button type="button" onClick={onClose}>
            {t.close}
          </button>
        </header>
        <ul>
          {queue.map((song, i) => (
            <li key={`${song.id}-${i}`}>
              <button type="button" className={i === index ? 'is-active' : ''} onClick={() => void playAt(i)}>
                <span>{song.title}</span>
                <span>{song.artist}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div></Style>
  )
}

export type { Tab }

const Style = styled.div`
@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes sheet-up {
  from {
    transform: translateY(24px);
    opacity: 0.6;
  }
  to {
    transform: none;
    opacity: 1;
  }
}

& {

  --bg: #f5f6fb;
  --bg-elev: #ffffff;
  --ink: #0f172a;
  --text-soft: #475569;
  --muted: #94a3b8;
  --line: rgba(15, 23, 42, 0.08);
  --purple: #7c5cfc;
  --purple-soft: #a78bfa;
  --accent: var(--purple);
  --accent-ink: #ffffff;
  --accent-soft: rgba(124, 92, 252, 0.1);
  --danger: #e11d48;
  --shade: color-mix(in srgb, var(--bg) 78%, transparent);
  --dock: color-mix(in srgb, var(--bg-elev) 86%, transparent);
  --sheet: var(--bg-elev);
  --lyric: rgba(15, 23, 42, 0.42);
  --name: var(--ink);
  --blob-a: #c4b5fd;
  --blob-b: #93c5fd;
  --blob-c: #a5f3fc;
  --cover: linear-gradient(145deg, #ddd6fe, #bfdbfe 55%, #a5f3fc);
  --player-shade: linear-gradient(180deg, rgba(245, 246, 251, 0.55), rgba(245, 246, 251, 0.94));
  --track: rgba(15, 23, 42, 0.1);
  --shadow: 0 10px 30px rgba(99, 102, 241, 0.08);
  --shadow-soft: 0 4px 18px rgba(15, 23, 42, 0.05);
  --grad: linear-gradient(90deg, #6366f1, #8b5cf6 45%, #06b6d4);
  --grad-btn: linear-gradient(90deg, #3b82f6, #06b6d4);
  --radius: 16px;
  color-scheme: light;
}

html[data-theme='dark'] &  {
  --bg: #0b1020;
  --bg-elev: #141a2e;
  --ink: #e8eaf2;
  --text-soft: #a0a8c0;
  --muted: #6b7390;
  --line: rgba(255, 255, 255, 0.08);
  --purple: #a78bfa;
  --purple-soft: #c4b5fd;
  --accent-soft: rgba(167, 139, 250, 0.16);
  --danger: #fb7185;
  --lyric: rgba(232, 234, 242, 0.42);
  --blob-a: #4c1d95;
  --blob-b: #1e3a8a;
  --blob-c: #155e75;
  --cover: linear-gradient(145deg, rgba(76, 29, 149, 0.85), rgba(30, 58, 138, 0.7) 55%, rgba(21, 94, 117, 0.65));
  --player-shade: linear-gradient(180deg, rgba(11, 16, 32, 0.62), rgba(11, 16, 32, 0.94));
  --track: rgba(255, 255, 255, 0.12);
  --shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  --shadow-soft: 0 4px 18px rgba(0, 0, 0, 0.25);
  color-scheme: dark;
}

&::before,
&::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

&::before {
  background-image:
    linear-gradient(var(--line) 1px, transparent 1px),
    linear-gradient(90deg, var(--line) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 80% 70% at 50% 18%, #000 20%, transparent 75%);
  opacity: 0.7;
}

&::after {
  background:
    radial-gradient(420px 420px at 92% -6%, var(--blob-a), transparent 68%),
    radial-gradient(360px 360px at -6% 24%, var(--blob-b), transparent 70%),
    radial-gradient(300px 300px at 72% 96%, var(--blob-c), transparent 68%);
  opacity: 0.45;
  filter: blur(40px);
}

html[data-theme='dark'] & ::after {
  opacity: 0.35;
}

.music-tabs button.is-active {
  color: var(--purple);
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--purple) 28%, transparent);
  font-weight: 600;
}

.panel {
  display: grid;
  gap: 14px;
  animation: fade-up 0.35s ease both;
}

.search-form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}

.search-form input,
.search-form button,
.more-btn,
.back-row,
.tag-chip,
.player-dock__controls button,
.full-player__top button,
.full-player__controls button,
.sheet__panel header button {
  font: inherit;
}

.search-form input {
  border: 1px solid var(--line);
  background: var(--bg-elev);
  color: var(--ink);
  border-radius: 999px;
  padding: 12px 16px;
  outline: none;
  box-shadow: var(--shadow-soft);
}

.search-form input::placeholder {
  color: var(--muted);
}

.search-form input:focus {
  border-color: color-mix(in srgb, var(--purple) 55%, transparent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.search-form button,
.more-btn {
  border: 0;
  border-radius: 999px;
  background: var(--grad-btn);
  color: #fff;
  padding: 0 1.15rem;
  cursor: pointer;
  font-weight: 600;
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.28);
}

.more-btn {
  justify-self: center;
  padding: 0.55rem 1.15rem;
  background: transparent;
  color: var(--purple);
  border: 1px solid color-mix(in srgb, var(--purple) 45%, transparent);
  box-shadow: none;
}

.more-btn:hover {
  border-color: var(--purple-soft);
}

.back-row:hover {
  color: var(--purple-soft);
}

.back-row {
  justify-self: start;
  border: 0;
  background: transparent;
  color: var(--purple);
  padding: 0;
  cursor: pointer;
  font-size: 0.92rem;
  font-weight: 600;
}

.state-msg {
  margin: 8px 0;
  color: var(--muted);
  text-align: center;
  font-size: 14px;
}

.song-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}

.song-row {
  width: 100%;
  display: grid;
  grid-template-columns: 48px 1fr auto;
  gap: 12px;
  align-items: center;
  color: inherit;
  text-align: left;
  padding: 8px;
  border-radius: 16px;
  border: 1px solid var(--line);
  background: var(--bg-elev);
  box-shadow: var(--shadow-soft);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.song-row:hover,
.song-row:focus-visible {
  border-color: color-mix(in srgb, var(--purple) 28%, transparent);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.song-row__cover {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: var(--cover) center / cover no-repeat;
}

.song-row__meta {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.song-row__title,
.song-row__artist,
.cover-card__name,
.player-dock__title,
.player-dock__artist {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-row__title {
  font-size: 15px;
}

.song-row__artist {
  color: var(--text-soft);
  font-size: 12px;
}

.song-row__play {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--purple);
  font-size: 11px;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.cover-card {
  display: grid;
  gap: 8px;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0;
  text-align: left;
  cursor: pointer;
}

.cover-card__img {
  aspect-ratio: 1;
  border-radius: 16px;
  background: var(--cover) center / cover no-repeat;
  border: 1px solid var(--line);
  box-shadow: var(--shadow-soft);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}

.cover-card:hover .cover-card__img {
  transform: translateY(-3px);
  box-shadow: var(--shadow);
}

.cover-card__name {
  font-size: 13px;
  line-height: 1.35;
  color: var(--name);
}

.chart-group,
.tag-group {
  display: grid;
  gap: 10px;
  margin-top: 8px;
}

.chart-group h3,
.tag-group h3 {
  margin: 0;
  font-size: 0.85rem;
  letter-spacing: 0.04em;
  color: var(--purple-soft);
  font-weight: 600;
}

.tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-chip {
  border: 1px solid var(--line);
  background: var(--bg-elev);
  color: var(--ink);
  border-radius: 999px;
  padding: 8px 14px;
  cursor: pointer;
  font-size: 13px;
  box-shadow: var(--shadow-soft);
}

.tag-chip:hover {
  border-color: color-mix(in srgb, var(--purple) 40%, transparent);
  color: var(--purple);
  background: var(--accent-soft);
}

.player-dock {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  z-index: 40;
  background: var(--dock);
  border: 1px solid var(--line);
  border-radius: 16px;
  backdrop-filter: blur(18px);
  box-shadow: var(--shadow);
  padding: 4px 12px 10px;
}

.player-dock__error {
  margin: 6px 0 0;
  color: var(--danger);
  font-size: 12px;
  text-align: center;
}

.player-dock__progress input,
.full-player__times input {
  width: 100%;
  appearance: none;
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--accent) var(--p, 0%), var(--track) var(--p, 0%));
  outline: none;
  cursor: pointer;
}

.player-dock__progress input::-webkit-slider-thumb,
.full-player__times input::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
}

.player-dock__main {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
  padding-top: 6px;
}

.player-dock__info {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 10px;
  align-items: center;
  min-width: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  padding: 0;
  cursor: pointer;
}

.player-dock__cover,
.full-player__art {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--cover) center / cover no-repeat;
}

.player-dock__cover.is-spinning,
.full-player__art.is-spinning {
  animation: spin 12s linear infinite;
}

.player-dock__text {
  display: grid;
  min-width: 0;
}

.player-dock__title {
  font-size: 14px;
}

.player-dock__artist {
  color: var(--text-soft);
  font-size: 12px;
}

.player-dock__controls {
  display: flex;
  align-items: center;
  gap: 2px;
}

.player-dock__controls button,
.full-player__controls button,
.full-player__top button {
  border: 0;
  background: transparent;
  color: var(--ink);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 18px;
}

.player-dock__controls button.is-primary,
.full-player__controls button.is-primary {
  background: var(--grad-btn);
  color: #fff;
  width: 44px;
  height: 44px;
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.28);
}

.full-player {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  padding: 16px 18px calc(24px + env(safe-area-inset-bottom, 0px));
  color: var(--ink);
  animation: fade-up 0.28s ease both;
}

.full-player__bg {
  position: absolute;
  inset: -20px;
  background: center / cover no-repeat;
  filter: blur(28px) saturate(1.1);
  transform: scale(1.08);
  opacity: 0.45;
}

.full-player__shade {
  position: absolute;
  inset: 0;
  background: var(--player-shade);
}

.full-player__top,
.full-player__art-wrap,
.full-player__lyrics,
.full-player__bottom {
  position: relative;
  z-index: 1;
}

.full-player__top {
  display: grid;
  grid-template-columns: 44px 1fr 56px;
  gap: 10px;
  align-items: center;
}

.full-player__title {
  margin: 0;
  text-align: center;
  font-size: 16px;
  font-weight: 600;
}

.full-player__artist {
  margin: 2px 0 0;
  text-align: center;
  color: var(--text-soft);
  font-size: 13px;
}

.full-player__art-wrap {
  display: grid;
  place-items: center;
  padding: 18px 0 8px;
}

.full-player__art {
  width: min(56vw, 220px);
  height: min(56vw, 220px);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
}

.full-player__lyrics {
  overflow: auto;
  mask-image: linear-gradient(180deg, transparent, #000 12%, #000 88%, transparent);
  -webkit-mask-image: linear-gradient(180deg, transparent, #000 12%, #000 88%, transparent);
}

.full-player__lyrics ul {
  list-style: none;
  margin: 0;
  padding: 40px 8px;
  display: grid;
  gap: 16px;
  text-align: center;
}

.full-player__lyrics li {
  color: var(--lyric);
  font-size: 15px;
  line-height: 1.5;
  transition: color 0.2s ease, transform 0.2s ease;
}

.full-player__lyrics li.is-active {
  color: var(--purple);
  transform: scale(1.05);
  font-weight: 600;
}

.full-player__bottom {
  display: grid;
  gap: 14px;
  padding-top: 10px;
}

.full-player__times {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: var(--muted);
}

.full-player__controls {
  display: flex;
  justify-content: center;
  gap: 18px;
  align-items: center;
}

.full-player__controls .is-primary {
  width: 64px;
  height: 64px;
  font-size: 22px;
}

.sheet {
  position: fixed;
  inset: 0;
  z-index: 55;
}

.sheet__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(0, 0, 0, 0.5);
  cursor: pointer;
}

.sheet__panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: min(70svh, 520px);
  display: grid;
  grid-template-rows: auto 1fr;
  background: var(--sheet);
  border-radius: 18px 18px 0 0;
  border: 1px solid var(--line);
  border-bottom: 0;
  box-shadow: var(--shadow);
  animation: sheet-up 0.28s ease both;
}

.sheet__panel header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--line);
}

.sheet__panel h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
}

.sheet__panel header button {
  border: 0;
  background: transparent;
  color: var(--purple);
  cursor: pointer;
  font-weight: 600;
}

.sheet__panel ul {
  list-style: none;
  margin: 0;
  padding: 8px 0 calc(16px + env(safe-area-inset-bottom, 0px));
  overflow: auto;
}

.sheet__panel li button {
  width: 100%;
  display: grid;
  gap: 2px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  padding: 12px 16px;
  cursor: pointer;
  font: inherit;
}

.sheet__panel li button span:last-child {
  color: var(--muted);
  font-size: 12px;
}

.sheet__panel li button.is-active {
  color: var(--purple);
  background: var(--accent-soft);
}

@media (min-width: 768px) {
.card-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

.card-grid--charts {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

.player-dock {
    left: 50%;
    right: auto;
    width: min(720px, calc(100% - 48px));
    transform: translateX(-50%);
    bottom: 18px;
    border: 1px solid var(--line);
    border-radius: 18px;
    padding-bottom: 12px;
    box-shadow: var(--shadow);
  }

& {
    padding-bottom: 120px;
  }

.full-player {
    padding: 28px 48px 36px;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    grid-template-rows: auto 1fr auto;
  }

.full-player__top {
    grid-column: 1 / -1;
  }

.full-player__art-wrap {
    align-content: center;
  }

.full-player__lyrics {
    grid-row: 2;
    grid-column: 2;
  }

.full-player__bottom {
    grid-column: 1 / -1;
    width: min(520px, 100%);
    justify-self: center;
  }

.full-player__art {
    width: 280px;
    height: 280px;
  }
}

@media (prefers-reduced-motion: reduce) {
.panel,
.full-player,
.sheet__panel,
.player-dock__cover.is-spinning,
.full-player__art.is-spinning,
.cover-card__img {
    animation: none !important;
    transition: none !important;
  }
}
`
