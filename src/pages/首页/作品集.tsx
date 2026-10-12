import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import styled from 'styled-components'
import DomainSelect from './DomainSelect'
import SiteHeader from './SiteHeader'
import {
  ALL_WORKS,
  fetchProjectWorks,
  filterWorksByCategory,
  PROJECT_TONES,
  WORK_CATEGORIES,
  type ProjectWork,
  type WorkCategory,
} from './works'

type ContentTab = 'works' | 'projects'

/** 作品页：独立路由，顶栏置顶显示 */
export default function WorksPage() {
  const [category, setCategory] = useState<WorkCategory>('all')
  const [contentTab, setContentTab] = useState<ContentTab>('works')
  const [projects, setProjects] = useState<ProjectWork[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [scrolled, setScrolled] = useState(false)
  const works = filterWorksByCategory(category)
  const scrollRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = '作品 · 刘铭'
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  /** 项目经历来自后台「作品管理」，按排序返回 */
  useEffect(() => {
    let cancelled = false
    fetchProjectWorks().then((list) => {
      if (!cancelled) {
        setProjects(list)
        setProjectsLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  /** 顶栏毛玻璃随内容下滑加深 */
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => setScrolled(el.scrollTop > 24)
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTop = () => scrollRef.current?.scrollTo({ top: 0 })

  return (
    <Style>
      <div className="shell">
        <div className="works-panel" aria-label="个人作品">
          <div className="works-scroll" ref={scrollRef}>
            <SiteHeader scrolled={scrolled} />
            <div className="main">
              <div className="main-toolbar">
                <div
                  className={`view-switch${contentTab === 'projects' ? ' is-projects' : ''}`}
                  role="tablist"
                  aria-label="内容切换"
                >
                  <span className="view-switch__thumb" aria-hidden="true" />
                  <button
                    type="button"
                    role="tab"
                    aria-selected={contentTab === 'works'}
                    className={`view-switch__btn${contentTab === 'works' ? ' is-active' : ''}`}
                    onClick={() => {
                      setContentTab('works')
                      scrollTop()
                    }}
                  >
                    个人作品
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={contentTab === 'projects'}
                    className={`view-switch__btn${contentTab === 'projects' ? ' is-active' : ''}`}
                    onClick={() => {
                      setContentTab('projects')
                      scrollTop()
                    }}
                  >
                    项目经历
                  </button>
                </div>
              </div>

              {contentTab === 'works' ? (
                <div className="works-stage" key={`works-${category}`}>
                  <div className="works-stage__head">
                    <div>
                      <p className="works-kicker">Works</p>
                      <h1 className="works-title">个人作品</h1>
                      <p className="lead">挑选一个入口，开始探索</p>
                    </div>
                    <div className="cats" role="tablist" aria-label="作品分类">
                      {WORK_CATEGORIES.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          role="tab"
                          aria-selected={category === item.id}
                          className={`cat${category === item.id ? ' is-active' : ''}`}
                          onClick={() => setCategory(item.id)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <ul className="work-rail">
                    {works.map((work, index) => (
                      <li key={work.href} style={{ '--i': index } as CSSProperties}>
                        <Link className={`work-row work-row--${work.tone}`} to={work.href}>
                          <span className="work-row__rail" aria-hidden="true" />
                          <span className="work-row__num">{String(index + 1).padStart(2, '0')}</span>
                          <span className="work-row__glyph" aria-hidden="true">
                            {work.glyph}
                          </span>
                          <div className="work-row__body">
                            <div className="work-row__topline">
                              <h2 className="work-row__name">{work.name}</h2>
                              <span className="work-row__meta">
                                {work.platform}
                                <span aria-hidden="true"> · </span>
                                {work.tag}
                              </span>
                            </div>
                            <p className="work-row__desc">{work.desc}</p>
                          </div>
                          <span className="work-row__go" aria-hidden="true">
                            →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="projects-stage" key="projects">
                  <div className="works-stage__head">
                    <div>
                      <p className="works-kicker">Experience</p>
                      <h1 className="works-title">项目经历</h1>
                      <p className="lead">参与过的项目与角色</p>
                    </div>
                  </div>
                  {projectsLoading ? (
                    <p className="project-empty">加载中…</p>
                  ) : projects.length === 0 ? (
                    <p className="project-empty">暂无项目，可在后台「作品管理」中添加</p>
                  ) : (
                    <ul className="project-list">
                      {projects.map((project, index) => (
                        <li
                          key={project.id}
                          className={`project-item project-item--${PROJECT_TONES[index % PROJECT_TONES.length]}`}
                        >
                          <div className="project-item__media">
                            <img src={project.image} alt="" loading="lazy" />
                            <span className="project-item__veil" aria-hidden="true" />
                          </div>
                          <div className="project-item__body">
                            <div className="project-item__meta">
                              <span className="project-item__index">
                                {String(index + 1).padStart(2, '0')}
                              </span>
                              <span className="project-item__period">{project.period}</span>
                            </div>
                            <h2 className="project-item__title">{project.title}</h2>
                            <p className="project-item__role">{project.role}</p>
                            <p className="project-item__desc">{project.description}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <p className="foot-note">共 {ALL_WORKS.length} 个作品 · 数据来自公开接口，仅供学习交流</p>
            </div>
          </div>
        </div>
      </div>

      <DomainSelect />
    </Style>
  )
}

const Style = styled.div`
  --ink: #0b1220;
  --text: #e8eef8;
  --text-soft: rgba(232, 238, 248, 0.72);
  --muted: rgba(232, 238, 248, 0.48);
  --line: rgba(255, 255, 255, 0.14);
  --accent: #7dd3c0;
  --font: 'Outfit', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  --display: 'Instrument Serif', 'Songti SC', 'STSong', serif;

  height: 100svh;
  background: var(--ink);
  color: var(--text);
  font-family: var(--font);
  overflow: hidden;

  /* 内容区：顶栏 sticky 吸顶，只有这里滚动 */
  .shell {
    height: 100svh;
    overflow: hidden;
  }

  .works-panel {
    position: relative;
    height: 100svh;
    width: 100%;
    overflow: hidden;
    background:
      radial-gradient(900px 520px at 8% -8%, rgba(125, 211, 192, 0.14), transparent 58%),
      radial-gradient(700px 480px at 92% 12%, rgba(96, 165, 250, 0.08), transparent 55%),
      radial-gradient(640px 420px at 50% 100%, rgba(251, 191, 36, 0.05), transparent 50%),
      linear-gradient(180deg, #0a101c 0%, var(--ink) 40%, #080e18 100%);
  }

  .works-scroll {
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    -webkit-overflow-scrolling: touch;
  }

  .main {
    width: min(92vw, 1200px);
    margin: 0 auto;
    padding: 4px 0 88px;
  }

  /* 无「回到首页」，切换器靠右 */
  .main-toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 16px;
    margin-bottom: 32px;
  }

  .view-switch {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: min(100%, 320px);
    padding: 4px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
  }

  .view-switch__thumb {
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 4px;
    width: calc(50% - 4px);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
    transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    pointer-events: none;
  }

  .view-switch.is-projects .view-switch__thumb {
    transform: translateX(100%);
  }

  .view-switch__btn {
    appearance: none;
    position: relative;
    z-index: 1;
    border: none;
    background: transparent;
    color: var(--muted);
    padding: 11px 14px;
    margin: 0;
    border-radius: 9px;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.14em;
    line-height: 1.2;
    cursor: pointer;
    transition: color 0.25s ease;

    &:hover {
      color: var(--text);
    }

    &.is-active {
      color: #0b1220;
    }
  }

  .works-stage,
  .projects-stage {
    animation: stage-in 0.42s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .works-stage__head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 28px;
  }

  .works-kicker {
    margin: 0 0 8px;
    color: var(--accent);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.22em;
    text-transform: uppercase;
  }

  .works-title {
    margin: 0;
    font-family: var(--display);
    font-size: clamp(34px, 5vw, 48px);
    font-weight: 400;
    letter-spacing: 0.08em;
    line-height: 1.1;
  }

  .lead {
    margin: 10px 0 0;
    color: var(--muted);
    font-size: 14px;
    letter-spacing: 0.06em;
  }

  .foot-note {
    margin: 36px 0 0;
    color: var(--muted);
    font-size: 12px;
    letter-spacing: 0.08em;
    text-align: center;
  }

  .project-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .project-empty {
    margin: 0;
    padding: 48px 0;
    color: var(--muted);
    font-size: 14px;
    letter-spacing: 0.06em;
    text-align: center;
  }

  .project-item {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: 1.5rem;
    align-items: stretch;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid var(--line);

    &:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
  }

  .project-item__media {
    position: relative;
    overflow: hidden;
    border-radius: 14px;
    min-height: 180px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--line);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
      transition: transform 0.45s ease;
    }
  }

  .project-item__veil {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .project-item--teal .project-item__veil {
    background: linear-gradient(135deg, rgba(125, 211, 192, 0.35), rgba(8, 16, 28, 0.35));
  }

  .project-item--amber .project-item__veil {
    background: linear-gradient(135deg, rgba(245, 180, 90, 0.35), rgba(8, 16, 28, 0.35));
  }

  .project-item--sky .project-item__veil {
    background: linear-gradient(135deg, rgba(110, 180, 230, 0.35), rgba(8, 16, 28, 0.35));
  }

  .project-item--rose .project-item__veil {
    background: linear-gradient(135deg, rgba(230, 140, 160, 0.35), rgba(8, 16, 28, 0.35));
  }

  .project-item:hover .project-item__media img {
    transform: scale(1.04);
  }

  .project-item__body {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    padding: 0.35rem 0;
  }

  .project-item__meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 0.7rem;
  }

  .project-item__index {
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--accent);
  }

  .project-item__period {
    color: var(--muted);
    font-size: 0.78rem;
    letter-spacing: 0.06em;
  }

  .project-item__title {
    margin: 0;
    font-family: var(--display);
    font-size: clamp(22px, 2.8vw, 30px);
    font-weight: 400;
    letter-spacing: 0.06em;
  }

  .project-item__role {
    margin: 0.45rem 0 0;
    color: color-mix(in srgb, var(--accent) 80%, #fff);
    font-size: 0.88rem;
    font-weight: 600;
    letter-spacing: 0.08em;
  }

  .project-item__desc {
    margin: 0.75rem 0 0;
    color: var(--text-soft);
    font-size: 0.92rem;
    line-height: 1.7;
  }

  .cats {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
    min-width: 0;
  }

  .cat {
    appearance: none;
    flex-shrink: 0;
    border: 1px solid transparent;
    background: transparent;
    color: var(--muted);
    padding: 7px 12px;
    border-radius: 8px;
    font: inherit;
    font-size: 13px;
    letter-spacing: 0.08em;
    cursor: pointer;
    transition:
      color 0.2s,
      background 0.2s,
      border-color 0.2s;

    &:hover {
      color: var(--text);
      background: rgba(255, 255, 255, 0.04);
    }

    &.is-active {
      color: var(--text);
      border-color: rgba(125, 211, 192, 0.35);
      background: rgba(125, 211, 192, 0.12);
    }
  }

  .work-rail {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .work-rail > li {
    animation: row-in 0.48s cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: calc(var(--i, 0) * 45ms);
  }

  .work-row {
    --tone: 125, 211, 192;
    position: relative;
    display: grid;
    grid-template-columns: 52px 56px minmax(0, 1fr) 36px;
    align-items: center;
    gap: 14px 16px;
    min-height: 108px;
    padding: 22px 22px 22px 18px;
    overflow: hidden;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.025);
    text-decoration: none;
    color: inherit;
    transition:
      background 0.3s ease,
      border-color 0.3s ease,
      transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);

    &:hover {
      background: rgba(var(--tone), 0.08);
      border-color: rgba(var(--tone), 0.32);
      transform: translateX(4px);

      .work-row__rail {
        transform: scaleY(1);
        opacity: 1;
      }

      .work-row__go {
        color: rgb(var(--tone));
        transform: translateX(4px);
      }

      .work-row__glyph {
        opacity: 0.9;
        transform: scale(1.04);
      }

      .work-row__num {
        color: rgb(var(--tone));
      }
    }
  }

  .work-row__rail {
    position: absolute;
    left: 0;
    top: 14px;
    bottom: 14px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: rgb(var(--tone));
    opacity: 0.55;
    transform: scaleY(0.72);
    transform-origin: center;
    transition:
      transform 0.3s ease,
      opacity 0.3s ease;
  }

  .work-row__num {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.14em;
    color: var(--muted);
    transition: color 0.25s;
  }

  .work-row__glyph {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 14px;
    font-family: var(--display);
    font-size: 28px;
    line-height: 1;
    color: rgb(var(--tone));
    background: rgba(var(--tone), 0.12);
    border: 1px solid rgba(var(--tone), 0.22);
    transition:
      opacity 0.3s,
      transform 0.3s ease;
  }

  .work-row__body {
    min-width: 0;
  }

  .work-row__topline {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
  }

  .work-row__name {
    margin: 0;
    font-family: var(--display);
    font-size: clamp(22px, 2.4vw, 28px);
    font-weight: 400;
    letter-spacing: 0.06em;
    line-height: 1.2;
  }

  .work-row__meta {
    flex-shrink: 0;
    color: var(--muted);
    font-size: 12px;
    letter-spacing: 0.08em;
    white-space: nowrap;
  }

  .work-row__desc {
    margin: 8px 0 0;
    color: var(--text-soft);
    font-size: 14px;
    line-height: 1.65;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }

  .work-row__go {
    justify-self: end;
    color: var(--muted);
    font-size: 20px;
    line-height: 1;
    transition:
      color 0.25s,
      transform 0.25s ease;
  }

  .work-row--violet {
    --tone: 167, 139, 250;
  }

  .work-row--rose {
    --tone: 244, 114, 182;
  }

  .work-row--ink {
    --tone: 148, 163, 184;
  }

  .work-row--emerald {
    --tone: 52, 211, 153;
  }

  .work-row--sky {
    --tone: 56, 189, 248;
  }

  .work-row--cyan {
    --tone: 34, 211, 238;
  }

  .work-row--amber {
    --tone: 251, 191, 36;
  }

  @keyframes stage-in {
    from {
      opacity: 0;
      transform: translateY(14px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes row-in {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 900px) {
    .works-stage__head {
      flex-direction: column;
      align-items: stretch;
    }

    .cats {
      justify-content: flex-start;
    }

    .work-row {
      grid-template-columns: 40px 48px minmax(0, 1fr) 28px;
      gap: 12px;
      padding: 18px 16px 18px 14px;
    }

    .work-row__glyph {
      width: 48px;
      height: 48px;
      font-size: 24px;
      border-radius: 12px;
    }

    .work-row__topline {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }

    .project-item {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .project-item__media {
      min-height: 200px;
      aspect-ratio: 16 / 10;
    }
  }

  @media (max-width: 560px) {
    .main {
      padding: 4px 0 64px;
    }

    .main-toolbar {
      gap: 14px;
    }

    .view-switch {
      width: 100%;
    }

    .work-row {
      grid-template-columns: 36px minmax(0, 1fr) 24px;
      min-height: 0;
    }

    .work-row__glyph {
      display: none;
    }

    .project-item__media {
      min-height: 160px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .works-stage,
    .projects-stage,
    .work-rail > li {
      animation: none;
    }

    .project-item__media img,
    .work-row,
    .work-row__rail,
    .work-row__glyph,
    .work-row__go,
    .view-switch__thumb {
      transition: none;
    }

    .project-item:hover .project-item__media img,
    .work-row:hover {
      transform: none;
    }
  }
`