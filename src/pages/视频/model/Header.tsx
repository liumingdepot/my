import { Link, useNavigate } from 'react-router'
import { useEffect, useState, type FormEvent } from 'react'
import styled from 'styled-components'
import { NAV_LINKS } from '../utils/categories'
import type { NavKey } from '../utils/types'

type Props = {
  active: NavKey
  hideSearch?: boolean
}

export default function Header({ active, hideSearch }: Props) {
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
      navigate('/video/search')
      return
    }
    navigate(`/video/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <Bar data-scrolled={scrolled ? '1' : '0'}>
      <div className="inner">
        <div className="top">
          <Link to="/video" className="brand">
            <span className="brand-mark">铭</span>
            <span className="brand-text">铭影视</span>
          </Link>

          {hideSearch ? null : (
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
                placeholder="搜索影片、演员…"
                aria-label="搜索关键词"
              />
              <button type="submit" className="go">
                搜索
              </button>
            </form>
          )}

          <Link to="/works" className="works-back">
            返回作品集
          </Link>
        </div>

        <nav className="nav">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.key}
              to={item.path}
              className={active === item.key ? 'is-active' : ''}
            >
              {item.label}
            </Link>
          ))}
        </nav>
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
    background 0.35s ease,
    border-color 0.35s ease,
    box-shadow 0.35s ease,
    backdrop-filter 0.35s ease;

  background: linear-gradient(
    180deg,
    rgba(10, 10, 12, 0.28) 0%,
    rgba(10, 10, 12, 0.12) 100%
  );
  backdrop-filter: blur(14px) saturate(1.35);
  -webkit-backdrop-filter: blur(14px) saturate(1.35);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);

  &[data-scrolled='1'] {
    background: rgba(10, 10, 12, 0.55);
    border-bottom-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.28);
    backdrop-filter: blur(22px) saturate(1.45);
    -webkit-backdrop-filter: blur(22px) saturate(1.45);
  }

  .inner {
    max-width: 90vw;
    margin: 0 auto;
    padding: 0 28px;
    height: 64px;
    display: flex;
    align-items: center;
    gap: 28px;
  }

  .top {
    display: contents;
  }

  .back {
    flex-shrink: 0;
    order: 1;
    margin-right: -12px;
    padding: 6px 8px;
    color: rgba(245, 242, 234, 0.55);
    text-decoration: none;
    font-size: 13px;
    letter-spacing: 0.02em;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
    transition: color 0.2s;

    &:hover {
      color: #e8a54b;
    }
  }

  .works-back {
    flex-shrink: 0;
    order: 4;
    display: inline-flex;
    align-items: center;
    min-height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(245, 242, 234, 0.78);
    text-decoration: none;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
    transition:
      color 0.2s,
      border-color 0.2s,
      background 0.2s;

    &:hover {
      color: #f5f2ea;
      border-color: rgba(232, 165, 75, 0.45);
      background: rgba(232, 165, 75, 0.12);
    }
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    flex-shrink: 0;
    order: 1;
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
    font-family: ui-serif, "Songti SC", "STSong", "SimSun", serif;
    font-weight: 700;
    font-size: 17px;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.18) inset,
      0 4px 14px rgba(232, 165, 75, 0.28);
  }

  .brand-text {
    font-family: ui-serif, "Songti SC", "STSong", "SimSun", serif;
    font-size: 21px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #f5f2ea;
    text-shadow: 0 1px 12px rgba(0, 0, 0, 0.35);
  }

  .nav {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
    order: 2;
    -webkit-overflow-scrolling: touch;

    &::-webkit-scrollbar {
      display: none;
    }

    a {
      position: relative;
      flex-shrink: 0;
      padding: 8px 14px;
      color: rgba(245, 242, 234, 0.68);
      text-decoration: none;
      font-size: 14px;
      letter-spacing: 0.04em;
      transition: color 0.2s;
      text-shadow: 0 1px 8px rgba(0, 0, 0, 0.25);
      -webkit-tap-highlight-color: transparent;

      &::after {
        content: '';
        position: absolute;
        left: 14px;
        right: 14px;
        bottom: 2px;
        height: 2px;
        border-radius: 1px;
        background: #e8a54b;
        transform: scaleX(0);
        transform-origin: center;
        transition: transform 0.22s ease;
      }

      &:hover {
        color: #f5f2ea;
      }

      &.is-active {
        color: #f5f2ea;
        font-weight: 600;

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
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    margin: 0;
    box-sizing: border-box;
    transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
    order: 3;
    -webkit-tap-highlight-color: transparent;

    &:hover,
    &:focus-within {
      border-color: rgba(232, 165, 75, 0.55);
      background: rgba(255, 255, 255, 0.12);
      box-shadow: 0 0 0 3px rgba(232, 165, 75, 0.12);
    }

    .icon {
      position: absolute;
      left: 12px;
      width: 16px;
      height: 16px;
      color: rgba(245, 242, 234, 0.45);
      pointer-events: none;
    }

    input {
      width: 168px;
      flex: 1;
      min-width: 0;
      height: 100%;
      padding: 0 8px 0 0;
      border: 0;
      background: transparent;
      color: #f5f2ea;
      font-size: 13px;
      outline: 0;

      &::placeholder {
        color: rgba(245, 242, 234, 0.38);
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
      background: linear-gradient(145deg, #f0b85c, #e8a54b);
      color: #0a0a0c;
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

  /* 平板 / 手机：品牌+搜索一行，导航单独一行横向滑动 */
  @media (max-width: 900px) {
    height: 96px;

    .inner {
      max-width: 100%;
      height: 96px;
      flex-direction: column;
      align-items: stretch;
      justify-content: center;
      gap: 6px;
      padding: 8px 12px 6px;
    }

    .top {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .back {
      order: 0;
      margin-right: -6px;
      padding: 6px 4px;
      font-size: 12px;
    }

    .brand {
      order: 0;
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
      order: 0;
      flex: 1;
      min-width: 0;
      height: 36px;
      padding-left: 34px;

      input {
        width: auto;
        font-size: 13px;
      }

      .go {
        padding: 0 12px;
      }
    }

    .nav {
      order: 0;
      flex: none;
      width: 100%;
      height: 36px;
      gap: 0;

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

    .search {
      padding-left: 32px;

      .go {
        padding: 0 10px;
        font-size: 11px;
      }
    }
  }
`
