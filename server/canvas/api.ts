import type { AppEnv } from '../utils/env.js'
import {
  handleCanvasImageAi,
  handleCanvasTextAi,
  handleCanvasVideoCreate,
  handleCanvasVideoStatus,
} from './ai.js'

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export function isCanvasApi(pathname: string) {
  return pathname === '/api/canvas' || pathname.startsWith('/api/canvas/')
}

function videoIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/api\/canvas\/ai\/video\/([^/]+)$/)
  return m ? decodeURIComponent(m[1]) : null
}

/** 仅保留 AI 生成接口；历史项目已改为纯前端 localStorage，不落库 */
export async function handleCanvasApi(
  request: Request,
  url: URL,
  env: AppEnv,
) {
  const { pathname } = url

  if (pathname === '/api/canvas/ai/text') {
    return handleCanvasTextAi(request, env)
  }
  if (pathname === '/api/canvas/ai/image') {
    return handleCanvasImageAi(request, env)
  }
  if (pathname === '/api/canvas/ai/video') {
    return handleCanvasVideoCreate(request, env)
  }
  const videoId = videoIdFromPath(pathname)
  if (videoId) {
    return handleCanvasVideoStatus(request, env, videoId)
  }

  return json({ error: 'Not found' }, 404)
}
