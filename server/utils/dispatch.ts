import type { FortuneEnv } from '../fortune/api.js'
import { isFortuneApi } from '../fortune/route.js'
import type { AdminEnv } from '../admin/types.js'
import { handleAdminApi, isAdminApi } from '../admin/api.js'
import type { AppEnv } from './env.js'

export type DispatchEnv = AdminEnv & FortuneEnv

export async function dispatchApi(request: Request, env: AppEnv): Promise<Response> {
  const url = new URL(request.url)

  if (isAdminApi(url.pathname)) {
    return handleAdminApi(request, env)
  }

  if (url.pathname.startsWith('/api/music')) {
    const { handleMusicApi } = await import('../music/api.js')
    return handleMusicApi(request, url)
  }

  if (url.pathname.startsWith('/api/video')) {
    const { handleVideoApi } = await import('../video/api.js')
    return handleVideoApi(request, url, env)
  }

  if (url.pathname.startsWith('/api/game')) {
    const { handleGameApi } = await import('../game/api.js')
    return handleGameApi(request, url, env)
  }

  if (url.pathname.startsWith('/api/education')) {
    const { handleEducationApi } = await import('../education/api.js')
    return handleEducationApi(request, url, env)
  }

  if (url.pathname.startsWith('/api/hongguo')) {
    const { handleHongguoApi } = await import('../hongguo/api.js')
    return handleHongguoApi(request, url)
  }

  if (url.pathname.startsWith('/api/test')) {
    const { handleTestApi } = await import('../test/api.js')
    return handleTestApi(request, url)
  }

  if (url.pathname.startsWith('/api/canvas')) {
    const { handleCanvasApi } = await import('../canvas/api.js')
    return handleCanvasApi(request, url, env)
  }

  if (isFortuneApi(url.pathname)) {
    const { handleFortuneApi } = await import('../fortune/api.js')
    return handleFortuneApi(request, env)
  }

  return new Response(null, { status: 404 })
}
