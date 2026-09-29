import { useLayoutEffect, useState } from 'react'
import { createGlobalStyle } from 'styled-components'
import HomePage from './model/HomePage'
import SimStage from './model/SimStage'
import type { SimId } from './utils/catalog'

/** 清掉其他模块可能残留的 100dvh + overflow:hidden，恢复文档滚动 */
const Global = createGlobalStyle`
  html,
  body,
  #root {
    height: auto !important;
    max-height: none !important;
    position: static !important;
    top: auto !important;
    width: auto !important;
  }

  html,
  body {
    overflow-x: hidden;
    overflow-y: auto;
  }

  body {
    margin: 0;
  }
`

export default function FishPage() {
  const [active, setActive] = useState<SimId | null>(null)

  useLayoutEffect(() => {
    document.body.classList.remove('site-home')
    document.title = '铭摸鱼 · 摸鱼助手'

    const html = document.documentElement
    const body = document.body
    html.style.height = ''
    html.style.maxHeight = ''
    html.style.overflow = ''
    body.style.height = ''
    body.style.maxHeight = ''
    body.style.overflow = ''
    body.style.position = ''
    body.style.top = ''
    body.style.width = ''
  }, [])

  return (
    <>
      <Global />
      <HomePage onLaunch={setActive} />
      {active ? <SimStage id={active} onExit={() => setActive(null)} /> : null}
    </>
  )
}
