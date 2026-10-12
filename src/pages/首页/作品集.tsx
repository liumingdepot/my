import { useEffect, useLayoutEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import styled from 'styled-components'
import DomainSelect from './DomainSelect'
import {
  fetchProjectWorks,
  filterWorksByCategory,
  HOME_PATH,
  PROJECTS_PATH,
  splitHighlights,
  splitStack,
  WORK_CATEGORIES,
  WORKS_PATH,
  type ProjectWork,
  type WorkCategory,
  type WorkItem,
} from './works'

type ListMode = 'works' | 'projects'

const PROJECT_CARD_TONES: WorkItem['tone'][] = [
  'violet',
  'rose',
  'ink',
  'emerald',
  'sky',
  'cyan',
  'amber',
]

const NAV_CACHE_KEY = 'works-nav'

type NavCache = {
  mode: ListMode
  category: WorkCategory
}

function isProjectsPath(pathname: string) {
  return pathname === PROJECTS_PATH || pathname.startsWith(`${PROJECTS_PATH}/`)
}

function isWorkCategory(value: unknown): value is WorkCategory {
  return WORK_CATEGORIES.some((item) => item.id === value)
}

function readNavCache(): NavCache | null {
  try {
    const raw = localStorage.getItem(NAV_CACHE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<NavCache>
    const mode = data.mode === 'projects' || data.mode === 'works' ? data.mode : null
    const category = isWorkCategory(data.category) ? data.category : null
    if (!mode || !category) return null
    return { mode, category }
  } catch {
    return null
  }
}

function writeNavCache(cache: NavCache) {
  try {
    localStorage.setItem(NAV_CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* ignore quota / private mode */
  }
}

function AdminIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function ProjectsModeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 7h16M4 12h10M4 17h14" strokeLinecap="round" />
      <circle cx="18" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** 作品集 / 项目经历：同页切换底部列表，不跳转新菜单 */
export default function WorksPage() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [mode, setMode] = useState<ListMode>(() => {
    if (isProjectsPath(pathname)) return 'projects'
    return readNavCache()?.mode ?? 'works'
  })
  const [category, setCategory] = useState<WorkCategory>(() => readNavCache()?.category ?? 'all')
  const [projects, setProjects] = useState<ProjectWork[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [projectsLoaded, setProjectsLoaded] = useState(false)
  const [detailProject, setDetailProject] = useState<ProjectWork | null>(null)
  const isProjects = mode === 'projects'
  const works = filterWorksByCategory(category)
  const overlayOpen = Boolean(detailProject)

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = isProjects ? '项目经历 · 刘铭' : '我的作品集 · 刘铭'
  }, [isProjects])

  /** 兼容旧链接 /projects：进入时切到项目经历列表 */
  useEffect(() => {
    if (isProjectsPath(pathname)) setMode('projects')
  }, [pathname])

  /** 记住顶栏分类 / 项目经历，刷新后保持 */
  useEffect(() => {
    writeNavCache({ mode, category })
  }, [mode, category])

  useEffect(() => {
    if (!isProjects || projectsLoaded) return
    let cancelled = false
    setProjectsLoading(true)
    fetchProjectWorks().then((list) => {
      if (!cancelled) {
        setProjects(list)
        setProjectsLoading(false)
        setProjectsLoaded(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [isProjects, projectsLoaded])

  useEffect(() => {
    if (!overlayOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetailProject(null)
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [overlayOpen])

  const showWorks = (next?: WorkCategory) => {
    if (next) setCategory(next)
    setMode('works')
    if (isProjectsPath(pathname)) navigate(WORKS_PATH, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const showProjects = () => {
    setMode('projects')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <Style>
      <header className="top">
        <div className="inner">
          <Link
            to={WORKS_PATH}
            className="brand"
            aria-label="我的作品集"
            onClick={(e) => {
              e.preventDefault()
              showWorks('all')
            }}
          >
            <span className="brand-mark">铭</span>
            <span className="brand-text">我的作品集</span>
          </Link>

          <div className="nav-filter">
            <div className={`cats${isProjects ? ' is-dimmed' : ''}`} role="tablist" aria-label="作品分类">
              {WORK_CATEGORIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={!isProjects && category === item.id}
                  className={`cat${!isProjects && category === item.id ? ' is-active' : ''}`}
                  onClick={() => showWorks(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={`mode-switch${isProjects ? ' is-active' : ''}`}
              aria-pressed={isProjects}
              aria-label="项目经历"
              onClick={showProjects}
            >
              <ProjectsModeIcon />
              <span>项目经历</span>
            </button>
          </div>

          <nav className="nav-actions" aria-label="页面操作">
            <Link to={HOME_PATH} className="nav-link">
              返回首页
            </Link>
            <Link to="/home" className="nav-link">
              个人简历
            </Link>
            <DomainSelect inline tone="light" />
            <Link to="/admin" className="admin-entry" title="后台管理" aria-label="后台管理">
              <AdminIcon />
            </Link>
          </nav>
        </div>
      </header>

      <main className="main">
        <div className="list-meta">
          <p className="list-total" aria-live="polite">
            <span className="list-total__label">{isProjects ? '项目' : '作品'}</span>
            <span className="list-total__count">
              {isProjects ? (projectsLoading ? '—' : projects.length) : works.length}
            </span>
          </p>
        </div>
        {isProjects ? (
          projectsLoading ? (
            <p className="project-empty">加载中…</p>
          ) : projects.length === 0 ? (
            <p className="project-empty">暂无项目，可在后台「作品管理」中添加</p>
          ) : (
            <ul className="works-grid">
              {projects.map((project, index) => {
                const tone = PROJECT_CARD_TONES[index % PROJECT_CARD_TONES.length]
                const glyph = Array.from(project.title.trim())[0] || '项'
                const tag = project.badge || project.role || project.period || '项目'
                const platform = project.platform || 'PC'
                const desc =
                  project.description ||
                  [project.role, project.company].filter(Boolean).join(' · ') ||
                  '项目经历'
                const cardClass = `work-card work-card--${tone}${project.featured ? ' is-featured' : ''}`
                return (
                  <li key={project.id}>
                    <button
                      type="button"
                      className={cardClass}
                      onClick={() => setDetailProject(project)}
                    >
                      <div className="work-card__top">
                        <span className="work-card__index">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="work-card__meta">
                          <span className="work-card__platform">{platform}</span>
                          <span className="work-card__tag">{tag}</span>
                        </div>
                      </div>
                      <h3 className="work-card__name">{project.title}</h3>
                      <p className="work-card__desc">{desc}</p>
                      <span className="work-card__go">
                        详情
                        <span className="work-card__arrow" aria-hidden="true">
                          →
                        </span>
                      </span>
                      <span className="work-card__mark" aria-hidden="true">
                        {glyph}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )
        ) : (
          <ul className="works-grid">
            {works.map((work, index) => (
              <li key={work.href}>
                <Link className={`work-card work-card--${work.tone}`} to={work.href}>
                  <div className="work-card__top">
                    <span className="work-card__index">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="work-card__meta">
                      <span className="work-card__platform">{work.platform}</span>
                      <span className="work-card__tag">{work.tag}</span>
                    </div>
                  </div>
                  <h3 className="work-card__name">{work.name}</h3>
                  <p className="work-card__desc">{work.desc}</p>
                  <span className="work-card__go">
                    打开
                    <span className="work-card__arrow" aria-hidden="true">
                      →
                    </span>
                  </span>
                  <span className="work-card__mark" aria-hidden="true">
                    {work.glyph}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      {detailProject ? (
        <div
          className="project-detail-mask"
          role="presentation"
          onClick={() => setDetailProject(null)}
        >
          <div
            className="project-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="project-detail__close"
              aria-label="关闭"
              onClick={() => setDetailProject(null)}
            >
              ×
            </button>
            <p className="project-detail__notice">保密项目，不可预览，仅展示设计图、项目简介</p>
            <h2 id="project-detail-title" className="project-detail__title">
              {detailProject.title}
            </h2>
            <dl className="project-detail__fields">
              {detailProject.badge ? (
                <>
                  <dt>标签</dt>
                  <dd>{detailProject.badge}</dd>
                </>
              ) : null}
              {detailProject.role ? (
                <>
                  <dt>角色</dt>
                  <dd>{detailProject.role}</dd>
                </>
              ) : null}
              {detailProject.company ? (
                <>
                  <dt>公司</dt>
                  <dd>{detailProject.company}</dd>
                </>
              ) : null}
              {detailProject.period ? (
                <>
                  <dt>周期</dt>
                  <dd>{detailProject.period}</dd>
                </>
              ) : null}
              {detailProject.platform ? (
                <>
                  <dt>平台</dt>
                  <dd>{detailProject.platform}</dd>
                </>
              ) : null}
              {detailProject.featured ? (
                <>
                  <dt>精选</dt>
                  <dd>是</dd>
                </>
              ) : null}
              {detailProject.description ? (
                <>
                  <dt>简介</dt>
                  <dd className="project-detail__block">{detailProject.description}</dd>
                </>
              ) : null}
              {splitStack(detailProject.stack).length > 0 ? (
                <>
                  <dt>技术栈</dt>
                  <dd>
                    <ul className="project-detail__tags">
                      {splitStack(detailProject.stack).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </dd>
                </>
              ) : null}
              {splitHighlights(detailProject.highlights).length > 0 ? (
                <>
                  <dt>亮点</dt>
                  <dd>
                    <ul className="project-detail__list">
                      {splitHighlights(detailProject.highlights).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </dd>
                </>
              ) : null}
              {detailProject.link ? (
                <>
                  <dt>链接</dt>
                  <dd className="project-detail__muted">已隐藏（保密项目不可预览）</dd>
                </>
              ) : null}
            </dl>
          </div>
        </div>
      ) : null}
    </Style>
  )
}

const Style = styled.div`
  --bg: #f5f6fb;
  --bg-elevated: #ffffff;
  --text: #0f172a;
  --text-soft: #475569;
  --muted: #94a3b8;
  --line: rgba(15, 23, 42, 0.08);
  --purple: #7c5cfc;
  --purple-soft: #a78bfa;
  --grad-btn: linear-gradient(90deg, #3b82f6, #06b6d4);
  --shadow: 0 10px 30px rgba(99, 102, 241, 0.08);
  --shadow-soft: 0 4px 18px rgba(15, 23, 42, 0.05);
  --radius: 16px;
  --radius-pill: 999px;
  --nav-h: 64px;
  --font: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', sans-serif;
  --serif: ui-serif, 'Songti SC', 'STSong', 'SimSun', serif;

  min-height: 100svh;
  background:
    radial-gradient(720px 420px at 12% -8%, rgba(99, 102, 241, 0.12), transparent 60%),
    radial-gradient(640px 380px at 90% 8%, rgba(6, 182, 212, 0.1), transparent 55%),
    var(--bg);
  color: var(--text);
  font-family: var(--font);

  .top {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    height: var(--nav-h);
    background: color-mix(in srgb, var(--bg) 78%, transparent);
    backdrop-filter: blur(16px) saturate(1.3);
    -webkit-backdrop-filter: blur(16px) saturate(1.3);
    border-bottom: 1px solid var(--line);
  }

  .inner {
    width: min(90vw, 1400px);
    max-width: 1400px;
    margin: 0 auto;
    height: var(--nav-h);
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
    color: inherit;
    margin-right: 12px;

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
    font-family: var(--serif);
    font-weight: 700;
    font-size: 17px;
    box-shadow: 0 4px 14px rgba(59, 130, 246, 0.28);
  }

  .brand-text {
    font-family: var(--serif);
    font-size: 21px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--text);
  }

  .nav-actions {
    flex-shrink: 0;
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .admin-entry {
    width: 36px;
    height: 36px;
    min-width: 36px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 1px solid var(--line);
    background: var(--bg-elevated);
    color: var(--text-soft);
    text-decoration: none;
    transition:
      transform 0.2s,
      border-color 0.2s,
      color 0.2s;

    &:hover {
      transform: scale(1.05);
      border-color: var(--purple-soft);
      color: var(--purple);
    }
  }

  .nav-link {
    appearance: none;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    min-height: 36px;
    padding: 0 14px;
    border-radius: var(--radius-pill);
    border: 1px solid color-mix(in srgb, var(--purple) 28%, transparent);
    background: color-mix(in srgb, var(--purple) 8%, var(--bg-elevated));
    color: var(--purple);
    text-decoration: none;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition:
      color 0.2s,
      border-color 0.2s,
      box-shadow 0.2s,
      background 0.2s;

    &:hover {
      color: #5b3fd4;
      border-color: color-mix(in srgb, var(--purple) 45%, transparent);
      box-shadow: var(--shadow-soft);
      background: color-mix(in srgb, var(--purple) 12%, var(--bg-elevated));
    }
  }

  .main {
    width: min(90vw, 1400px);
    max-width: 1400px;
    margin: 0 auto;
    padding: calc(var(--nav-h) + 40px) 0 64px;
  }

  .list-meta {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    margin-bottom: 14px;
  }

  .list-total {
    margin: 0;
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    padding: 6px 14px 6px 12px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--line);
    background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
    box-shadow: var(--shadow-soft);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .list-total__label {
    color: var(--muted);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.12em;
  }

  .list-total__count {
    color: var(--text);
    font-family: var(--serif);
    font-size: 18px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    line-height: 1;
    background: linear-gradient(120deg, var(--purple), #06b6d4);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .nav-filter {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex: 1;
  }

  .cats {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    transition: opacity 0.22s ease;

    &::-webkit-scrollbar {
      display: none;
    }

    &.is-dimmed {
      opacity: 0.42;
    }
  }

  .cat {
    appearance: none;
    position: relative;
    flex-shrink: 0;
    border: none;
    background: transparent;
    color: var(--text-soft);
    padding: 8px 14px;
    font: inherit;
    font-size: 15px;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: color 0.2s;

    &::after {
      content: '';
      position: absolute;
      left: 14px;
      right: 14px;
      bottom: 2px;
      height: 2px;
      border-radius: 1px;
      background: var(--purple);
      transform: scaleX(0);
      transform-origin: center;
      transition: transform 0.22s ease;
    }

    &:hover {
      color: var(--text);
    }

    &.is-active {
      color: var(--text);
      font-weight: 600;

      &::after {
        transform: scaleX(1);
      }
    }
  }

  .mode-switch {
    appearance: none;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 34px;
    padding: 0 14px 0 12px;
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, #06b6d4 32%, var(--line));
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, #06b6d4 10%, var(--bg-elevated)),
        color-mix(in srgb, #0ea5e9 4%, var(--bg-elevated))
      );
    color: color-mix(in srgb, #0e7490 55%, var(--text));
    font: inherit;
    font-size: 13px;
    font-weight: 650;
    letter-spacing: 0.06em;
    cursor: pointer;
    box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 55%, transparent);
    transition:
      color 0.2s,
      border-color 0.2s,
      background 0.2s,
      box-shadow 0.2s,
      transform 0.2s;

    svg {
      flex-shrink: 0;
      opacity: 0.85;
    }

    &:hover {
      border-color: color-mix(in srgb, #06b6d4 55%, transparent);
      color: #0e7490;
      transform: translateY(-1px);
      box-shadow:
        inset 0 1px 0 color-mix(in srgb, #fff 55%, transparent),
        0 6px 14px rgba(6, 182, 212, 0.16);
    }

    &.is-active {
      color: #fff;
      border-color: transparent;
      background: linear-gradient(135deg, #0891b2 0%, #0ea5e9 55%, #38bdf8 100%);
      box-shadow: 0 6px 16px rgba(14, 165, 233, 0.28);
      transform: none;

      svg {
        opacity: 1;
      }

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 8px 18px rgba(14, 165, 233, 0.34);
      }
    }
  }

  .works-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  .works-grid > li {
    min-width: 0;
    display: flex;
  }

  .work-card {
    --card-tint: transparent;
    box-sizing: border-box;
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    width: 100%;
    min-width: 0;
    /* 对齐参考站视觉高度：content-box 200 + padding ≈ 240 */
    min-height: 240px;
    margin: 0;
    padding: 1.2rem 1.25rem 1.15rem;
    overflow: hidden;
    border-radius: var(--radius);
    border: 1px solid var(--line);
    background: var(--bg-elevated);
    box-shadow: var(--shadow-soft);
    text-align: left;
    text-decoration: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition:
      transform 0.25s,
      box-shadow 0.25s;

    &:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow);

      .work-card__arrow {
        transform: translateX(4px);
      }

      .work-card__mark {
        opacity: 0.14;
        transform: scale(1.04);
      }
    }
  }

  .work-card__top,
  .work-card__name,
  .work-card__desc,
  .work-card__go {
    position: relative;
    z-index: 1;
  }

  .work-card__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .work-card__meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.4rem;
  }

  .work-card__index {
    flex-shrink: 0;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--purple-soft);
  }

  .work-card__tag {
    font-size: 0.68rem;
    font-weight: 600;
    padding: 0.18rem 0.52rem;
    border-radius: var(--radius-pill);
    border: 1px solid var(--line);
    color: var(--text-soft);
    background: color-mix(in srgb, var(--bg) 65%, transparent);
    white-space: nowrap;
  }

  .work-card__platform {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    padding: 0.18rem 0.52rem;
    border-radius: var(--radius-pill);
    color: var(--purple);
    background: color-mix(in srgb, var(--purple) 10%, transparent);
    white-space: nowrap;
  }

  .work-card__name {
    margin: 1rem 0 0.55rem;
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .work-card__desc {
    margin: 0;
    flex: 1 1 0%;
    color: var(--text-soft);
    font-size: 0.9rem;
    line-height: 1.65;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    overflow: hidden;
  }

  .work-card__go {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin-top: 1rem;
    color: var(--purple);
    font-size: 0.86rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .work-card__arrow {
    display: inline-block;
    transition: transform 0.2s;
  }

  .work-card__mark {
    position: absolute;
    right: -0.1em;
    bottom: -0.25em;
    font-family: var(--serif);
    font-size: 7.5rem;
    font-weight: 700;
    line-height: 1;
    color: var(--text);
    opacity: 0.06;
    pointer-events: none;
    transition:
      opacity 0.25s,
      transform 0.25s;
  }

  .work-card--violet {
    --card-tint: rgba(124, 92, 252, 0.16);
    background:
      radial-gradient(320px 180px at 90% 0%, var(--card-tint), transparent 70%),
      var(--bg-elevated);
  }

  .work-card--rose {
    --card-tint: rgba(244, 63, 94, 0.14);
    background:
      radial-gradient(320px 180px at 90% 0%, var(--card-tint), transparent 70%),
      var(--bg-elevated);
  }

  .work-card--ink {
    --card-tint: rgba(15, 23, 42, 0.1);
    background:
      radial-gradient(320px 180px at 90% 0%, var(--card-tint), transparent 70%),
      var(--bg-elevated);
  }

  .work-card--emerald {
    --card-tint: rgba(16, 185, 129, 0.14);
    background:
      radial-gradient(320px 180px at 90% 0%, var(--card-tint), transparent 70%),
      var(--bg-elevated);
  }

  .work-card--sky {
    --card-tint: rgba(14, 165, 233, 0.14);
    background:
      radial-gradient(320px 180px at 90% 0%, var(--card-tint), transparent 70%),
      var(--bg-elevated);
  }

  .work-card--cyan {
    --card-tint: rgba(6, 182, 212, 0.14);
    background:
      radial-gradient(320px 180px at 90% 0%, var(--card-tint), transparent 70%),
      var(--bg-elevated);
  }

  .work-card--amber {
    --card-tint: rgba(245, 158, 11, 0.16);
    background:
      radial-gradient(320px 180px at 90% 0%, var(--card-tint), transparent 70%),
      var(--bg-elevated);
  }

  .work-card.is-featured {
    border-color: color-mix(in srgb, var(--purple) 28%, transparent);
  }

  .project-empty {
    margin: 0;
    padding: 48px 0;
    color: var(--muted);
    font-size: 14px;
    letter-spacing: 0.06em;
    text-align: center;
  }

  .project-detail-mask {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: grid;
    place-items: start center;
    padding: 24px;
    box-sizing: border-box;
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    overflow: auto;
  }

  .project-detail {
    position: relative;
    width: min(100%, 520px);
    margin: min(12vh, 72px) auto;
    padding: 24px 24px 28px;
    border-radius: 18px;
    background: var(--bg-elevated);
    border: 1px solid var(--line);
    box-shadow: 0 24px 64px rgba(15, 23, 42, 0.18);
    color: var(--text);
  }

  .project-detail__close {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    color: var(--text-soft);
    font-size: 1.35rem;
    line-height: 1;
    cursor: pointer;
  }

  .project-detail__notice {
    margin: 0 44px 12px 0;
    padding: 0.55rem 0.75rem;
    border-radius: 10px;
    background: color-mix(in srgb, #f59e0b 14%, transparent);
    color: #b45309;
    font-size: 0.86rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .project-detail__title {
    margin: 0 44px 1rem 0;
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .project-detail__fields {
    display: grid;
    grid-template-columns: 4.5rem 1fr;
    gap: 0.7rem 0.85rem;
    margin: 0;
  }

  .project-detail__fields dt {
    margin: 0;
    color: var(--muted);
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    line-height: 1.6;
  }

  .project-detail__fields dd {
    margin: 0;
    font-size: 0.92rem;
    line-height: 1.6;
    color: var(--text-soft);
  }

  .project-detail__block {
    white-space: pre-wrap;
  }

  .project-detail__muted {
    color: var(--muted);
  }

  .project-detail__tags,
  .project-detail__list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .project-detail__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .project-detail__tags li {
    padding: 0.16rem 0.5rem;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--purple) 10%, transparent);
    color: var(--purple);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .project-detail__list {
    display: grid;
    gap: 0.35rem;
  }

  .project-detail__list li {
    position: relative;
    padding-left: 0.85rem;
  }

  .project-detail__list li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.55em;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--purple-soft);
  }

  @media (max-width: 900px) {
    .works-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .nav-actions {
      gap: 6px;
    }

    .admin-entry {
      width: 32px;
      height: 32px;
      min-width: 32px;

      svg {
        width: 16px;
        height: 16px;
      }
    }

    .nav-link {
      padding: 0 10px;
      font-size: 12px;
      min-height: 32px;
    }
  }

  @media (max-width: 720px) {
    --nav-h: 96px;

    .inner {
      display: grid;
      grid-template-columns: 1fr;
      grid-template-rows: 52px 44px;
      height: var(--nav-h);
      gap: 0;
      align-items: center;
    }

    .brand {
      grid-column: 1;
      grid-row: 1;
      margin-right: 0;
    }

    .brand-text {
      font-size: 18px;
    }

    .nav-actions {
      position: absolute;
      top: 10px;
      right: max(4vw, 12px);
      margin-left: 0;
    }

    .nav-filter {
      grid-column: 1;
      grid-row: 2;
      align-self: stretch;
      margin: 0 -4px;
      padding: 0 4px 2px;
      gap: 8px;
    }

    .mode-switch {
      min-height: 30px;
      padding: 0 11px 0 9px;
      font-size: 12px;
      gap: 5px;
      border-radius: 8px;
    }

    .cat {
      padding: 6px 12px;
      font-size: 14px;

      &::after {
        left: 12px;
        right: 12px;
        bottom: 0;
      }
    }

    .main {
      padding-top: calc(var(--nav-h) + 28px);
    }
  }

  @media (max-width: 560px) {
    .nav-actions {
      gap: 4px;
    }

    .admin-entry {
      width: 30px;
      height: 30px;
      min-width: 30px;

      svg {
        width: 15px;
        height: 15px;
      }
    }

    .nav-link {
      padding: 0 8px;
      font-size: 11px;
      min-height: 30px;
    }
  }

  @media (max-width: 560px) {
    .works-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .work-card,
    .work-card__mark,
    .work-card__arrow {
      transition: none;
    }

    .work-card:hover,
    .work-card:hover .work-card__arrow,
    .work-card:hover .work-card__mark {
      transform: none;
    }
  }
`
