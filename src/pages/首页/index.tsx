import { useEffect, useLayoutEffect, useState } from 'react'
import { Link } from 'react-router'
import { I18N } from './i18n'
import './home.css'

type Lang = keyof typeof I18N

const NAV = [
  { id: 'about', key: 'about', n: '01' },
  { id: 'skills', key: 'skills', n: '02' },
  { id: 'projects', key: 'projects', n: '03' },
  { id: 'experience', key: 'experience', n: '04' },
  { id: 'contact', key: 'contact', n: '05' },
  { id: 'works', key: 'works', n: '06' },
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

export default function Home() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('lang') === 'en' ? 'en' : 'zh'))
  const [theme, setTheme] = useState(() => (localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'))
  const [menuOpen, setMenuOpen] = useState(false)
  const t = I18N[lang]
  const ui = t.ui
  const featured = t.projects.find((project) => 'featured' in project && project.featured)
  const projects = t.projects.filter((project) => project !== featured)

  useLayoutEffect(() => {
    document.body.classList.add('site-home')
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
    document.documentElement.dataset.theme = theme
    document.title = lang === 'zh' ? '刘铭 · 前端开发' : 'Liu Ming · Frontend'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b1020' : '#f5f6fb')
    localStorage.setItem('lang', lang)
    localStorage.setItem('theme', theme)
    return () => {
      document.body.classList.remove('site-home')
    }
  }, [lang, theme])

  useEffect(() => {
    const nav = document.querySelector('.nav')
    const onScroll = () => nav?.classList.toggle('is-scrolled', window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const nodes = document.querySelectorAll('.reveal')
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-in')
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.12 },
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [lang])

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <>
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
        </div>
        <div className="nav__actions">
          <button
            className="lang-toggle"
            type="button"
            title={ui.langTitle}
            onClick={() => setLang((current) => (current === 'zh' ? 'en' : 'zh'))}
          >
            {ui.lang}
          </button>
          <button
            className="theme-toggle"
            type="button"
            aria-label={ui.theme}
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          >
            <SunIcon />
            <MoonIcon />
          </button>
          <a className="btn btn--outline" href={t.profile.resume} target="_blank" rel="noreferrer">
            {ui.resume}
          </a>
          <a className="btn btn--gradient" href="#contact">
            {ui.hireMe}
          </a>
          <button
            className="nav__burger"
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

      <div className="mobile-menu" hidden={!menuOpen}>
        {NAV.map((item) => (
          <a key={item.id} href={`#${item.id}`} onClick={closeMenu}>
            {ui.nav[item.key]}
          </a>
        ))}
        <a href={t.profile.resume} target="_blank" rel="noreferrer" onClick={closeMenu}>
          {ui.resume}
        </a>
      </div>

      <div className="wrap" id="top">
        <section className="hero">
          <div>
            <p className="badge">
              <span className="badge__dot" />
              {t.profile.available}
            </p>
            <h1 className="hero__name">{t.profile.name}</h1>
            <p className="hero__headline" dangerouslySetInnerHTML={{ __html: t.profile.headlineHtml }} />
            <p className="hero__bio">{t.profile.bio}</p>
            <div className="hero__cta">
              <a className="btn btn--gradient btn--lg" href="#projects">
                {ui.viewProjects}
              </a>
              <a className="btn btn--soft btn--lg" href="#contact">
                {ui.getInTouch}
              </a>
            </div>
            <div className="hero__social">
              <a href={`tel:${t.profile.phone}`}>{ui.phone}</a>
              <a href={t.profile.resume} target="_blank" rel="noreferrer">
                {ui.resumeLink}
              </a>
            </div>
          </div>
          <div className="hero__right">
            <div className="hero__photo-wrap">
              <img className="hero__photo" src={t.profile.photo} alt={t.profile.name} />
            </div>
          </div>
        </section>

        <section className="stats" aria-label={lang === 'zh' ? '概览' : 'Overview'}>
          {t.stats.map((stat) => (
            <div className="stat" key={stat.label}>
              <div className="stat__value">{stat.value}</div>
              <div className="stat__label">{stat.label}</div>
            </div>
          ))}
        </section>

        <section className="section reveal" id="about">
          <div className="section__watermark">01</div>
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

        <section className="section reveal" id="skills">
          <div className="section__watermark">02</div>
          <p className="section__label">{ui.sectionSkills}</p>
          <h2 className="section__title">{ui.skillsTitle}</h2>
          <div className="skills-grid">
            {t.skills.map((group) => (
              <article className="skill-card card" key={group.category}>
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

        <section className="section reveal" id="projects">
          <div className="section__watermark">03</div>
          <p className="section__label">{ui.sectionProjects}</p>
          <h2 className="section__title">{ui.projectsTitle}</h2>
          {featured ? (
            <article className="project-featured card">
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
              <article className="project-card card" key={project.name}>
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

        <section className="section reveal" id="experience">
          <div className="section__watermark">04</div>
          <p className="section__label">{ui.sectionExperience}</p>
          <h2 className="section__title">{ui.experienceTitle}</h2>
          <ol className="exp-list">
            {t.experience.map((job) => (
              <li className="exp-item card" key={job.company}>
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
          <div className="section__watermark">05</div>
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

        <section className="section works reveal" id="works">
          <div className="section__watermark">06</div>
          <p className="section__label">{ui.sectionWorks}</p>
          <h2 className="section__title">{ui.worksTitle}</h2>
          <ul className="works-grid">
            {t.works.map((work, index) => {
              const card = (
                <>
                  <div className="work-card__top">
                    <span className="work-card__index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="work-card__tag">{work.tag}</span>
                  </div>
                  <h3 className="work-card__name">{work.name}</h3>
                  <p className="work-card__desc">{work.desc}</p>
                  <span className="work-card__go">{ui.workOpen}</span>
                  <span className="work-card__mark" aria-hidden="true">
                    {work.glyph}
                  </span>
                </>
              )
              const className = `work-card work-card--${work.tone}`
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
        </section>

        <footer className="footer">
          <span>
            © {new Date().getFullYear()} {ui.footerCopy}
          </span>
          <div className="footer__links">
            <a href="#about">{ui.nav.about}</a>
            <a href="#projects">{ui.nav.projects}</a>
            <a href="#contact">{ui.nav.contact}</a>
            <a href="#works">{ui.nav.works}</a>
          </div>
        </footer>
      </div>
    </>
  )
}
