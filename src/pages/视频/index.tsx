import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { LangToggle } from '../../LangToggle'
import { LangProvider } from '../../lang'
import { ThemeToggle } from '../../ThemeToggle'
import { themeColor, useTheme } from '../../theme'
import { LivePanel } from './LivePanel'
import { LivePlayer } from './LivePlayer'
import { CategoryPanel, FavPanel, SearchPanel, ShortPanel } from './panels'
import { VideoDetail } from './Player'
import type { LiveChannel, Mode, Tab, VodItem } from './types'
import { useVideoCopy } from './i18n'
import './video.css'

const TAB_IDS: Tab[] = ['search', 'category', 'short', 'fav']
const MODE_IDS: Mode[] = ['vod', 'live']

function VideoPageInner() {
  const { theme, toggleTheme } = useTheme()
  const { lang, toggleLang, t } = useVideoCopy()
  const [mode, setMode] = useState<Mode>('vod')
  const [tab, setTab] = useState<Tab>('search')
  const [current, setCurrent] = useState<VodItem | null>(null)
  const [liveNow, setLiveNow] = useState<{ channel: LiveChannel; channels: LiveChannel[] } | null>(null)
  const [searchSeed, setSearchSeed] = useState<string | undefined>()
  const browseScrollRef = useRef(0)

  const inDetail = !!(current || liveNow)

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = t.docTitle
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor(theme))
  }, [theme, t.docTitle])

  useLayoutEffect(() => {
    if (inDetail) return
    window.scrollTo(0, browseScrollRef.current)
  }, [inDetail])

  const actions = (
    <>
      <LangToggle lang={lang} onClick={toggleLang} />
      <ThemeToggle onClick={toggleTheme} aria-label={t.theme} />
    </>
  )

  function rememberBrowseScroll() {
    browseScrollRef.current = window.scrollY
    window.scrollTo(0, 0)
  }

  function openItem(item: VodItem) {
    if (!item.playSources?.length) {
      setMode('vod')
      setSearchSeed(item.vod_name)
      setTab('search')
      setCurrent(null)
      return
    }
    rememberBrowseScroll()
    setCurrent(item)
  }

  function closeVodDetail() {
    setCurrent(null)
  }

  function closeLivePlayer() {
    setLiveNow(null)
  }

  return (
    <div className={`vod ${mode === 'live' || liveNow ? 'is-live' : ''}`}>
      <div className="vod-browse" hidden={inDetail} aria-hidden={inDetail}>
        <header className="vod-top">
          <div className="vod-brand">
            <div className="vod-brand__head">
              <Link className="vod-back-link" to="/">
                {t.back}
              </Link>
              <div className="vod-brand__tools">{actions}</div>
            </div>
            <nav className="vod-modes" aria-label={t.modesLabel}>
              {MODE_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={mode === id ? 'is-active' : ''}
                  onClick={() => setMode(id)}
                >
                  {t.modes[id]}
                </button>
              ))}
            </nav>
            <p>{mode === 'live' ? t.liveSubtitle : t.subtitle}</p>
          </div>
          {mode === 'vod' && (
            <nav className="vod-tabs" aria-label={t.tabsLabel}>
              {TAB_IDS.map((id) => (
                <button key={id} type="button" className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>
                  {t.tabs[id]}
                </button>
              ))}
            </nav>
          )}
        </header>

        <main className="vod-main">
          {mode === 'live' ? (
            <LivePanel
              onOpen={(channel, channels) => {
                rememberBrowseScroll()
                setMode('live')
                setLiveNow({ channel, channels })
              }}
            />
          ) : (
            <>
              {tab === 'search' && (
                <SearchPanel
                  initialQuery={searchSeed}
                  onOpen={openItem}
                  onConsumedQuery={() => setSearchSeed(undefined)}
                />
              )}
              {tab === 'category' && <CategoryPanel onOpen={openItem} />}
              {tab === 'short' && <ShortPanel onOpen={openItem} />}
              {tab === 'fav' && <FavPanel onOpen={openItem} />}
            </>
          )}
        </main>
      </div>

      {liveNow && (
        <LivePlayer
          channel={liveNow.channel}
          channels={liveNow.channels}
          actions={actions}
          onClose={closeLivePlayer}
          onSelect={(channel) => setLiveNow((prev) => (prev ? { ...prev, channel } : prev))}
        />
      )}

      {current && (
        <VideoDetail
          item={current}
          actions={actions}
          onClose={closeVodDetail}
          onOpenRelated={(name) => {
            setCurrent(null)
            setMode('vod')
            setSearchSeed(name)
            setTab('search')
          }}
        />
      )}
    </div>
  )
}

export default function VideoPage() {
  return (
    <LangProvider>
      <VideoPageInner />
    </LangProvider>
  )
}
