import { useLayoutEffect, useState } from 'react'
import { Link } from 'react-router'
import { LangToggle } from './utils/LangToggle'
import { LangProvider } from './utils/lang'
import { ThemeToggle } from './utils/ThemeToggle'
import { themeColor, useTheme } from './utils/theme'
import {
  ChartsPanel,
  FullPlayer,
  PlayerDock,
  QueueSheet,
  RecommendPanel,
  SearchPanel,
  TagsPanel,
  type Tab,
} from './model/panels'
import { useMusicCopy } from './utils/i18n'
import type { Song } from './utils/types'
import { usePlayer } from './utils/usePlayer'
import styled, { createGlobalStyle } from 'styled-components'

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
    <Style>
      <GlobalStyle />
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
    </Style>
  )
}

export default function MusicPage() {
  return (
    <LangProvider>
      <MusicPageInner />
    </LangProvider>
  )
}

const GlobalStyle = createGlobalStyle`
html:has(.music) {
  color-scheme: light;
}

html[data-theme='dark']:has(.music) {
  color-scheme: dark;
}

body:has(.music) {
  margin: 0;
  background: #f5f6fb;
  color: #0f172a;
  font-family: Inter, 'Noto Sans SC', system-ui, sans-serif;
}

html[data-theme='dark'] body:has(.music) {
  background: #0b1020;
  color: #e8eaf2;
}
`

const Style = styled.div`
.music {
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
  position: relative;
  z-index: 0;
  color-scheme: light;
  min-height: 100svh;
  color: var(--ink);
  background: transparent;
  font-family: Inter, 'Noto Sans SC', system-ui, sans-serif;
  padding-bottom: calc(128px + env(safe-area-inset-bottom, 0px));
}

html[data-theme='dark'] & .music {
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

.music::before,
.music::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

.music::before {
  background-image:
    linear-gradient(var(--line) 1px, transparent 1px),
    linear-gradient(90deg, var(--line) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 80% 70% at 50% 18%, #000 20%, transparent 75%);
  opacity: 0.7;
}

.music::after {
  background:
    radial-gradient(420px 420px at 92% -6%, var(--blob-a), transparent 68%),
    radial-gradient(360px 360px at -6% 24%, var(--blob-b), transparent 70%),
    radial-gradient(300px 300px at 72% 96%, var(--blob-c), transparent 68%);
  opacity: 0.45;
  filter: blur(40px);
}

html[data-theme='dark'] & .music::after {
  opacity: 0.35;
}

.music-top {
  position: sticky;
  top: 0;
  z-index: 20;
  backdrop-filter: blur(16px);
  background: var(--shade);
  border-bottom: 1px solid transparent;
  padding: 14px 16px 0;
}

.music-brand,
.music-tabs {
  width: min(932px, 100%);
  margin-inline: auto;
}

.music-brand {
  display: grid;
  gap: 4px;
  margin-bottom: 14px;
}

.music-brand__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.music-brand__tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.music-back {
  width: fit-content;
  color: var(--text-soft);
  text-decoration: none;
  font-size: 0.86rem;
  font-weight: 500;
}

.music-back:hover {
  color: var(--purple);
}

.music-brand h1 {
  margin: 0;
  font-size: clamp(1.85rem, 4vw, 2.4rem);
  font-weight: 800;
  letter-spacing: -0.035em;
  line-height: 1.1;
  color: var(--ink);
}

.music-brand p {
  margin: 0;
  color: var(--purple-soft);
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.music-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 10px;
}

.music-tabs::-webkit-scrollbar {
  display: none;
}

.music-tabs button {
  flex: 0 0 auto;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-soft);
  padding: 0.4rem 0.85rem;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 500;
  cursor: pointer;
  border-radius: 999px;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}

.music-tabs button:hover {
  color: var(--purple);
}

.music-tabs button.is-active {
  color: var(--purple);
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--purple) 28%, transparent);
  font-weight: 600;
}

.music-main {
  width: min(960px, 100%);
  margin: 0 auto;
  padding: 16px 14px 24px;
}

.full-player__lyrics li.is-active {
  color: var(--purple);
  transform: scale(1.05);
  font-weight: 600;
}

.sheet__panel li button.is-active {
  color: var(--purple);
  background: var(--accent-soft);
}

@media (min-width: 768px) {
.music-top {
    padding: 18px 28px 0;
  }

.music-brand,
.music-tabs {
    width: min(904px, 100%);
  }

.music-main {
    padding: 22px 28px 32px;
  }

.music {
    padding-bottom: 120px;
  }
}
`
