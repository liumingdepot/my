import { handleBazi } from './八字精批.js'
import { handleCasual } from './随便算算.js'
import { handleHome } from './首页.js'

export interface FortuneEnv {
  KV: KVNamespace
  /** 单个或多个 key，逗号 / 换行分隔，每次调用轮询 */
  AGNES_API_KEY?: string
}

export async function handleFortuneApi(request: Request, env: FortuneEnv) {
  const { pathname } = new URL(request.url)
  if (pathname === '/api/home') return handleHome(request, env)
  if (pathname === '/api/bazi') return handleBazi(request, env)
  return handleCasual(request, env)
}
