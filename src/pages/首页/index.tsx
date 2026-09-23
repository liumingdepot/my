import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import styled, { createGlobalStyle } from 'styled-components'
import { WORKS_HOME_LIMIT, WORKS_PATH } from '../更多作品/works'
import { getLangMeta, I18N, LANG_OPTIONS, resolveLang, type Lang } from './utils/i18n'

const NAV = [
  { id: 'top', key: 'intro', n: '01' },
  { id: 'works', key: 'works', n: '02' },
  { id: 'about', key: 'about', n: '03' },
  { id: 'skills', key: 'skills', n: '04' },
  { id: 'projects', key: 'projects', n: '05' },
  { id: 'experience', key: 'experience', n: '06' },
  { id: 'contact', key: 'contact', n: '07' },
] as const

function lead(text: string) {
  const sep = text.includes('：') ? '：' : text.includes(': ') ? ': ' : ''
  if (!sep) return text
  const cut = text.indexOf(sep)
  return (
    <>
      <strong>{text.slice(0, cut)}</strong>
      {sep}
      {text.slice(cut + sep.length)}
    </>
  )
}

function SunIcon() {
  return (
    <svg className="icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" />
    </svg>
  )
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

function ChevronIcon() {
  return (
    <svg className="lang-dd__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="lang-dd__check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d="M5 12l5 5L20 7" />
    </svg>
  )
}

function LangSelect({
  value,
  label,
  onChange,
}: {
  value: Lang
  label: string
  onChange: (lang: Lang) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const current = LANG_OPTIONS.find((item) => item.code === value) ?? LANG_OPTIONS[0]

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className={`lang-dd${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        className="lang-dd__trigger"
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="lang-dd__globe" aria-hidden="true">
          文
        </span>
        <span className="lang-dd__label">{current.label}</span>
        <ChevronIcon />
      </button>
      {open ? (
        <ul className="lang-dd__menu" role="listbox" aria-label={label}>
          {LANG_OPTIONS.map((option) => {
            const active = option.code === value
            return (
              <li key={option.code} role="option" aria-selected={active}>
                <button
                  className={`lang-dd__option${active ? ' is-active' : ''}`}
                  type="button"
                  onClick={() => {
                    onChange(option.code)
                    setOpen(false)
                  }}
                >
                  <span>{option.label}</span>
                  {active ? <CheckIcon /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

export default function Home() {
  const [lang, setLang] = useState<Lang>(() => resolveLang(localStorage.getItem('lang')))
  const [theme, setTheme] = useState(() => (localStorage.getItem('theme') === 'light' ? 'light' : 'dark'))
  const [menuOpen, setMenuOpen] = useState(false)
  const t = I18N[lang]
  const ui = t.ui
  const langMeta = getLangMeta(lang)
  const featured = t.projects.find((project) => 'featured' in project && project.featured)
  const projects = t.projects.filter((project) => project !== featured)

  useLayoutEffect(() => {
    document.body.classList.add('site-home')
    document.body.style.background = ''
    document.documentElement.lang = langMeta.htmlLang
    document.documentElement.dir = langMeta.dir
    document.documentElement.dataset.theme = theme
    document.title = langMeta.title
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b1020' : '#f5f6fb')
    localStorage.setItem('lang', lang)
    localStorage.setItem('theme', theme)
    return () => {
      document.body.classList.remove('site-home')
      document.documentElement.dir = 'ltr'
    }
  }, [lang, langMeta, theme])

  useEffect(() => {
    const nav = document.querySelector('.nav')
    const onScroll = () => nav?.classList.toggle('is-scrolled', window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const nodes = document.querySelectorAll('.reveal')
    nodes.forEach((node) => {
      node.querySelectorAll('.stagger-item').forEach((item, index) => {
        ;(item as HTMLElement).style.setProperty('--i', String(index))
      })
    })
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-in')
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [lang])

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <Style>
      <GlobalStyle />
      <div className="bg-grid" />
      <div className="bg-blobs" aria-hidden="true">
        <div className="blob blob-a" />
        <div className="blob blob-b" />
        <div className="blob blob-c" />
      </div>

      <nav className="nav">
        <a className="nav__brand" href="#top">
          <span className="nav__dot" />
          {ui.brand}
          <span>{ui.brandSuffix}</span>
        </a>
        <div className="nav__links">
          {NAV.map((item) => (
            <a key={item.id} href={`#${item.id}`}>
              <em>{item.n}</em>
              {ui.nav[item.key]}
            </a>
          ))}
          <Link to={WORKS_PATH}>更多作品</Link>
        </div>
        <div className="nav__actions">
          <LangSelect value={lang} label={ui.selectLang} onChange={setLang} />
          <button
            className="theme-toggle"
            type="button"
            aria-label={ui.theme}
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          >
            <SunIcon />
            <MoonIcon />
          </button>
          <Link className="admin-entry" to="/admin" title={ui.admin} aria-label={ui.admin}>
            <AdminIcon />
          </Link>
          <a className="btn btn--outline" href={t.profile.resume} target="_blank" rel="noreferrer">
            {ui.resume}
          </a>
          <a className="btn btn--gradient" href="#contact">
            {ui.hireMe}
          </a>
          <button
            className={`nav__burger${menuOpen ? ' is-open' : ''}`}
            type="button"
            aria-label={ui.menu}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      <div className={`mobile-menu${menuOpen ? ' is-open' : ''}`} hidden={!menuOpen}>
        {NAV.map((item) => (
          <a key={item.id} href={`#${item.id}`} onClick={closeMenu}>
            {ui.nav[item.key]}
          </a>
        ))}
        <Link to={WORKS_PATH} onClick={closeMenu}>
          更多作品
        </Link>
        <a href={t.profile.resume} target="_blank" rel="noreferrer" onClick={closeMenu}>
          {ui.resume}
        </a>
      </div>

      <div className="wrap" id="top">
        <section className="hero">
          <div className="hero__copy">
            <p className="badge hero-enter" style={{ '--d': '0ms' } as CSSProperties}>
              <span className="badge__dot" />
              {t.profile.available}
            </p>
            <h1 className="hero__name hero-enter" style={{ '--d': '80ms' } as CSSProperties}>
              {t.profile.name}
            </h1>
            <p
              className="hero__headline hero-enter"
              style={{ '--d': '160ms' } as CSSProperties}
              dangerouslySetInnerHTML={{ __html: t.profile.headlineHtml }}
            />
            <p className="hero__bio hero-enter" style={{ '--d': '240ms' } as CSSProperties}>
              {t.profile.bio}
            </p>
            <div className="hero__cta hero-enter" style={{ '--d': '320ms' } as CSSProperties}>
              <a className="btn btn--gradient btn--lg" href="#projects">
                {ui.viewProjects}
              </a>
              <a className="btn btn--soft btn--lg" href="#contact">
                {ui.getInTouch}
              </a>
            </div>
            <div className="hero__social hero-enter" style={{ '--d': '400ms' } as CSSProperties}>
              <a href={`tel:${t.profile.phone}`}>{ui.phone}</a>
              <a href={t.profile.resume} target="_blank" rel="noreferrer">
                {ui.resumeLink}
              </a>
            </div>
          </div>
          <div className="hero__right hero-enter hero-enter--photo" style={{ '--d': '180ms' } as CSSProperties}>
            <div className="hero__photo-wrap">
              <img className="hero__photo" src={t.profile.photo} alt={t.profile.name} />
            </div>
          </div>
        </section>

        <section className="stats reveal reveal--stagger" aria-label={lang === 'en' ? 'Overview' : '概览'}>
          {t.stats.map((stat) => (
            <div className="stat stagger-item" key={stat.label}>
              <div className="stat__value">{stat.value}</div>
              <div className="stat__label">{stat.label}</div>
            </div>
          ))}
        </section>

        <section className="section works reveal reveal--stagger" id="works">
          <div className="section__watermark">02</div>
          <p className="section__label">{ui.sectionWorks}</p>
          <h2 className="section__title">{ui.worksTitle}</h2>
          <ul className="works-grid">
            {t.works.slice(0, WORKS_HOME_LIMIT).map((work, index) => {
              const platformLabel = work.href === '/game' ? ui.platformPc : ui.platformAll
              const card = (
                <>
                  <div className="work-card__top">
                    <span className="work-card__index">{String(index + 1).padStart(2, '0')}</span>
                    <div className="work-card__meta">
                      <span className="work-card__platform">{platformLabel}</span>
                      <span className="work-card__tag">{work.tag}</span>
                    </div>
                  </div>
                  <h3 className="work-card__name">{work.name}</h3>
                  <p className="work-card__desc">{work.desc}</p>
                  <span className="work-card__go">
                    {ui.workOpen}
                    <span className="work-card__arrow" aria-hidden="true">
                      →
                    </span>
                  </span>
                  <span className="work-card__mark" aria-hidden="true">
                    {work.glyph}
                  </span>
                </>
              )
              const className = `work-card work-card--${work.tone} stagger-item`
              return (
                <li key={work.href}>
                  {work.href.startsWith('/') ? (
                    <Link className={className} to={work.href}>
                      {card}
                    </Link>
                  ) : (
                    <a className={className} href={work.href} target="_blank" rel="noreferrer">
                      {card}
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="works-more">
            <Link className="works-more__link" to={WORKS_PATH}>
              更多作品 →
            </Link>
          </div>
        </section>

        <section className="section reveal" id="about">
          <div className="section__watermark">03</div>
          <p className="section__label">{ui.sectionAbout}</p>
          <h2 className="section__title">{t.about.title}</h2>
          <div className="about__grid">
            <div className="about__copy">
              {t.about.paragraphs.map((paragraph) => (
                <p key={paragraph}>{lead(paragraph)}</p>
              ))}
            </div>
            <aside className="about__meta card">
              {t.about.meta.map((item) => (
                <div className="meta-item" key={item.label}>
                  <div className="meta-item__label">{item.label}</div>
                  <div className="meta-item__value">
                    {'href' in item && item.href ? <a href={item.href}>{item.value}</a> : item.value}
                  </div>
                </div>
              ))}
            </aside>
          </div>
        </section>

        <section className="section reveal reveal--stagger" id="skills">
          <div className="section__watermark">04</div>
          <p className="section__label">{ui.sectionSkills}</p>
          <h2 className="section__title">{ui.skillsTitle}</h2>
          <div className="skills-grid">
            {t.skills.map((group) => (
              <article className="skill-card card stagger-item" key={group.category}>
                <h3 className="skill-card__title">{group.category}</h3>
                <div className="skill-tags">
                  {group.items.map((item) => (
                    <span className="skill-tag" key={item}>
                      {item}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section reveal reveal--stagger" id="projects">
          <div className="section__watermark">05</div>
          <p className="section__label">{ui.sectionProjects}</p>
          <h2 className="section__title">{ui.projectsTitle}</h2>
          {featured ? (
            <article className="project-featured card stagger-item">
              <div className="project-featured__badge">{'badge' in featured ? featured.badge : ui.featured}</div>
              <h3 className="project-featured__name">{featured.name}</h3>
              <p className="project-featured__meta">
                {featured.role} · {featured.period}
              </p>
              <p className="project-featured__desc">{featured.desc}</p>
              {'points' in featured && featured.points ? (
                <ul className="project-featured__points">
                  {featured.points.map((point, index) => (
                    <li key={point}>
                      <em>{String(index + 1).padStart(2, '0')}</em>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="project-featured__stack-label">{ui.techStack}</div>
              <div className="skill-tags">
                {featured.stack.map((item) => (
                  <span className="skill-tag" key={item}>
                    {item}
                  </span>
                ))}
              </div>
            </article>
          ) : null}
          <div className="projects-grid">
            {projects.map((project) => (
              <article className="project-card card stagger-item" key={project.name}>
                <h3 className="project-card__name">{project.name}</h3>
                <div className="project-card__stack-line">
                  {project.role} · {project.period}
                </div>
                <p className="project-card__desc">{project.desc}</p>
                <div className="project-card__tags">
                  {project.stack.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section reveal reveal--stagger" id="experience">
          <div className="section__watermark">06</div>
          <p className="section__label">{ui.sectionExperience}</p>
          <h2 className="section__title">{ui.experienceTitle}</h2>
          <ol className="exp-list">
            {t.experience.map((job) => (
              <li className="exp-item card stagger-item" key={job.company}>
                <div className="exp-item__top">
                  <h3 className="exp-item__role">{job.role}</h3>
                  <span className="exp-item__period">{job.period}</span>
                </div>
                <p className="exp-item__company">{job.company}</p>
                <ul className="exp-item__list">
                  {job.highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        <section className="section contact reveal" id="contact">
          <div className="section__watermark">07</div>
          <p className="section__label">{ui.sectionContact}</p>
          <h2 className="section__title">{ui.contactTitle}</h2>
          <div className="contact__card card">
            <p className="contact__eyebrow">{ui.contactEyebrow}</p>
            <h3 className="contact__heading">{ui.contactHeading}</h3>
            <p className="contact__text">{ui.contactText}</p>
            <div className="contact__links">
              <a className="contact__mail" href={`tel:${t.profile.phone}`}>
                {t.profile.phone}
              </a>
              <a className="btn btn--gradient" href={t.profile.resume} target="_blank" rel="noreferrer">
                {ui.downloadResume}
              </a>
            </div>
          </div>
        </section>

        <footer className="footer">
          <span>
            © {new Date().getFullYear()} {ui.footerCopy}
          </span>
          <div className="footer__links">
            <a href="#works">{ui.nav.works}</a>
            <a href="#about">{ui.nav.about}</a>
            <a href="#projects">{ui.nav.projects}</a>
            <a href="#contact">{ui.nav.contact}</a>
          </div>
        </footer>
      </div>
    </Style>
  )
}

const GlobalStyle = createGlobalStyle`
/* Inspired by vijay-dhanvai.netlify.app — glass / gradient portfolio */

:root {
  --bg: #f5f6fb;
  --bg-elevated: #ffffff;
  --text: #0f172a;
  --text-soft: #475569;
  --muted: #94a3b8;
  --line: rgba(15, 23, 42, 0.08);
  --purple: #7c5cfc;
  --purple-soft: #a78bfa;
  --blue: #3b82f6;
  --cyan: #22d3ee;
  --grad: linear-gradient(90deg, #6366f1, #8b5cf6 45%, #06b6d4);
  --grad-btn: linear-gradient(90deg, #3b82f6, #06b6d4);
  --shadow: 0 10px 30px rgba(99, 102, 241, 0.08);
  --shadow-soft: 0 4px 18px rgba(15, 23, 42, 0.05);
  --radius: 16px;
  --radius-sm: 10px;
  --radius-pill: 999px;
  --max: 1120px;
  --font: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  --nav-h: 72px;
}

html[data-theme="dark"] body.site-home {
  color-scheme: dark;
}

html[data-theme="dark"] {
  --bg: #0b1020;
  --bg-elevated: #141a2e;
  --text: #e8eaf2;
  --text-soft: #a0a8c0;
  --muted: #6b7390;
  --line: rgba(255, 255, 255, 0.08);
  --shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  --shadow-soft: 0 4px 18px rgba(0, 0, 0, 0.25);
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

html:has(body.site-home) {
  scrollbar-width: none;
}

html:has(body.site-home)::-webkit-scrollbar {
  display: none;
}

body.site-home {
  margin: 0;
  color-scheme: light;
  font-family: var(--font);
  color: var(--text);
  background: var(--bg);
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
  scrollbar-width: none;
}

body.site-home::-webkit-scrollbar {
  display: none;
}

body.site-home a {
  color: inherit;
  text-decoration: none;
}

body.site-home img {
  max-width: 100%;
  display: block;
}

/* Large / 2K+ : roomy but not full-viewport stretch */

@media (min-width: 1440px) {
:root {
    --max: 1180px;
  }
}

@media (min-width: 1920px) {
:root {
    --max: 1240px;
    --nav-h: 68px;
  }
}

@media (min-width: 2560px) {
:root {
    --max: 1320px;
  }
}

@media (prefers-reduced-motion: reduce) {
*,
*::before,
*::after {
    animation: none !important;
    transition: none !important;
  }
}
`

const Style = styled.div`
@keyframes float {
  from { transform: translate(0, 0) scale(1); }
  to { transform: translate(20px, 30px) scale(1.08); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.85); }
}

@keyframes heroIn {
  from {
    opacity: 0;
    transform: translateY(22px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes heroInPhoto {
  from {
    opacity: 0;
    transform: translateY(28px) scale(0.94);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes photoFloat {
  from { transform: translateY(0); }
  to { transform: translateY(-10px); }
}

@keyframes gradShimmer {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}

@keyframes glowPulse {
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50% { opacity: 0.9; transform: scale(1.06); }
}

@keyframes menuIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.wrap {
  width: min(100% - 2.5rem, var(--max));
  margin-inline: auto;
  position: relative;
  z-index: 1;
}

.bg-grid {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image:
    linear-gradient(var(--line) 1px, transparent 1px),
    linear-gradient(90deg, var(--line) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 80% 70% at 50% 20%, #000 20%, transparent 75%);
  opacity: 0.7;
}

.bg-blobs {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.45;
  animation: float 16s ease-in-out infinite alternate;
}

.blob-a {
  width: 420px;
  height: 420px;
  background: #c4b5fd;
  top: -80px;
  right: 8%;
}

.blob-b {
  width: 360px;
  height: 360px;
  background: #93c5fd;
  top: 18%;
  left: -60px;
  animation-delay: -4s;
}

.blob-c {
  width: 300px;
  height: 300px;
  background: #a5f3fc;
  bottom: 10%;
  right: 20%;
  animation-delay: -8s;
}

html[data-theme="dark"] & .blob-a { background: #4c1d95; opacity: 0.35; }

html[data-theme="dark"] & .blob-b { background: #1e3a8a; opacity: 0.35; }

html[data-theme="dark"] & .blob-c { background: #155e75; opacity: 0.3; }

.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  height: var(--nav-h);
  padding: 0 1.5rem;
  backdrop-filter: blur(16px);
  background: color-mix(in srgb, var(--bg) 78%, transparent);
  border-bottom: 1px solid transparent;
  transition: border-color 0.3s, background 0.3s;
}

.nav.is-scrolled {
  border-bottom-color: var(--line);
}

.nav__brand {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  font-weight: 700;
  font-size: 1.05rem;
  letter-spacing: -0.02em;
  white-space: nowrap;
}

.nav__brand span {
  color: var(--text-soft);
  font-weight: 600;
}

.nav__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--grad-btn);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  animation: pulse 2.4s ease-in-out infinite;
}

.nav__links {
  display: flex;
  gap: 0.35rem;
}

.nav__links a {
  position: relative;
  font-size: 0.86rem;
  color: var(--purple-soft);
  font-weight: 500;
  text-align: center;
  padding: 0.35rem 0.45rem;
  box-sizing: border-box;
  white-space: nowrap;
  transition: color 0.2s;
}

.nav__links a::after {
  content: "";
  position: absolute;
  left: 0.45rem;
  right: 0.45rem;
  bottom: 0.1rem;
  height: 2px;
  border-radius: 2px;
  background: var(--grad-btn);
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.nav__links a:hover {
  color: var(--purple);
}

.nav__links a:hover::after {
  transform: scaleX(1);
}

.nav__links a em {
  font-style: normal;
  color: var(--purple-soft);
  font-weight: 600;
  margin-right: 0.45rem;
  transition: color 0.2s;
}

.nav__links a:hover em {
  color: var(--purple);
}

.nav__actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-shrink: 0;
}

.nav__actions .btn--outline,
.nav__actions .btn--gradient {
  min-width: 6.5rem;
  padding-left: 0.9rem;
  padding-right: 0.9rem;
}

.theme-toggle {
  height: 38px;
  border: 1px solid var(--line);
  background: var(--bg-elevated);
  color: var(--text-soft);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform 0.2s, border-color 0.2s, color 0.2s;
  font-family: inherit;
  flex-shrink: 0;
}

.lang-dd {
  position: relative;
  flex-shrink: 0;
  z-index: 20;
}

.lang-dd__trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: 38px;
  min-width: 6.6rem;
  padding: 0 0.7rem 0 0.45rem;
  border-radius: var(--radius-pill);
  border: 1px solid rgba(124, 92, 252, 0.32);
  background: var(--bg-elevated);
  color: var(--purple);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s, background 0.2s;
}

.lang-dd__trigger:hover {
  transform: translateY(-1px);
  border-color: var(--purple-soft);
  box-shadow: 0 6px 16px rgba(124, 92, 252, 0.12);
}

.lang-dd.is-open .lang-dd__trigger {
  border-color: var(--purple);
  box-shadow: 0 0 0 3px rgba(124, 92, 252, 0.14);
}

.lang-dd__globe {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.16), rgba(6, 182, 212, 0.16));
  color: var(--purple);
  font-size: 0.68rem;
  font-weight: 800;
  line-height: 1;
  flex-shrink: 0;
}

.lang-dd__label {
  flex: 1;
  text-align: left;
  white-space: nowrap;
}

.lang-dd__chevron {
  flex-shrink: 0;
  opacity: 0.75;
  transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}

.lang-dd.is-open .lang-dd__chevron {
  transform: rotate(180deg);
}

.lang-dd__menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 11.5rem;
  margin: 0;
  padding: 0.4rem;
  list-style: none;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
  backdrop-filter: blur(16px);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.14);
  animation: menuIn 0.22s cubic-bezier(0.22, 1, 0.36, 1) both;
  max-height: min(60vh, 22rem);
  overflow-y: auto;
}

html[data-theme="dark"] & .lang-dd__menu {
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.45);
  background: color-mix(in srgb, var(--bg-elevated) 94%, transparent);
}

.lang-dd__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  padding: 0.55rem 0.7rem;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-soft);
  font: inherit;
  font-size: 0.84rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background 0.18s, color 0.18s, transform 0.18s;
}

.lang-dd__option:hover {
  background: rgba(124, 92, 252, 0.08);
  color: var(--purple);
}

.lang-dd__option.is-active {
  background: linear-gradient(90deg, rgba(99, 102, 241, 0.12), rgba(6, 182, 212, 0.1));
  color: var(--purple);
}

.lang-dd__check {
  flex-shrink: 0;
  color: var(--purple);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.theme-toggle,
.admin-entry {
  width: 38px;
  min-width: 38px;
  border-radius: 50%;
}

.admin-entry {
  height: 38px;
  border: 1px solid var(--line);
  background: var(--bg-elevated);
  color: var(--text-soft);
  display: grid;
  place-items: center;
  transition: transform 0.2s, border-color 0.2s, color 0.2s;
  flex-shrink: 0;
}

.theme-toggle:hover,
.admin-entry:hover {
  transform: scale(1.05);
  border-color: var(--purple-soft);
  color: var(--purple);
}

html[data-theme="dark"] & .icon-sun { display: none; }

html:not([data-theme="dark"]) & .icon-moon { display: none; }

.nav__burger {
  display: none;
  width: 40px;
  height: 40px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--bg-elevated);
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.nav__burger span {
  width: 16px;
  height: 2px;
  background: var(--text);
  border-radius: 2px;
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s;
  transform-origin: center;
}

.nav__burger.is-open span:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}

.nav__burger.is-open span:nth-child(2) {
  opacity: 0;
  transform: scaleX(0);
}

.nav__burger.is-open span:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}

.mobile-menu {
  position: sticky;
  top: var(--nav-h);
  z-index: 99;
  display: grid;
  gap: 0.25rem;
  padding: 0.75rem 1.25rem 1rem;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--line);
}

.mobile-menu.is-open {
  animation: menuIn 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.mobile-menu[hidden] {
  display: none !important;
}

.mobile-menu a {
  padding: 0.7rem 0.5rem;
  font-weight: 500;
  color: var(--text-soft);
  transition: color 0.2s, transform 0.2s;
}

.mobile-menu a:hover {
  color: var(--purple);
  transform: translateX(4px);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.55rem 1.05rem;
  border-radius: var(--radius-pill);
  font-size: 0.86rem;
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, background 0.2s, filter 0.2s;
  white-space: nowrap;
}

.btn:hover {
  transform: translateY(-2px);
}

.btn--gradient:hover {
  filter: brightness(1.06);
  box-shadow: 0 12px 28px rgba(59, 130, 246, 0.35);
}

.btn--outline {
  background: transparent;
  border-color: rgba(124, 92, 252, 0.45);
  color: var(--purple);
}

.btn--gradient {
  background: var(--grad-btn);
  color: #fff;
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.28);
}

.btn--soft {
  background: var(--bg-elevated);
  color: var(--text);
  box-shadow: var(--shadow-soft);
  border-color: var(--line);
}

.btn--lg {
  padding: 0.8rem 1.35rem;
  font-size: 0.92rem;
}

.hero-enter {
  opacity: 0;
  animation: heroIn 0.85s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: var(--d, 0ms);
}

.hero-enter--photo {
  animation-name: heroInPhoto;
  animation-duration: 1s;
}

.hero {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 3.25rem;
  align-items: center;
  padding: 3.75rem 0 2.5rem;
  min-height: auto;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.85rem;
  border-radius: var(--radius-pill);
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 1.35rem;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

html[data-theme="dark"] & .badge {
  color: #34d399;
}

.badge__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.25);
  animation: pulse 2s ease-in-out infinite;
}

.hero__name {
  font-size: clamp(2.6rem, 5.5vw, 3.5rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1.05;
  margin: 0 0 0.9rem;
}

.hero__headline {
  font-size: clamp(1.3rem, 2.6vw, 1.75rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.35;
  margin: 0 0 1.15rem;
  max-width: 22ch;
}

.hero__headline .grad {
  background: var(--grad);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: gradShimmer 5s linear infinite;
}

.hero__bio {
  margin: 0 0 1.85rem;
  color: var(--text-soft);
  font-size: 1rem;
  line-height: 1.7;
  max-width: 48ch;
}

.hero__cta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  margin-bottom: 1.5rem;
}

.hero__social {
  display: flex;
  flex-wrap: wrap;
  gap: 1.1rem;
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--text-soft);
}

.hero__social a:hover {
  color: var(--purple);
}

.hero__photo-wrap {
  position: relative;
  margin-inline: auto;
  width: min(100%, 360px);
  animation: photoFloat 5.5s ease-in-out infinite alternate;
}

.hero__photo-wrap::before {
  content: "";
  position: absolute;
  inset: -12%;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.35), transparent 65%);
  filter: blur(20px);
  z-index: -1;
  animation: glowPulse 4.5s ease-in-out infinite;
}

.hero__photo {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  object-position: center top;
  border-radius: 22px;
  box-shadow: var(--shadow);
  border: 4px solid color-mix(in srgb, var(--bg-elevated) 80%, transparent);
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.45s;
}

.hero__photo:hover {
  transform: scale(1.03);
  box-shadow: 0 18px 40px rgba(99, 102, 241, 0.22);
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  padding: 0.5rem 0 1.75rem;
}

.stat {
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 1.25rem 1.1rem;
  box-shadow: var(--shadow-soft);
  text-align: left;
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s, border-color 0.3s;
}

.stat:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow);
  border-color: rgba(124, 92, 252, 0.28);
}

.stat__value {
  font-size: 1.85rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  background: var(--grad);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  line-height: 1.2;
}

.stat__label {
  margin-top: 0.35rem;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

.section {
  padding: 5.5rem 0 1rem;
  position: relative;
  scroll-margin-top: calc(var(--nav-h) + 12px);
}

.section__watermark {
  position: absolute;
  right: 0;
  top: 3.5rem;
  font-size: clamp(6rem, 18vw, 11rem);
  font-weight: 800;
  letter-spacing: -0.06em;
  color: var(--text);
  opacity: 0;
  line-height: 1;
  pointer-events: none;
  user-select: none;
  z-index: 0;
  transform: translateX(18px);
  transition: opacity 1s cubic-bezier(0.22, 1, 0.36, 1) 0.15s, transform 1s cubic-bezier(0.22, 1, 0.36, 1) 0.15s;
}

.reveal.is-in .section__watermark {
  opacity: 0.04;
  transform: none;
}

.section__label {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--purple-soft);
  letter-spacing: 0.04em;
}

.section__title {
  margin: 0 0 2.25rem;
  font-size: clamp(1.85rem, 4vw, 2.55rem);
  font-weight: 800;
  letter-spacing: -0.035em;
  line-height: 1.15;
  max-width: 18ch;
}

.card {
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow-soft);
}

.about__grid {
  display: grid;
  grid-template-columns: 1.4fr 0.8fr;
  gap: 2rem;
  align-items: start;
}

.about__copy p {
  margin: 0 0 1.1rem;
  color: var(--text-soft);
  font-size: 1.02rem;
  max-width: 58ch;
}

.about__copy strong {
  color: var(--text);
  font-weight: 600;
}

.about__meta {
  padding: 1.35rem 1.4rem;
  display: grid;
  gap: 1.1rem;
}

.meta-item__label {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 0.25rem;
}

.meta-item__value {
  font-weight: 600;
  font-size: 0.95rem;
}

.meta-item__value a:hover {
  color: var(--purple);
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.skill-card {
  padding: 1.25rem 1.2rem 1.35rem;
  transition: transform 0.25s, box-shadow 0.25s;
}

.skill-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow);
}

.skill-card__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.9rem;
  font-size: 0.98rem;
  font-weight: 700;
}

.skill-card__title::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--grad-btn);
  flex-shrink: 0;
}

.skill-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.skill-tag {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-soft);
  background: color-mix(in srgb, var(--bg) 70%, var(--bg-elevated));
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  padding: 0.35rem 0.7rem;
  transition: border-color 0.2s, color 0.2s, background 0.2s;
}

.skill-tag:hover {
  border-color: rgba(124, 92, 252, 0.4);
  color: var(--purple);
  background: rgba(124, 92, 252, 0.06);
}

.project-featured {
  padding: 1.75rem;
  margin-bottom: 1.25rem;
}

.project-featured__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: #d97706;
  background: rgba(251, 191, 36, 0.15);
  border: 1px solid rgba(251, 191, 36, 0.3);
  padding: 0.3rem 0.7rem;
  border-radius: var(--radius-pill);
  margin-bottom: 1rem;
}

.project-featured__name {
  margin: 0 0 0.5rem;
  font-size: 1.55rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.project-featured__meta {
  font-size: 0.85rem;
  color: var(--muted);
  margin-bottom: 0.85rem;
}

.project-featured__desc {
  margin: 0 0 1.1rem;
  color: var(--text-soft);
  max-width: 70ch;
}

.project-featured__points {
  margin: 0 0 1.25rem;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.55rem;
}

.project-featured__points li {
  display: grid;
  grid-template-columns: 2rem 1fr;
  gap: 0.5rem;
  color: var(--text-soft);
  font-size: 0.92rem;
}

.project-featured__points em {
  font-style: normal;
  font-weight: 700;
  color: var(--purple-soft);
  font-variant-numeric: tabular-nums;
}

.project-featured__stack-label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 0.55rem;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.project-card {
  padding: 1.3rem 1.2rem 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  transition: transform 0.25s, box-shadow 0.25s;
}

.project-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow);
}

.project-card__name {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.project-card__stack-line {
  font-size: 0.8rem;
  color: var(--purple-soft);
  font-weight: 500;
}

.project-card__desc {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-soft);
  flex: 1;
}

.project-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.35rem;
}

.project-card__tags span {
  font-size: 0.72rem;
  padding: 0.25rem 0.55rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line);
  color: var(--muted);
}

.exp-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 1rem;
  counter-reset: job;
}

.exp-item {
  padding: 1.4rem 1.4rem 1.5rem;
  counter-increment: job;
  position: relative;
  transition: transform 0.3s, box-shadow 0.3s, border-color 0.3s;
}

.reveal--stagger.is-in .exp-item:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow);
  border-color: rgba(124, 92, 252, 0.25);
}

.exp-item__top {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem 1.5rem;
  margin-bottom: 0.35rem;
}

.exp-item__role {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  display: flex;
  gap: 0.55rem;
  align-items: baseline;
}

.exp-item__role::before {
  content: counter(job) ".";
  color: var(--purple-soft);
  font-weight: 700;
}

.exp-item__period {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
}

.exp-item__company {
  margin: 0 0 0.9rem;
  color: var(--text-soft);
  font-size: 0.92rem;
}

.exp-item__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.45rem;
}

.exp-item__list li {
  color: var(--text-soft);
  font-size: 0.92rem;
  padding-left: 1.1rem;
  position: relative;
}

.exp-item__list li::before {
  content: "▸";
  position: absolute;
  left: 0;
  color: var(--purple-soft);
  font-size: 0.8rem;
}

.contact {
  padding-bottom: 3rem;
}

.contact__card {
  padding: 2.25rem 2rem;
  position: relative;
  overflow: hidden;
}

.contact__card::before {
  content: "";
  position: absolute;
  inset: auto -20% -40% 40%;
  height: 220px;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.18), transparent 70%);
  pointer-events: none;
}

.contact__eyebrow {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--purple-soft);
}

.contact__heading {
  margin: 0 0 0.65rem;
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 800;
  letter-spacing: -0.03em;
}

.contact__text {
  margin: 0 0 1.5rem;
  color: var(--text-soft);
  max-width: 48ch;
}

.contact__links {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
}

.contact__mail {
  font-size: 1.15rem;
  font-weight: 700;
  background: var(--grad);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.contact__mail:hover {
  filter: brightness(1.1);
}

.contact__mail:hover {
  filter: brightness(1.1);
}

.works {
  padding-bottom: 1.5rem;
}

.works-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.works-more {
  display: flex;
  justify-content: center;
  margin-top: 1.5rem;
}

.works-more__link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.65rem 1.25rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line);
  background: var(--bg-elevated);
  color: var(--purple);
  text-decoration: none;
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  box-shadow: var(--shadow-soft);
  transition:
    transform 0.2s,
    box-shadow 0.2s,
    border-color 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow);
    border-color: color-mix(in srgb, var(--purple) 35%, transparent);
  }
}

.work-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 236px;
  padding: 1.2rem 1.25rem 1.15rem;
  overflow: hidden;
  border-radius: var(--radius);
  border: 1px solid var(--line);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-soft);
  transition: transform 0.25s, box-shadow 0.25s;
}

.work-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow);
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
  border: 1px solid color-mix(in srgb, var(--purple) 28%, var(--line));
  background: color-mix(in srgb, var(--purple) 10%, transparent);
  white-space: nowrap;
}

.work-card__name {
  margin: 1.05rem 0 0.55rem;
  font-size: 1.4rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.work-card__desc {
  margin: 0;
  max-width: 34ch;
  color: var(--text-soft);
  font-size: 0.9rem;
  line-height: 1.65;
}

.work-card__go {
  margin-top: auto;
  padding-top: 1.1rem;
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--purple);
}

.work-card__arrow {
  display: inline-block;
  margin-left: 0.25rem;
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.work-card:hover .work-card__arrow {
  transform: translateX(6px);
}

.work-card__mark {
  position: absolute;
  right: 0.2rem;
  bottom: -0.55rem;
  z-index: 0;
  font-family: ui-serif, "Songti SC", "STSong", "SimSun", serif;
  font-size: 5.4rem;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.08em;
  color: var(--text);
  opacity: 0.06;
  pointer-events: none;
  user-select: none;
  transition: opacity 0.35s, transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

.work-card:hover .work-card__mark {
  opacity: 0.12;
  transform: translate(-4px, -6px) rotate(-4deg);
}

.work-card--ink {
  background:
    radial-gradient(360px 180px at 100% 0%, rgba(196, 148, 72, 0.16), transparent 60%),
    var(--bg-elevated);
}

.work-card--violet {
  background:
    radial-gradient(280px 160px at 100% 0%, rgba(124, 92, 252, 0.14), transparent 62%),
    var(--bg-elevated);
}

.work-card--violet .work-card__name {
  color: var(--text);
}

.work-card--cyan {
  background:
    radial-gradient(360px 180px at 100% 0%, rgba(34, 211, 238, 0.16), transparent 60%),
    var(--bg-elevated);
}

.work-card--amber {
  background:
    radial-gradient(360px 180px at 100% 0%, rgba(245, 158, 11, 0.18), transparent 60%),
    var(--bg-elevated);
}

.work-card--emerald {
  background:
    radial-gradient(360px 180px at 100% 0%, rgba(46, 196, 160, 0.18), transparent 60%),
    var(--bg-elevated);
}

.work-card--sky {
  background:
    radial-gradient(360px 180px at 100% 0%, rgba(59, 130, 246, 0.16), transparent 60%),
    var(--bg-elevated);
}

.work-card--rose {
  background:
    radial-gradient(360px 180px at 100% 0%, rgba(244, 114, 182, 0.18), transparent 60%),
    var(--bg-elevated);
}

.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 1.5rem 0 2.5rem;
  border-top: 1px solid var(--line);
  margin-top: 2rem;
  font-size: 0.82rem;
  color: var(--muted);
}

.footer__links {
  display: flex;
  gap: 1.1rem;
}

.footer__links a:hover {
  color: var(--purple);
}

.reveal {
  opacity: 0;
  transform: translateY(22px);
  transition: opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1), transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
}

.reveal.is-in {
  opacity: 1;
  transform: none;
}

.reveal--stagger .stagger-item {
  opacity: 0;
  transform: translateY(18px);
  transition:
    opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.55s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.25s,
    border-color 0.3s;
}

.reveal--stagger.is-in .stagger-item {
  opacity: 1;
  transform: none;
  transition-delay: calc(var(--i, 0) * 75ms);
}

.reveal--stagger.is-in .stagger-item:hover {
  transition-delay: 0ms;
}

.reveal--stagger.is-in .stat:hover {
  transform: translateY(-4px);
}

.reveal--stagger.is-in .work-card:hover {
  transform: translateY(-4px);
}

.reveal--stagger.is-in .skill-card:hover,
.reveal--stagger.is-in .project-card:hover {
  transform: translateY(-3px);
}

@media (max-width: 1120px) {
.nav__links {
    display: none;
  }

.nav__burger {
    display: flex;
  }

.admin-entry {
    display: none;
  }
}

@media (max-width: 980px) {
.nav__links {
    display: none;
  }

.nav__burger {
    display: flex;
  }

.nav__actions .btn--outline {
    display: none;
  }

.hero {
    grid-template-columns: 1fr;
    min-height: auto;
    padding-top: 2rem;
  }

.hero__right {
    order: -1;
  }

.hero__photo-wrap {
    width: min(100%, 260px);
  }

.hero__headline {
    max-width: none;
  }

.stats {
    grid-template-columns: repeat(2, 1fr);
  }

.about__grid,
.skills-grid,
.projects-grid,
.works-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {
.wrap {
    width: min(100% - 1.5rem, var(--max));
  }

.about__grid,
.skills-grid,
.projects-grid,
.works-grid {
    grid-template-columns: 1fr;
  }

.stats {
    grid-template-columns: 1fr 1fr;
  }

.nav__actions .btn--gradient {
    display: none;
  }
}

@media (min-width: 1440px) {
.hero {
    gap: 3rem;
    padding: 3.25rem 0 2.25rem;
  }

.hero__photo-wrap {
    width: min(100%, 340px);
  }

.stat {
    padding: 1.15rem 1.05rem;
  }

.stat__value {
    font-size: 1.7rem;
  }
}

@media (min-width: 1920px) {
.nav {
    height: var(--nav-h);
  }

.hero {
    gap: 3.25rem;
    padding: 3rem 0 2rem;
  }

.hero__name {
    font-size: 3.15rem;
  }

.hero__headline {
    font-size: 1.6rem;
    margin-bottom: 1rem;
  }

.hero__bio {
    font-size: 1rem;
    margin-bottom: 1.6rem;
  }

.hero__photo-wrap {
    width: min(100%, 320px);
  }

.badge {
    margin-bottom: 1.15rem;
  }

.stats {
    gap: 1rem;
    padding: 0.35rem 0 1.5rem;
  }

.stat {
    padding: 1.1rem 1rem;
  }

.stat__value {
    font-size: 1.55rem;
  }

.section {
    padding-top: 4.75rem;
  }
}

@media (min-width: 2560px) {
.hero {
    padding: 3.25rem 0 2.25rem;
    gap: 3.5rem;
  }

.hero__photo-wrap {
    width: min(100%, 340px);
  }

.hero__name {
    font-size: 3.25rem;
  }

.hero__headline {
    font-size: 1.65rem;
  }
}

@media (prefers-reduced-motion: reduce) {
.reveal,
.reveal--stagger .stagger-item,
.hero-enter {
    opacity: 1 !important;
    transform: none !important;
    animation: none !important;
  }

.hero__photo-wrap,
.hero__photo-wrap::before,
.nav__dot,
.badge__dot,
.hero__headline .grad {
    animation: none !important;
  }

.reveal.is-in .section__watermark {
    opacity: 0.04 !important;
    transform: none !important;
  }
}
`
