import { json } from '../admin/types.js'
import type { AdminEnv } from '../admin/types.js'
import { listWorks } from './works.js'

/** 前台公开接口：作品集「项目经历」列表 */
export async function handleWorksApi(request: Request, env: AdminEnv) {
  if (request.method.toUpperCase() !== 'GET') {
    return json({ error: 'Not found' }, 404)
  }

  const works = await listWorks(env.DB, { enabledOnly: true })
  return json({ works })
}