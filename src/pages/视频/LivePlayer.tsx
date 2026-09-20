import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Hls from 'hls.js'
import { streamUrl } from './api'
import { useVideoCopy } from './i18n'
import type { LiveChannel } from './types'
import './live.css'

type Props = {
  channel: LiveChannel
  channels: LiveChannel[]
  onClose: () => void
  onSelect: (channel: LiveChannel) => void
  actions?: ReactNode
}

function channelKey(c: LiveChannel) {
  return `${c.name}|${c.url}`
}

export function LivePlayer({ channel, channels, onClose, onSelect, actions }: Props) {
  const { t } = useVideoCopy()
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)

  const siblings = useMemo(() => {
    const same = channels.filter((c) => c.group === channel.group)
    return same.length > 1 ? same : channels.slice(0, 40)
  }, [channel.group, channels])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !channel.url) return

    setError(false)
    setLoading(true)
    hlsRef.current?.destroy()
    hlsRef.current = null

    const forcePlaylist = !channel.url.includes('.mp4')
    const playUrl = streamUrl(channel.url, {
      playlist: forcePlaylist && !channel.url.includes('.m3u8'),
    })
    const isHls =
      channel.url.includes('.m3u8') ||
      playUrl.includes('m3u8') ||
      (forcePlaylist && !channel.url.includes('.mp4'))

    const markReady = () => setLoading(false)

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
      })
      hlsRef.current = hls
      hls.loadSource(playUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, markReady)
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          setError(true)
          setLoading(false)
        }
      })
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playUrl
      video.addEventListener('loadedmetadata', markReady, { once: true })
    } else {
      video.src = channel.url.includes('.mp4') ? channel.url : playUrl
      video.addEventListener('loadedmetadata', markReady, { once: true })
    }

    void video.play().catch(() => {})

    return () => {
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
  }, [channel.url])

  return (
    <div className="live-player">
      <header className="live-player__bar">
        <button type="button" className="live-player__back" onClick={onClose}>
          {t.backDetail}
        </button>
        <div className="live-player__title">
          <span className="live-badge" aria-hidden>
            <i />
            LIVE
          </span>
          <div className="live-player__name">
            <strong>{channel.name}</strong>
            <em>{channel.group || t.liveTitle}</em>
          </div>
        </div>
        {actions}
      </header>

      <div className="live-player__stage">
        <div className="live-player__screen">
          <video ref={videoRef} className="live-player__video" controls playsInline autoPlay />
          {loading && !error && <p className="live-player__hint">{t.loading}</p>}
          {error && <p className="live-player__hint is-error">{t.livePlayFail}</p>}
        </div>

        <aside className="live-player__side">
          <div className="live-player__now">
            <span className="live-channel__logo">
              {channel.logo ? (
                <img src={channel.logo} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span className="live-channel__fallback">{channel.name.slice(0, 2)}</span>
              )}
            </span>
            <div>
              <strong>{channel.name}</strong>
              <p>{channel.group || t.liveTitle}</p>
            </div>
          </div>

          <p className="live-player__side-label">{t.liveSwitch}</p>
          <ul className="live-player__channels">
            {siblings.map((c) => {
              const active = channelKey(c) === channelKey(channel)
              return (
                <li key={channelKey(c)}>
                  <button
                    type="button"
                    className={`live-player__chip ${active ? 'is-active' : ''}`}
                    onClick={() => onSelect(c)}
                  >
                    <span className="live-channel__logo">
                      {c.logo ? (
                        <img src={c.logo} alt="" loading="lazy" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="live-channel__fallback">{c.name.slice(0, 2)}</span>
                      )}
                    </span>
                    <span>{c.name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>
      </div>
    </div>
  )
}
