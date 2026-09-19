import { useLayoutEffect, useState } from 'react'
import { Link } from 'react-router'
import { LangToggle } from '../../LangToggle'
import { LangProvider } from '../../lang'
import { ThemeToggle } from '../../ThemeToggle'
import { themeColor, useTheme } from '../../theme'
import { useMusicCopy } from './i18n'
import './music.css'
import {
  ChartsPanel,
  FullPlayer,
  PlayerDock,
  QueueSheet,
  RecommendPanel,
  SearchPanel,
  TagsPanel,
  type Tab,
} from './panels'
import type { Song } from './types'
import { usePlayer } from './usePlayer'

const TAB_IDS: Tab[] = ['search', 'recommend', 'charts', 'tags']

function MusicPageInner() {
  const player = usePlayer()
  const { theme, toggleTheme } = useTheme()
  const { lang, toggleLang, t } = useMusicCopy()
  const [tab, setTab] = useState<Tab>('search')
  const [full, setFull] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = t.docTitle
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor(theme))
  }, [theme, t.docTitle])

  function onPlay(list: Song[], index: number) {
    player.playQueue(list, index)
  }

  return (
    <div className="music">
      <header className="music-top">
        <div className="music-brand">
          <div className="music-brand__head">
            <Link className="music-back" to="/">
              {t.back}
            </Link>
            <div className="music-brand__tools">
              <LangToggle lang={lang} onClick={toggleLang} />
              <ThemeToggle onClick={toggleTheme} aria-label={t.theme} />
            </div>
          </div>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
        <nav className="music-tabs" aria-label={t.tabsLabel}>
          {TAB_IDS.map((id) => (
            <button key={id} type="button" className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>
              {t.tabs[id]}
            </button>
          ))}
        </nav>
      </header>

      <main className="music-main">
        {tab === 'search' && <SearchPanel onPlay={onPlay} />}
        {tab === 'recommend' && <RecommendPanel onPlay={onPlay} />}
        {tab === 'charts' && <ChartsPanel onPlay={onPlay} />}
        {tab === 'tags' && <TagsPanel onPlay={onPlay} />}
      </main>

      <PlayerDock player={player} onOpenFull={() => setFull(true)} onOpenQueue={() => setQueueOpen(true)} />

      {full && <FullPlayer player={player} onClose={() => setFull(false)} />}
      {queueOpen && <QueueSheet player={player} onClose={() => setQueueOpen(false)} />}
    </div>
  )
}

export default function MusicPage() {
  return (
    <LangProvider>
      <MusicPageInner />
    </LangProvider>
  )
}
