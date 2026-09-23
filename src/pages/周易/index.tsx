import { useLayoutEffect, useState } from 'react'
import { useLocation } from 'react-router'
import Home from './components/首页'
import OnlineLots from './components/在线抽签'
import Casual from './components/算一卦'
import BaziDetail from './components/八字精批'
import HehunMatch from './components/合婚配对'
import LiunianFortune from './components/流年运势'
import FortuneNav, { TABS, type TabId } from './model/FortuneNav'
import { t } from './utils/i18n'
import styled from 'styled-components'

function readTab(state: unknown): TabId {
  if (!state || typeof state !== 'object') return 'home'
  const tab = (state as { tab?: string }).tab
  return TABS.some((item) => item.id === tab) ? (tab as TabId) : 'home'
}

export default function ZhouyiPage() {
  const location = useLocation()
  const [tab, setTab] = useState<TabId>(() => readTab(location.state))

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = t.docTitle
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0c0f12')

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

  useLayoutEffect(() => {
    const next = readTab(location.state)
    setTab(next)
  }, [location.state])

  function switchTab(next: TabId) {
    setTab(next)
    window.scrollTo(0, 0)
  }

  return (
    <Style>
      <div className="zhouyi" data-theme={tab}>
        <FortuneNav activeTab={tab} onSelectTab={switchTab} />
        {tab === 'home' ? <Home onConsult={() => switchTab('lots')} /> : null}
        {tab === 'lots' ? <OnlineLots /> : null}
        {tab === 'casual' ? <Casual /> : null}
        {tab === 'bazi' ? <BaziDetail /> : null}
        {tab === 'hehun' ? <HehunMatch /> : null}
        {tab === 'liunian' ? <LiunianFortune /> : null}
      </div>
    </Style>
  )
}

const Style = styled.div`
  --fortune-nav-height: calc(56px + env(safe-area-inset-top));

  .zhouyi {
    /* 墨夜 · 首页默认 · 青绿 */
    --zy-bg0: #0c0f12;
    --zy-bg1: #161a1f;
    --zy-glow: rgba(45, 212, 191, 0.1);
    --zy-glow-2: rgba(148, 163, 184, 0.05);
    --zy-accent: #5eead4;
    --zy-accent-strong: #2dd4bf;
    --zy-primary: #14b8a6;
    --zy-primary-hover: #2dd4bf;
    --zy-border: #2a3038;
    --zy-border-hover: #2dd4bf;
    --zy-text: #d5d9df;
    --zy-text-soft: #f1f3f5;
    --zy-muted: #8b939e;
    --zy-dot: rgba(255, 255, 255, 0.035);
    --zy-ornament: rgba(45, 212, 191, 0.18);
    --zy-error: #f87171;
    --zy-shadow: 0 1px 2px rgba(0, 0, 0, 0.35), 0 12px 32px rgba(0, 0, 0, 0.45);
    --zy-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC',
      'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
    --zy-serif: ui-serif, 'Songti SC', 'STSong', 'Noto Serif SC', 'SimSun', serif;

    box-sizing: border-box;
    min-height: 100svh;
    padding-top: var(--fortune-nav-height);
    background: var(--zy-bg0);
    color: var(--zy-text);
    font-family: var(--zy-font);
    overflow-x: hidden;
    transition: background 0.35s ease;
    color-scheme: dark;
  }

  .zhouyi[data-theme='lots'] {
    /* 琥珀 · 在线抽签 */
    --zy-glow: rgba(251, 191, 36, 0.1);
    --zy-glow-2: rgba(148, 163, 184, 0.05);
    --zy-accent: #fcd34d;
    --zy-accent-strong: #fbbf24;
    --zy-primary: #d97706;
    --zy-primary-hover: #fbbf24;
    --zy-border-hover: #fbbf24;
    --zy-ornament: rgba(251, 191, 36, 0.18);
  }

  .zhouyi[data-theme='casual'] {
    /* 松烟 · 算一卦 */
    --zy-glow: rgba(96, 165, 250, 0.1);
    --zy-glow-2: rgba(148, 163, 184, 0.05);
    --zy-accent: #93c5fd;
    --zy-accent-strong: #60a5fa;
    --zy-primary: #3b82f6;
    --zy-primary-hover: #60a5fa;
    --zy-border-hover: #60a5fa;
    --zy-ornament: rgba(96, 165, 250, 0.18);
  }

  .zhouyi[data-theme='bazi'] {
    /* 朱砂 · 八字精批 */
    --zy-glow: rgba(248, 113, 113, 0.1);
    --zy-glow-2: rgba(148, 163, 184, 0.05);
    --zy-accent: #fca5a5;
    --zy-accent-strong: #f87171;
    --zy-primary: #ef4444;
    --zy-primary-hover: #f87171;
    --zy-border-hover: #f87171;
    --zy-ornament: rgba(248, 113, 113, 0.16);
  }

  .zhouyi[data-theme='hehun'] {
    /* 绛紫 · 合婚配对 */
    --zy-glow: rgba(167, 139, 250, 0.1);
    --zy-glow-2: rgba(148, 163, 184, 0.05);
    --zy-accent: #c4b5fd;
    --zy-accent-strong: #a78bfa;
    --zy-primary: #8b5cf6;
    --zy-primary-hover: #a78bfa;
    --zy-border-hover: #a78bfa;
    --zy-ornament: rgba(167, 139, 250, 0.16);
  }

  .zhouyi[data-theme='liunian'] {
    /* 黛蓝 · 流年运势 */
    --zy-glow: rgba(56, 189, 248, 0.1);
    --zy-glow-2: rgba(148, 163, 184, 0.05);
    --zy-accent: #7dd3fc;
    --zy-accent-strong: #38bdf8;
    --zy-primary: #0ea5e9;
    --zy-primary-hover: #38bdf8;
    --zy-border-hover: #38bdf8;
    --zy-ornament: rgba(56, 189, 248, 0.18);
  }
`
