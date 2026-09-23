import { Link, useNavigate } from 'react-router'
import { useEffect, useState, type FormEvent } from 'react'
import styled from 'styled-components'
import { ThemeToggle } from '../utils/ThemeToggle'
import { NAV_LINKS } from '../utils/categories'
import type { ThemeMode } from '../utils/theme'
import type { NavKey } from '../utils/types'

type Props = {
  active: NavKey
  theme: ThemeMode
  onToggleTheme: () => void
}

export default function Header({ active, onToggleTheme }: Props) {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const q = keyword.trim()
    if (!q) {
      navigate('/music/search')
      return
    }
    navigate(`/music/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <Bar data-scrolled={scrolled ? '1' : '0'}>
      <div className="inner">
        <Link to="/" className="brand" aria-label="返回首页">
          <span className="brand-mark">铭</span>
          <span className="brand-text">铭音乐</span>
        </Link>

        <nav className="nav">
          {NAV_LINKS.map((item) => (
            <Link key={item.key} to={item.path} className={active === item.key ? 'is-active' : ''}>
              {item.label}
            </Link>
          ))}
        </nav>

        <form className="search" onSubmit={onSearch} role="search">
          <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M16.5 16.5L21 21"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索歌曲、歌手…"
            aria-label="搜索关键词"
          />
          <button type="submit" className="go">
            搜索
          </button>
        </form>

        <ThemeToggle className="theme-toggle" onClick={onToggleTheme} aria-label="切换深浅色" />
      </div>
    </Bar>
  )
}

const Bar = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  height: 64px;
  transition:
    background 0.3s ease,
    border-color 0.3s ease,
    box-shadow 0.3s ease;

  background: color-mix(in srgb, var(--bg) 78%, transparent);
  backdrop-filter: blur(16px) saturate(1.3);
  -webkit-backdrop-filter: blur(16px) saturate(1.3);
  border-bottom: 1px solid transparent;

  &[data-scrolled='1'] {
    border-bottom-color: var(--line);
    box-shadow: var(--shadow-soft);
    background: color-mix(in srgb, var(--bg) 88%, transparent);
  }

  .inner {
    width: min(90vw, 1400px);
    max-width: 1400px;
    margin: 0 auto;
    padding: 0;
    height: 64px;
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;

    &:hover {
      opacity: 0.9;
    }
  }

  .brand-mark {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 9px;
    background: var(--grad-btn);
    color: #fff;
    font-family: ui-serif, "Songti SC", "STSong", "SimSun", serif;
    font-weight: 700;
    font-size: 17px;
    box-shadow: 0 4px 14px rgba(59, 130, 246, 0.28);
  }

  .brand-text {
    font-family: ui-serif, "Songti SC", "STSong", "SimSun", serif;
    font-size: 21px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--ink);
  }

  .nav {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;

    &::-webkit-scrollbar {
      display: none;
    }

    a {
      position: relative;
      flex-shrink: 0;
      padding: 8px 14px;
      color: var(--text-soft);
      text-decoration: none;
      font-size: 14px;
      letter-spacing: 0.04em;
      transition: color 0.2s;
      -webkit-tap-highlight-color: transparent;

      &::after {
        content: '';
        position: absolute;
        left: 14px;
        right: 14px;
        bottom: 2px;
        height: 2px;
        border-radius: 1px;
        background: var(--grad);
        transform: scaleX(0);
        transform-origin: center;
        transition: transform 0.22s ease;
      }

      &:hover {
        color: var(--ink);
      }

      &.is-active {
        color: var(--ink);
        font-weight: 700;

        &::after {
          transform: scaleX(1);
        }
      }
    }
  }

  .search {
    position: relative;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    height: 38px;
    padding: 0 3px 0 36px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--bg-elev);
    margin: 0;
    box-sizing: border-box;
    box-shadow: var(--shadow-soft);
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
    -webkit-tap-highlight-color: transparent;

    &:hover,
    &:focus-within {
      border-color: color-mix(in srgb, var(--purple) 45%, transparent);
      box-shadow: 0 0 0 3px var(--accent-soft);
    }

    .icon {
      position: absolute;
      left: 12px;
      width: 16px;
      height: 16px;
      color: var(--muted);
      pointer-events: none;
    }

    input {
      width: 148px;
      flex: 1;
      min-width: 0;
      height: 100%;
      padding: 0 8px 0 0;
      border: 0;
      background: transparent;
      color: var(--ink);
      font-size: 13px;
      outline: 0;

      &::placeholder {
        color: var(--muted);
      }
    }

    .go {
      flex-shrink: 0;
      display: grid;
      place-items: center;
      height: calc(100% - 6px);
      margin-left: 8px;
      padding: 0 14px;
      border: 0;
      border-radius: 999px;
      background: var(--grad-btn);
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
      cursor: pointer;
      transition: opacity 0.2s;

      &:hover {
        opacity: 0.92;
      }
    }
  }

  .theme-toggle {
    flex-shrink: 0;
  }

  @media (max-width: 900px) {
    height: 96px;

    .inner {
      width: min(90vw, calc(100vw - 24px));
      height: 96px;
      flex-wrap: wrap;
      align-content: center;
      gap: 6px 10px;
      padding: 8px 0 6px;
    }

    .brand {
      order: 1;
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

    .search {
      order: 2;
      flex: 1;
      min-width: 0;
      height: 36px;

      input {
        width: auto;
      }
    }

    .theme-toggle {
      order: 3;
    }

    .nav {
      order: 4;
      flex: none;
      width: 100%;
      height: 36px;

      a {
        padding: 8px 12px;
        font-size: 13px;

        &::after {
          left: 12px;
          right: 12px;
          bottom: 0;
        }
      }
    }
  }

  @media (max-width: 420px) {
    .brand-text {
      display: none;
    }

    .search .go {
      padding: 0 10px;
      font-size: 11px;
    }
  }
`
