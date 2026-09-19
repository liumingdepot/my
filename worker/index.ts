import type { FortuneEnv } from './fortune/api.js'
import { isFortuneApi } from './fortune/route.js'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/music')) {
      const { handleMusicApi } = await import('./music/api.js')
      return handleMusicApi(request, url)
    }

    if (url.pathname.startsWith('/api/video')) {
      const { handleVideoApi } = await import('./video/api.js')
      return handleVideoApi(request, url)
    }

    if (isFortuneApi(url.pathname)) {
      const { handleFortuneApi } = await import('./fortune/api.js')
      return handleFortuneApi(request, env)
    }

    return new Response(null, { status: 404 })
  },
} satisfies ExportedHandler<FortuneEnv>
