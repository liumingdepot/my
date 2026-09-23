import type { FortuneEnv } from './fortune/api.js'
import { isFortuneApi } from './fortune/route.js'
import type { AdminEnv } from './admin/types.js'
import { handleAdminApi, isAdminApi } from './admin/api.js'

export type Env = AdminEnv & FortuneEnv

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (isAdminApi(url.pathname)) {
      return handleAdminApi(request, env)
    }

    if (url.pathname.startsWith('/api/music')) {
      const { handleMusicApi } = await import('./music/api.js')
      return handleMusicApi(request, url, env)
    }

    if (url.pathname.startsWith('/api/video')) {
      const { handleVideoApi } = await import('./video/api.js')
      return handleVideoApi(request, url, env)
    }

    if (url.pathname.startsWith('/api/game')) {
      const { handleGameApi } = await import('./game/api.js')
      return handleGameApi(request, url, env)
    }

    if (url.pathname.startsWith('/api/education')) {
      const { handleEducationApi } = await import('./education/api.js')
      return handleEducationApi(request, url, env)
    }

    if (isFortuneApi(url.pathname)) {
      const { handleFortuneApi } = await import('./fortune/api.js')
      return handleFortuneApi(request, env)
    }

    return new Response(null, { status: 404 })
  },
} satisfies ExportedHandler<Env>
