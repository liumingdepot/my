import { useLayoutEffect, useState } from 'react'
import { Link } from 'react-router'
import { LangToggle } from '../../LangToggle'
import { LangProvider } from '../../lang'
import { ThemeToggle } from '../../ThemeToggle'
import { themeColor, useTheme } from '../../theme'
import { CategoryPanel, FavPanel, SearchPanel, ShortPanel } from './panels'
import { VideoDetail } from './Player'
import type { Tab, VodItem } from './types'
import { useVideoCopy } from './i18n'
import './video.css'

const TAB_IDS: Tab[] = ['search', 'category', 'short', 'fav']

function VideoPageInner() {
  const { theme, toggleTheme } = useTheme()
  const { lang, toggleLang, t } = useVideoCopy()
  const [tab, setTab] = useState<Tab>('search')
  const [current, setCurrent] = useState<VodItem | null>(null)
  const [searchSeed, setSearchSeed] = useState<string | undefined>()

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = t.docTitle
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor(theme))
  }, [theme, t.docTitle])

  const actions = (
    <>
      <LangToggle lang={lang} onClick={toggleLang} />
      <ThemeToggle onClick={toggleTheme} aria-label={t.theme} />
    </>
  )

  function openItem(item: VodItem) {
    if (!item.playSources?.length) {
      setSearchSeed(item.vod_name)
      setTab('search')
      setCurrent(null)
      return
    }
    setCurrent(item)
  }

  if (current) {
    return (
      <div className="vod">
        <VideoDetail
          item={current}
          actions={actions}
          onClose={() => setCurrent(null)}
          onOpenRelated={(name) => {
            setCurrent(null)
            setSearchSeed(name)
            setTab('search')
          }}
        />
      </div>
    )
  }

  return (
    <div className="vod">
      <header className="vod-top">
        <div className="vod-brand">
          <div className="vod-brand__head">
            <Link className="vod-back-link" to="/">
              {t.back}
            </Link>
            <div className="vod-brand__tools">{actions}</div>
          </div>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
        <nav className="vod-tabs" aria-label={t.tabsLabel}>
          {TAB_IDS.map((id) => (
            <button key={id} type="button" className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>
              {t.tabs[id]}
            </button>
          ))}
        </nav>
      </header>

      <main className="vod-main">
        {tab === 'search' && (
          <SearchPanel initialQuery={searchSeed} onOpen={openItem} onConsumedQuery={() => setSearchSeed(undefined)} />
        )}
        {tab === 'category' && <CategoryPanel onOpen={openItem} />}
        {tab === 'short' && <ShortPanel onOpen={openItem} />}
        {tab === 'fav' && <FavPanel onOpen={openItem} />}
      </main>
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
