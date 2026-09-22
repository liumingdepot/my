import type { FortuneEnv } from './api.js'

export function handleHome(_request: Request, _env: FortuneEnv) {
  return text('首页暂无接口', 404)
}

function text(message: string, status = 200) {
  return new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
