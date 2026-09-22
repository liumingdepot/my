import { useLayoutEffect, useState } from 'react'
import Home from './components/首页'
import Casual from './components/随便算算'
import BaziDetail from './components/八字精批'
import { t } from './utils/i18n'
import styled from 'styled-components'

const TABS = [
  { id: 'home', label: t.navHome },
  { id: 'casual', label: t.navCasual },
  { id: 'bazi', label: t.navBazi },
] as const

type TabId = (typeof TABS)[number]['id']

export default function SuanmingPage() {
  const [tab, setTab] = useState<TabId>('home')

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = t.docTitle
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0b0a09')

    const root = document.documentElement
    const previousBehavior = root.style.scrollBehavior
    const previousRestoration = history.scrollRestoration
    root.style.scrollBehavior = 'auto'
    history.scrollRestoration = 'manual'
    if (window.location.hash) {
      history.replaceState(history.state, '', window.location.pathname + window.location.search)
    }
    window.scrollTo(0, 0)
    root.style.scrollBehavior = previousBehavior
    return () => {
      history.scrollRestoration = previousRestoration
    }
  }, [])

  function switchTab(next: TabId) {
    setTab(next)
    window.scrollTo(0, 0)
  }

  return (
    <Style>
      <div className="suanming">
        <nav className="nav" role="tablist" aria-label={t.navLabel}>
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={tab === item.id ? 'is-active' : undefined}
              onClick={() => switchTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        {tab === 'home' ? <Home onConsult={() => switchTab('casual')} /> : null}
        {tab === 'casual' ? <Casual /> : null}
        {tab === 'bazi' ? <BaziDetail /> : null}
      </div>
    </Style>
  )
}

const Style = styled.div`
  --fortune-nav-height: calc(64px + env(safe-area-inset-top));

  .suanming {
    min-height: 100svh;
    background: #0b0a09;
  }

  .nav {
    position: sticky;
    top: 0;
    z-index: 4;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    box-sizing: border-box;
    height: var(--fortune-nav-height);
    padding: env(safe-area-inset-top) max(16px, env(safe-area-inset-right)) 0 max(16px, env(safe-area-inset-left));
    background: rgba(11, 10, 9, 0.88);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(214, 186, 138, 0.18);
  }

  .nav button {
    min-height: 36px;
    padding: 0 14px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: rgba(232, 220, 198, 0.55);
    font: 15px/1 'Songti SC', 'Noto Serif SC', serif;
    letter-spacing: 0.22em;
    cursor: pointer;
  }

  .nav button.is-active {
    background: rgba(196, 148, 72, 0.16);
    color: #f6edd8;
  }

  @media (max-width: 900px) {
    .nav {
      gap: 4px;
    }

    .nav button {
      padding: 0 10px;
      font-size: 14px;
      letter-spacing: 0.12em;
    }
  }
`
