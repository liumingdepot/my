import { useLayoutEffect } from 'react'
import { Link } from 'react-router'
import AncientClock from './AncientClock'
import ConsultForm from './ConsultForm'
import { t } from './i18n'
import './suanming.css'

export default function SuanmingPage() {
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

  return (
    <div className="suanming">
      <main className="page">
        <p className="spine">{t.spine}</p>
        <section className="copy">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>
            <span>{t.titleA}</span>
            <span>{t.titleB}</span>
          </h1>
          <p className="lead">{t.lead}</p>
          <div className="rule" />
          <p className="body">{t.body}</p>
          <p className="source">{t.source}</p>
          <p className="author">{t.author}</p>
          <Link className="back-link" to="/">
            {t.backHome}
          </Link>
        </section>
        <section className="clock-pane" aria-label={t.clockLabel}>
          <AncientClock />
        </section>
        <a className="scroll-cue" href="#consult">
          {t.scroll}
        </a>
      </main>
      <ConsultForm />
    </div>
  )
}
