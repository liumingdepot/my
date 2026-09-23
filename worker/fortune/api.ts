import { handleBazi } from './八字精批.js'
import { handleHehun } from './合婚配对.js'
import { handleLiunian } from './流年运势.js'
import { handleLots } from './在线抽签.js'
import { handleCasual } from './随便算算.js'

export interface FortuneEnv {
  KV: KVNamespace
  /** 单个或多个 key，逗号 / 换行分隔，每次调用轮询 */
  AGNES_API_KEY?: string
}

export async function handleFortuneApi(request: Request, env: FortuneEnv) {
  const { pathname } = new URL(request.url)
  if (pathname === '/api/lots') return handleLots(request, env)
  if (pathname === '/api/bazi') return handleBazi(request, env)
  if (pathname === '/api/hehun') return handleHehun(request, env)
  if (pathname === '/api/liunian') return handleLiunian(request, env)
  return handleCasual(request, env)
}
