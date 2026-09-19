import { useLayoutEffect } from 'react'
import { Link } from 'react-router'
import AncientClock from './AncientClock'
import ConsultForm from './ConsultForm'
import './suanming.css'

export default function SuanmingPage() {
  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = '周易'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0b0a09')
  }, [])

  return (
    <div className="suanming">
      <main className="page">
        <p className="spine">天行健，君子以自强不息</p>
        <section className="copy">
          <p className="eyebrow">观象于天</p>
          <h1>
            <span>周</span>
            <span>易</span>
          </h1>
          <p className="lead">一阴一阳之谓道</p>
          <div className="rule" />
          <p className="body">易与天地准，故能弥纶天地之道。</p>
          <p className="source">系辞 · 上传</p>
          <p className="author">作者：刘铭</p>
          <Link className="back-link" to="/">
            返回首页
          </Link>
        </section>
        <section className="clock-pane" aria-label="古代时辰钟">
          <AncientClock />
        </section>
        <a className="scroll-cue" href="#consult">
          向下填写生辰
        </a>
      </main>
      <ConsultForm />
    </div>
  )
}
