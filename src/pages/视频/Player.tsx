import { useEffect, useRef, useState, type ReactNode } from 'react'
import Hls from 'hls.js'
import { streamUrl } from './api'
import { useVideoCopy } from './i18n'
import type { VodItem } from './types'
import { getProgress, isFavorite, setProgress, toggleFavorite } from './storage'

type Props = {
  item: VodItem
  onClose: () => void
  onOpenRelated?: (name: string) => void
  actions?: ReactNode
}

export function VideoDetail({ item, onClose, onOpenRelated, actions }: Props) {
  const { t } = useVideoCopy()
  const sources = item.playSources || []
  const saved = getProgress(item.vod_id, item.source)
  const [sourceIndex, setSourceIndex] = useState(saved?.sourceIndex ?? 0)
  const [episodeIndex, setEpisodeIndex] = useState(saved?.episodeIndex ?? 0)
  const [fav, setFav] = useState(() => isFavorite(item))
  const [error, setError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)

  const currentSource = sources[sourceIndex] || sources[0]
  const currentEp = currentSource?.episodes[episodeIndex] || currentSource?.episodes[0]
  const isSeries = item.type_name.includes('剧') || (currentSource?.episodes.length ?? 0) > 8

  useEffect(() => {
    const video = videoRef.current
    if (!video || !currentEp?.url) return

    setError('')
    hlsRef.current?.destroy()
    hlsRef.current = null

    const playUrl = streamUrl(currentEp.url)
    const isHls = currentEp.url.includes('.m3u8') || playUrl.includes('m3u8')

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false })
      hlsRef.current = hls
      hls.loadSource(playUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setError('fail')
      })
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playUrl
    } else {
      video.src = currentEp.url.includes('.mp4') ? currentEp.url : playUrl
    }

    setProgress({
      source: item.source,
      vod_id: item.vod_id,
      sourceIndex,
      episodeIndex,
    })

    void video.play().catch(() => {})

    return () => {
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
  }, [currentEp?.url, episodeIndex, sourceIndex, item.source, item.vod_id])

  function onFav() {
    setFav(toggleFavorite(item))
  }

  function pickSource(i: number) {
    setSourceIndex(i)
    setEpisodeIndex(0)
  }

  function pickEpisode(i: number) {
    setEpisodeIndex(i)
  }

  return (
    <div className="vod-detail">
      <div className="vod-detail__bar">
        <button type="button" className="vod-back" onClick={onClose}>
          {t.backDetail}
        </button>
        <h2>{item.vod_name}</h2>
        <button type="button" className={fav ? 'is-on' : ''} onClick={onFav}>
          {fav ? t.saved : t.save}
        </button>
        {actions}
      </div>

      <div className="vod-detail__layout">
        <div className="vod-player-wrap">
          <video ref={videoRef} className="vod-player" controls playsInline poster={item.vod_pic} />
          {error && <p className="vod-player-error">{t.playFail}</p>}
        </div>

        <aside className="vod-meta">
          <div className="vod-meta__head">
            {item.vod_pic ? (
              <img src={item.vod_pic} alt="" loading="lazy" referrerPolicy="no-referrer" />
            ) : null}
            <div>
              <h3>{item.vod_name}</h3>
              <p>
                {[item.source, item.type_name, item.vod_area, item.vod_year].filter(Boolean).join(' · ')}
              </p>
              {item.vod_remarks && <p className="vod-remarks">{item.vod_remarks}</p>}
            </div>
          </div>

          {(item.vod_director || item.vod_actor) && (
            <dl className="vod-meta__dl">
              {item.vod_director && (
                <>
                  <dt>{t.director}</dt>
                  <dd>{item.vod_director}</dd>
                </>
              )}
              {item.vod_actor && (
                <>
                  <dt>{t.cast}</dt>
                  <dd>{item.vod_actor}</dd>
                </>
              )}
            </dl>
          )}

          {item.vod_blurb && <p className="vod-blurb">{item.vod_blurb.replace(/<[^>]+>/g, '')}</p>}

          <div className="vod-section">
            <div className="vod-section__title">
              <span>{t.lines}</span>
              <em>{t.lineHint}</em>
            </div>
            <div className="vod-chips">
              {sources.map((s, i) => (
                <button
                  key={`${s.title}-${i}`}
                  type="button"
                  className={i === sourceIndex ? 'is-active' : ''}
                  onClick={() => pickSource(i)}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>

          <div className="vod-section">
            <div className="vod-section__title">
              <span>{t.episodes}</span>
              <em>
                {episodeIndex + 1}/{currentSource?.episodes.length || 0}
              </em>
            </div>
            <div className={`vod-eps ${isSeries ? 'is-grid' : ''}`}>
              {(currentSource?.episodes || []).map((ep, i) => (
                <button
                  key={`${ep.url}-${i}`}
                  type="button"
                  className={i === episodeIndex ? 'is-active' : ''}
                  onClick={() => pickEpisode(i)}
                >
                  {isSeries ? i + 1 : ep.title}
                </button>
              ))}
            </div>
          </div>

          {onOpenRelated && (
            <button type="button" className="vod-related" onClick={() => onOpenRelated(item.vod_name)}>
              {t.related}
            </button>
          )}
        </aside>
      </div>
    </div>
  )
}
