import { Link, useLocation } from 'react-router'
import styled from 'styled-components'
import { HOME_PATH, WORKS_PATH } from './works'

const NAV_LINKS = [
  { label: '首页', to: HOME_PATH },
  { label: '作品', to: WORKS_PATH },
  { label: '个人简历', to: '/home' },
  { label: '后台管理', to: '/admin' },
] as const

type Props = {
  /** 内容下滑后加深毛玻璃（参考视频页 Header） */
  scrolled?: boolean
}

/** 站点顶栏：首页隐藏，仅作品页置顶显示 */
export default function SiteHeader({ scrolled = false }: Props) {
  const { pathname } = useLocation()

  return (
    <Bar data-scrolled={scrolled ? '1' : '0'}>
      <div className="inner">
        <Link className="nav-brand" to={HOME_PATH} aria-label="首页">
          <span className="nav-mark">铭</span>
          <span className="nav-name">刘铭</span>
        </Link>
        <nav className="nav-links" aria-label="主导航">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              aria-current={pathname === link.to ? 'page' : undefined}
              className={pathname === link.to ? 'is-active' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </Bar>
  )
}

const Bar = styled.header`
  --accent: var(--accent, #7dd3c0);
  --text: var(--text, #e8eef8);
  --text-soft: var(--text-soft, rgba(232, 238, 248, 0.72));
  --line: var(--line, rgba(255, 255, 255, 0.14));
  --font: var(--font, 'Outfit', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif);
  --display: var(--display, 'Instrument Serif', 'Songti SC', 'STSong', serif);

  position: sticky;
  top: 0;
  z-index: 20;
  flex: 0 0 auto;
  font-family: var(--font);
  animation: nav-in 0.7s ease both;

  /* 半透明毛玻璃 */
  background: linear-gradient(
    180deg,
    rgba(10, 16, 28, 0.42) 0%,
    rgba(10, 16, 28, 0.16) 100%
  );
  backdrop-filter: blur(14px) saturate(1.35);
  -webkit-backdrop-filter: blur(14px) saturate(1.35);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  transition:
    background 0.35s ease,
    border-color 0.35s ease,
    box-shadow 0.35s ease,
    backdrop-filter 0.35s ease;

  /* 内容下滑后：更实的玻璃 + 投影 */
  &[data-scrolled='1'] {
    background: rgba(10, 16, 28, 0.66);
    border-bottom-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.28);
    backdrop-filter: blur(24px) saturate(1.5);
    -webkit-backdrop-filter: blur(24px) saturate(1.5);
  }

  .inner {
    box-sizing: border-box;
    width: min(92vw, 1120px);
    margin: 0 auto;
    /* 右侧留出固定域名切换按钮的位置 */
    padding: 18px 116px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .nav-brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: inherit;
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
    transition: opacity 0.2s;

    &:hover {
      opacity: 0.88;
    }
  }

  .nav-mark {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: color-mix(in srgb, var(--accent) 22%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
    color: #fff;
    font-family: var(--display);
    font-size: 18px;
    font-weight: 600;
  }

  .nav-name {
    font-family: var(--display);
    font-size: 22px;
    letter-spacing: 0.12em;
    color: var(--text);
    text-shadow: 0 1px 10px rgba(0, 0, 0, 0.35);
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 8px;

    a {
      position: relative;
      min-height: 36px;
      padding: 0 14px;
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      border: 1px solid transparent;
      color: var(--text-soft);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.04em;
      text-shadow: 0 1px 8px rgba(0, 0, 0, 0.25);
      transition:
        color 0.2s,
        border-color 0.2s,
        background 0.2s;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;

      &:hover {
        color: #fff;
        border-color: var(--line);
        background: rgba(255, 255, 255, 0.08);
      }

      &.is-active {
        color: #fff;
        border-color: color-mix(in srgb, var(--accent) 45%, transparent);
        background: color-mix(in srgb, var(--accent) 16%, transparent);
      }
    }
  }

  @keyframes nav-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (max-width: 760px) {
    .inner {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
    }

    .nav-links {
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;

      &::-webkit-scrollbar {
        display: none;
      }
    }
  }

  @media (max-width: 560px) {
    .inner {
      padding: 14px 62px 16px 0;
    }

    .nav-name {
      font-size: 18px;
    }

    .nav-links {
      gap: 4px;

      a {
        min-height: 32px;
        padding: 0 10px;
        font-size: 13px;
      }
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transition: none;
  }
`