export type CanvasProject = {
  id: string
  title: string
  prompt: string
  content: string
  createdAt: string
  updatedAt: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`)
  }
  return data
}

export function listProjects() {
  return request<{ items: CanvasProject[] }>('/api/canvas/projects')
}

export function getProject(id: string) {
  return request<{ item: CanvasProject }>(`/api/canvas/projects/${encodeURIComponent(id)}`)
}

export function createProject(input?: { title?: string; prompt?: string; content?: string }) {
  return request<{ item: CanvasProject }>('/api/canvas/projects', {
    method: 'POST',
    body: JSON.stringify(input || {}),
  })
}

export function updateProject(
  id: string,
  input: { title?: string; prompt?: string; content?: string },
) {
  return request<{ item: CanvasProject }>(`/api/canvas/projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteProject(id: string) {
  return request<{ ok: boolean }>(`/api/canvas/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export type CanvasTextAiResult = {
  text: string
  model: string
}

export type CanvasImageAiResult = {
  url: string
  model: string
  size: string
  ratio: string
}

export type CanvasVideoCreateResult = {
  videoId: string
  /** 创建任务用的密钥 id，查询状态必须带回 */
  keyId: string
  taskId?: string
  status: string
  model: string
  size: string
  aspectRatio: string
  seconds: string
}

export type CanvasVideoStatusResult = {
  videoId: string
  keyId?: string
  status: string
  progress?: number
  url?: string
  error?: string
  model: string
}

export function generateCanvasText(input: {
  prompt: string
  kind?: string
  title?: string
  context?: string
}) {
  return request<CanvasTextAiResult>('/api/canvas/ai/text', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function generateCanvasImage(input: {
  prompt: string
  size?: string
  ratio?: string
  images?: string[]
}) {
  return request<CanvasImageAiResult>('/api/canvas/ai/image', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function createCanvasVideo(input: {
  prompt: string
  mode?: 'text' | 'keyframe' | 'reference'
  seconds?: string
  aspectRatio?: string
  firstFrame?: string
  lastFrame?: string
  images?: string[]
}) {
  return request<CanvasVideoCreateResult>('/api/canvas/ai/video', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getCanvasVideoStatus(videoId: string, keyId: string) {
  const qs = new URLSearchParams({ keyId })
  return request<CanvasVideoStatusResult>(
    `/api/canvas/ai/video/${encodeURIComponent(videoId)}?${qs.toString()}`,
  )
}

/** 轮询直到 completed / failed，或超时；必须用创建时同一 keyId */
export async function waitCanvasVideo(
  videoId: string,
  keyId: string,
  options?: {
    intervalMs?: number
    timeoutMs?: number
    signal?: AbortSignal
    onProgress?: (status: CanvasVideoStatusResult) => void
  },
): Promise<CanvasVideoStatusResult> {
  if (!keyId.trim()) throw new Error('缺少 keyId，无法查询视频结果')
  const intervalMs = options?.intervalMs ?? 5000
  const timeoutMs = options?.timeoutMs ?? 300_000
  const started = Date.now()
  let rateLimitHits = 0

  const wait = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, ms)
      options?.signal?.addEventListener(
        'abort',
        () => {
          window.clearTimeout(timer)
          reject(new Error('已取消'))
        },
        { once: true },
      )
    })

  while (true) {
    if (options?.signal?.aborted) throw new Error('已取消')
    try {
      const status = await getCanvasVideoStatus(videoId, keyId)
      rateLimitHits = 0
      options?.onProgress?.(status)
      if (status.status === 'completed') {
        if (!status.url) throw new Error('视频已完成但未返回地址')
        return status
      }
      if (status.status === 'failed') {
        throw new Error(status.error || '视频生成失败')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === '已取消') throw err
      // 查询限频：拉长间隔后继续轮询，不立刻判失败
      if (/过于频繁|请稍后重试|rate.?limit|too many|429/i.test(msg)) {
        rateLimitHits += 1
        if (rateLimitHits > 8) throw err
        const backoff = Math.min(30_000, intervalMs * (1 + rateLimitHits))
        await wait(backoff)
        continue
      }
      throw err
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error('视频生成超时，请稍后在节点中重试查询')
    }
    await wait(intervalMs)
  }
}

export function formatRelativeTime(iso: string): string {
  const ts = Date.parse(iso)
  if (!Number.isFinite(ts)) return ''
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return new Date(ts).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
