import { Link, useNavigate } from 'react-router'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import styled from 'styled-components'
import { CATEGORY_LINKS, type NavKey } from '../utils/categories'

type Props = {
  active: NavKey
  hideSearch?: boolean
  overlay?: boolean
}

export default function Header({ active, hideSearch, overlay }: Props) {
  const navigate = useNavigate()
  const catWrapRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [catOpen, setCatOpen] = useState(false)

  const isCatActive = active !== 'home'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setCatOpen(false)
  }, [active])

  useEffect(() => {
    if (!catOpen) return
    const onPointer = (e: PointerEvent) => {
      if (!catWrapRef.current?.contains(e.target as Node)) setCatOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCatOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [catOpen])

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const q = keyword.trim()
    if (!q) {
      navigate('/short/search')
      return
    }
    navigate(`/short/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <Bar data-scrolled={scrolled || overlay ? '1' : '0'} data-overlay={overlay ? '1' : '0'}>
      <div className="inner">
        <div className="top">
          <Link to="/short" className="brand">
            <span className="brand-mark">剧</span>
            <span className="brand-text">铭短剧</span>
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
                placeholder="搜索短剧名称…"
                aria-label="搜索短剧"
              />
              <button type="submit" className="go">
                搜索
              </button>
            </form>
          )}

          <Link to="/works" className="works-back" aria-label="返回作品集">
            <span className="full">返回作品集</span>
            <span className="short">作品集</span>
          </Link>
        </div>

        <nav className="nav">
          <Link to="/short" className={active === 'home' ? 'is-active' : ''} onClick={() => setCatOpen(false)}>
            首页
          </Link>
          <div className="cat-wrap" ref={catWrapRef}>
            <button
              type="button"
              className={`cat-btn${isCatActive ? ' is-active' : ''}${catOpen ? ' is-open' : ''}`}
              aria-expanded={catOpen}
              aria-haspopup="listbox"
              onClick={() => setCatOpen((o) => !o)}
            >
              分类
              <span className="chev" aria-hidden="true" />
            </button>
            {catOpen ? (
              <div className="cat-panel" role="listbox" aria-label="短剧分类">
                {CATEGORY_LINKS.map((item) => (
                  <Link
                    key={item.key}
                    to={item.path}
                    role="option"
                    aria-selected={active === item.key}
                    className={active === item.key ? 'is-active' : ''}
                    onClick={() => setCatOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
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

  &[data-overlay='1'] {
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0.15) 100%);
    border-bottom-color: transparent;
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  .inner {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 20px;
    height: 64px;
    display: flex;
    align-items: center;
    gap: 28px;
  }

  .top {
    display: contents;
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
    color: rgba(232, 245, 238, 0.78);
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

    .short {
      display: none;
    }

    &:hover {
      color: #e8f5ee;
      border-color: rgba(62, 186, 122, 0.45);
      background: rgba(62, 186, 122, 0.12);
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
    background: linear-gradient(145deg, #4fd18a 0%, #3eba7a 45%, #2f9d5f 100%);
    color: #04120a;
    font-family: ui-serif, 'Songti SC', 'STSong', 'SimSun', serif;
    font-weight: 700;
    font-size: 17px;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.18) inset,
      0 4px 14px rgba(62, 186, 122, 0.28);
  }

  .brand-text {
    font-family: ui-serif, 'Songti SC', 'STSong', 'SimSun', serif;
    font-size: 21px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #e8f5ee;
    text-shadow: 0 1px 12px rgba(0, 0, 0, 0.35);
  }

  .nav {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 0;
    order: 2;

    > a,
    .cat-btn {
      position: relative;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 8px 14px;
      color: rgba(232, 245, 238, 0.68);
      text-decoration: none;
      font: inherit;
      font-size: 14px;
      letter-spacing: 0.04em;
      background: transparent;
      border: 0;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      text-shadow: 0 1px 8px rgba(0, 0, 0, 0.25);
      transition: color 0.2s;

      &::after {
        content: '';
        position: absolute;
        left: 14px;
        right: 14px;
        bottom: 2px;
        height: 2px;
        border-radius: 1px;
        background: #3eba7a;
        transform: scaleX(0);
        transform-origin: center;
        transition: transform 0.22s ease;
      }

      &:hover {
        color: #e8f5ee;
      }

      &.is-active {
        color: #e8f5ee;
        font-weight: 600;

        &::after {
          transform: scaleX(1);
        }
      }
    }

    .cat-wrap {
      position: relative;
      flex-shrink: 0;
    }

    .cat-btn .chev {
      display: inline-block;
      width: 0;
      height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-top: 5px solid currentColor;
      opacity: 0.7;
      transition: transform 0.2s ease;
    }

    .cat-btn.is-open .chev {
      transform: rotate(180deg);
    }

    .cat-panel {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      z-index: 60;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
      width: min(520px, 72vw);
      max-height: min(62vh, 420px);
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding: 12px;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(10, 18, 14, 0.96);
      backdrop-filter: blur(16px) saturate(1.3);
      -webkit-backdrop-filter: blur(16px) saturate(1.3);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);

      a {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 38px;
        padding: 0 10px;
        border-radius: 8px;
        color: rgba(232, 245, 238, 0.78);
        text-decoration: none;
        font-size: 13px;
        -webkit-tap-highlight-color: transparent;
        transition:
          color 0.15s,
          background 0.15s;

        &:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #e8f5ee;
        }

        &.is-active {
          color: #04120a;
          background: linear-gradient(145deg, #4fd18a, #2f9d5f);
          font-weight: 700;
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
    transition:
      border-color 0.2s,
      background 0.2s,
      box-shadow 0.2s;
    order: 3;
    -webkit-tap-highlight-color: transparent;

    &:hover,
    &:focus-within {
      border-color: rgba(62, 186, 122, 0.55);
      background: rgba(255, 255, 255, 0.12);
      box-shadow: 0 0 0 3px rgba(62, 186, 122, 0.12);
    }

    .icon {
      position: absolute;
      left: 12px;
      width: 16px;
      height: 16px;
      color: rgba(232, 245, 238, 0.45);
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
      color: #e8f5ee;
      font-size: 13px;
      outline: 0;

      &::placeholder {
        color: rgba(232, 245, 238, 0.38);
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
      background: linear-gradient(145deg, #4fd18a, #3eba7a);
      color: #04120a;
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

  /* PC 首页 feed：仍显示搜索，顶栏单行 */
  &[data-overlay='1'] {
    .search {
      display: flex;
    }
  }

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
      gap: 4px;

      > a,
      .cat-btn {
        padding: 8px 14px;
        font-size: 13px;

        &::after {
          left: 14px;
          right: 14px;
          bottom: 0;
        }
      }

      .cat-panel {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        width: min(92vw, 320px);
        max-height: min(58vh, 360px);
        padding: 10px;
        border-radius: 12px;
        gap: 4px;

        a {
          min-height: 36px;
          padding: 0 8px;
        }
      }
    }

    .works-back {
      order: 0;
      min-height: 32px;
      padding: 0 10px;
      font-size: 11px;

      .full {
        display: none;
      }

      .short {
        display: inline;
      }
    }

    &[data-overlay='1'] {
      height: 52px;

      .inner {
        height: 52px;
        flex-direction: row;
        align-items: center;
        gap: 10px;
        padding: 0 12px;
      }

      .top {
        display: contents;
      }

      .nav {
        flex: 1;
        width: auto;
        height: auto;
        min-width: 0;
      }

      /* 移动端 feed 仍隐藏搜索，避免挤占 */
      .search {
        display: none;
      }

      .works-back {
        order: 3;
      }

      .cat-panel {
        left: auto;
        right: 0;
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

    .works-back {
      padding: 0 8px;
    }
  }
`
