import type { AppEnv } from '../utils/env.js'
import {
  handleCanvasImageAi,
  handleCanvasTextAi,
  handleCanvasVideoCreate,
  handleCanvasVideoStatus,
} from './ai.js'
import {
  createCanvasProject,
  deleteCanvasProject,
  findCanvasProjectById,
  listCanvasProjects,
  updateCanvasProject,
} from './projects.js'

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export function isCanvasApi(pathname: string) {
  return pathname === '/api/canvas' || pathname.startsWith('/api/canvas/')
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const data = await request.json()
    return data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function projectIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/api\/canvas\/projects\/([^/]+)$/)
  return m ? decodeURIComponent(m[1]) : null
}

function videoIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/api\/canvas\/ai\/video\/([^/]+)$/)
  return m ? decodeURIComponent(m[1]) : null
}

export async function handleCanvasApi(
  request: Request,
  url: URL,
  env: AppEnv,
) {
  const { pathname } = url
  const method = request.method.toUpperCase()

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

  if (pathname === '/api/canvas/projects') {
    if (method === 'GET') {
      const items = await listCanvasProjects(env.DB)
      return json({ items })
    }
    if (method === 'POST') {
      const body = await readBody(request)
      const item = await createCanvasProject(env.DB, {
        title: typeof body.title === 'string' ? body.title : undefined,
        prompt: typeof body.prompt === 'string' ? body.prompt : undefined,
        content: typeof body.content === 'string' ? body.content : undefined,
      })
      return json({ item }, 201)
    }
    return json({ error: 'Method not allowed' }, 405)
  }

  const id = projectIdFromPath(pathname)
  if (id) {
    if (method === 'GET') {
      const item = await findCanvasProjectById(env.DB, id)
      if (!item) return json({ error: 'Not found' }, 404)
      return json({ item })
    }
    if (method === 'PATCH' || method === 'PUT') {
      const body = await readBody(request)
      const item = await updateCanvasProject(env.DB, id, {
        title: typeof body.title === 'string' ? body.title : undefined,
        prompt: typeof body.prompt === 'string' ? body.prompt : undefined,
        content: typeof body.content === 'string' ? body.content : undefined,
      })
      if (!item) return json({ error: 'Not found' }, 404)
      return json({ item })
    }
    if (method === 'DELETE') {
      const ok = await deleteCanvasProject(env.DB, id)
      if (!ok) return json({ error: 'Not found' }, 404)
      return json({ ok: true })
    }
    return json({ error: 'Method not allowed' }, 405)
  }

  return json({ error: 'Not found' }, 404)
}
