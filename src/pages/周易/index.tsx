import { useLayoutEffect, useState } from 'react'
import { Link } from 'react-router'
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

export default function ZhouyiPage() {
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
      <div className="zhouyi">
        <header className="nav">
          <Link to="/" className="brand" aria-label={t.docTitle}>
            <span className="brand-mark">{t.titleA}</span>
            <span className="brand-text">{t.docTitle}</span>
          </Link>
          <nav className="tabs" role="tablist" aria-label={t.navLabel}>
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
        </header>
        {tab === 'home' ? <Home onConsult={() => switchTab('casual')} /> : null}
        {tab === 'casual' ? <Casual /> : null}
        {tab === 'bazi' ? <BaziDetail /> : null}
      </div>
    </Style>
  )
}

const Style = styled.div`
  --fortune-nav-height: calc(64px + env(safe-area-inset-top));

  .zhouyi {
    min-height: 100svh;
    background: #0b0a09;
    overflow-x: hidden;
  }

  .nav {
    position: sticky;
    top: 0;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 20px;
    box-sizing: border-box;
    height: var(--fortune-nav-height);
    padding: env(safe-area-inset-top) max(16px, env(safe-area-inset-right)) 0
      max(16px, env(safe-area-inset-left));
    background: rgba(11, 10, 9, 0.88);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(214, 186, 138, 0.18);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;

    &:hover {
      opacity: 0.88;
    }
  }

  .brand-mark {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 9px;
    background: linear-gradient(145deg, #f0b85c 0%, #e8a54b 45%, #c4782a 100%);
    color: #0a0a0c;
    font: 700 17px/1 ui-serif, 'Songti SC', 'STSong', 'SimSun', serif;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.18) inset,
      0 4px 14px rgba(232, 165, 75, 0.28);
  }

  .brand-text {
    font: 700 21px/1 ui-serif, 'Songti SC', 'STSong', 'SimSun', serif;
    letter-spacing: 0.1em;
    color: #f5f2ea;
    text-shadow: 0 1px 12px rgba(0, 0, 0, 0.35);
  }

  .tabs {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .tabs button {
    flex-shrink: 0;
    min-height: 36px;
    padding: 0 14px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: rgba(232, 220, 198, 0.55);
    font: 15px/1 ui-serif, 'Songti SC', 'STSong', 'SimSun', serif;
    letter-spacing: 0.22em;
    cursor: pointer;
  }

  .tabs button.is-active {
    background: rgba(196, 148, 72, 0.16);
    color: #f6edd8;
  }

  @media (max-width: 900px) {
    .nav {
      gap: 12px;
    }

    .brand-mark {
      width: 28px;
      height: 28px;
      font-size: 15px;
      border-radius: 8px;
    }

    .brand-text {
      font-size: 18px;
    }

    .tabs {
      gap: 4px;
    }

    .tabs button {
      padding: 0 10px;
      font-size: 14px;
      letter-spacing: 0.12em;
    }
  }

  @media (max-width: 520px) {
    .brand-text {
      display: none;
    }
  }
`
