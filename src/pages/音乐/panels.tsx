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
} from './api'
import { useMusicCopy } from './i18n'
import type { ChartGroup, LyricLine, PlaylistCard, Song, TagGroup } from './types'
import { formatTime, usePlayer, type PlayError } from './usePlayer'

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
    </div>
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
      <div className="panel">
        <button type="button" className="back-row" onClick={() => setSongs(null)}>
          ← {title}
        </button>
        <SongList list={songs} onPlay={onPlay} />
      </div>
    )
  }

  return (
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
    </div>
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
      <div className="panel">
        <button type="button" className="back-row" onClick={() => setSongs(null)}>
          ← {title}
        </button>
        <SongList list={songs} onPlay={onPlay} />
      </div>
    )
  }

  return (
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
    </div>
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
      <div className="panel">
        <button type="button" className="back-row" onClick={() => setSongs(null)}>
          ← {crumb}
        </button>
        <SongList list={songs} onPlay={onPlay} />
      </div>
    )
  }

  if (playlists) {
    return (
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
      </div>
    )
  }

  return (
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
    </div>
  )
}

function SongList({ list, onPlay }: { list: Song[]; onPlay: (list: Song[], index: number) => void }) {
  const { t } = useMusicCopy()
  if (!list.length) return <p className="state-msg">{t.empty}</p>
  return (
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
    </ul>
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
    </div>
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
    </div>
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
    </div>
  )
}

export type { Tab }
