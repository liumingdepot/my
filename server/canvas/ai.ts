import type { AppEnv } from '../utils/env.js'
import {
  AGNES_IMAGE_MODEL,
  AGNES_TEXT_MODEL,
  AGNES_VIDEO_MODEL,
  DEFAULT_IMAGE_RATIO,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_VIDEO_ASPECT,
  DEFAULT_VIDEO_SECONDS,
  DEFAULT_VIDEO_SIZE,
  agnesFetchWithFailover,
  agnesFetchWithFailoverTracked,
  ensureAgnesReady,
  extractErrorMessage,
} from './agnes.js'

/** 创建视频时的 keyId 缓存，查询结果必须用同一把 key */
const videoKeyIdByVideoId = new Map<string, string>()

function rememberVideoKeyId(videoId: string, keyId: string) {
  const id = videoId.trim()
  const key = keyId.trim()
  if (!id || !key) return
  videoKeyIdByVideoId.set(id, key)
  // 防止无限增长
  if (videoKeyIdByVideoId.size > 2000) {
    const first = videoKeyIdByVideoId.keys().next().value
    if (first) videoKeyIdByVideoId.delete(first)
  }
}

function resolveVideoKeyId(videoId: string, fromClient?: string): string {
  const client = fromClient?.trim() || ''
  if (client) return client
  return videoKeyIdByVideoId.get(videoId.trim()) || ''
}

type ChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>
  error?: { message?: string }
}

type ImageResponse = {
  data?: Array<{ url?: string | null; b64_json?: string | null }>
  error?: { message?: string }
  detail?: string
}

type VideoCreateResponse = {
  id?: string
  task_id?: string
  video_id?: string
  status?: string
  error?: { message?: string } | string
  detail?: string
}

type VideoStatusResponse = {
  id?: string
  video_id?: string
  status?: string
  progress?: number
  url?: string | null
  metadata?: { url?: string | null }
  error?: { message?: string } | string | null
  detail?: string
}

const IMAGE_SIZES = new Set(['1K', '2K', '3K', '4K'])
const IMAGE_RATIOS = new Set(['1:1', '3:4', '4:3', '16:9', '9:16', '2:3', '3:2', '21:9'])
const VIDEO_ASPECTS = new Set(['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'])
const VIDEO_MODES = new Set(['text', 'keyframe', 'reference'])

const KIND_PROMPTS: Record<string, string> = {
  text: `你是短剧创作助手。根据用户提示，输出可直接用于下游生图/生视频的中文文本。
要求：80～400 字；具体、可视觉化；不要空泛套话。`,
  script: `你是短剧编剧。根据用户提示，写出一集可拍摄的短剧剧本片段。
要求：300～800 字；含场景提示、角色对白、简单动作；中文；不要 Markdown 标题堆砌。`,
  character: `你是短剧角色设定师。根据用户提示，写角色外貌、性格、口头禅与戏剧关系。
要求：120～280 字；中文；具体可视觉化；便于后续三视图设定；不要列表符号过多。`,
  scene: `你是短剧场景美术指导。根据用户提示，写场景时间、地点、光线、气氛与空间可拍细节。
硬性限制（必须遵守）：
1. 描述中绝对不能出现任何人物、角色、行人、剪影、人脸或生物；
2. 只写空间结构、建筑、陈设、材质、光线与气氛；
3. 适合后续「无人场景三视图」生图。
要求：100～240 字；中文；偏环境视觉描述。`,
  prop: `你是短剧道具设计师。根据用户提示，写道具外观、材质、尺寸感、用途与剧情意义。
硬性限制（必须遵守）：
1. 只描述该道具本身，绝对不能出现人物、手、手臂、持握动作或任何生物；
2. 不得写场景背景、地面、桌面杂物、文字水印或额外装饰堆砌；
3. 适合后续「纯白/浅灰背景的纯道具三视图」生图。
要求：80～200 字；中文；具体可画的单体道具。`,
  storyboard: `你是短剧分镜师。用户会要求你输出分镜 JSON 数组。
硬性规则：
1. 只输出合法 JSON 数组，不要 Markdown 代码围栏，不要前后说明文字；
2. 每个元素含 title、body；若用户提供了资产清单，再含 characters、scene、props；
3. characters/props 为数组，scene 为单个值或 null；值只能是资产序号（数字）或资产名称；
4. 绝对不要输出内部 id（如 character-xxx、scene-xxx、prop-xxx）；
5. title/body 使用通顺中文，写清景别、运镜、画面、对白；不要夹带 JSON 符号或字段名。`,
  image: `你是短剧视觉提示词助手。把用户内容整理成适合生图的中文画面描述。
要求：80～200 字；突出主体、光线、构图、风格。`,
  video: `你是短剧镜头提示词助手。把用户内容整理成适合生视频的中文镜头描述。
要求：60～180 字；含运动与气氛。`,
  default: `你是短剧创作助手。根据用户提示输出可直接使用的中文创作内容，简洁具体。`,
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

async function requireKeys(env: AppEnv) {
  if (!(await ensureAgnesReady(env))) {
    return { error: json({ error: '未配置 AGNES 密钥，请到后台「密钥管理」添加' }, 500) as Response }
  }
  return { ok: true as const }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

export async function handleCanvasTextAi(request: Request, env: AppEnv) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ error: '请求格式不正确' }, 400)
  }

  const prompt = asString(body.prompt)
  if (!prompt) return json({ error: '请填写提示词' }, 400)

  const kind = asString(body.kind) || 'default'
  const system = KIND_PROMPTS[kind] || KIND_PROMPTS.default
  const context = asString(body.context)
  const title = asString(body.title)

  const keyed = await requireKeys(env)
  if ('error' in keyed) return keyed.error

  try {
    const response = await agnesFetchWithFailover(
      env,
      (ep) => `${ep.chatBase}/chat/completions`,
      {
        method: 'POST',
        timeoutMs: 90_000,
        body: JSON.stringify({
          model: AGNES_TEXT_MODEL,
          messages: [
            { role: 'system', content: system },
            {
              role: 'user',
              content: [
                title ? `标题：${title}` : '',
                context ? `已有内容：\n${context}` : '',
                `用户提示：\n${prompt}`,
              ]
                .filter(Boolean)
                .join('\n\n'),
            },
          ],
        }),
      },
    )

    const data = (await response.json()) as ChatResponse
    if (!response.ok) {
      return json(
        { error: extractErrorMessage(data, '文本生成失败') },
        response.status >= 400 && response.status < 600 ? response.status : 502,
      )
    }

    const text = data.choices?.[0]?.message?.content?.trim()
    if (!text) return json({ error: '模型未返回内容' }, 502)

    return json({
      text,
      model: AGNES_TEXT_MODEL,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '文本生成失败'
    return json({ error: message.includes('timeout') ? '文本生成超时' : message || '文本生成失败' }, 502)
  }
}

export async function handleCanvasImageAi(request: Request, env: AppEnv) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ error: '请求格式不正确' }, 400)
  }

  const prompt = asString(body.prompt)
  if (!prompt) return json({ error: '请填写提示词' }, 400)

  const sizeRaw = asString(body.size).toUpperCase() || DEFAULT_IMAGE_SIZE
  const size = IMAGE_SIZES.has(sizeRaw) ? sizeRaw : DEFAULT_IMAGE_SIZE
  const ratioRaw = asString(body.ratio) || DEFAULT_IMAGE_RATIO
  const ratio = IMAGE_RATIOS.has(ratioRaw) ? ratioRaw : DEFAULT_IMAGE_RATIO
  const images = asStringArray(body.images)

  const keyed = await requireKeys(env)
  if ('error' in keyed) return keyed.error

  const payload: Record<string, unknown> = {
    model: AGNES_IMAGE_MODEL,
    prompt,
    size,
    ratio,
    extra_body: {
      response_format: 'url',
      ...(images.length ? { image: images } : {}),
    },
  }

  try {
    const response = await agnesFetchWithFailover(
      env,
      (ep) => `${ep.mediaBase}/images/generations`,
      {
        method: 'POST',
        timeoutMs: 180_000,
        body: JSON.stringify(payload),
      },
    )

    const data = (await response.json()) as ImageResponse
    if (!response.ok) {
      return json(
        { error: extractErrorMessage(data, '图片生成失败') },
        response.status >= 400 && response.status < 600 ? response.status : 502,
      )
    }

    const first = data.data?.[0]
    const url =
      (typeof first?.url === 'string' && first.url) ||
      (typeof first?.b64_json === 'string' && first.b64_json
        ? `data:image/png;base64,${first.b64_json}`
        : '')
    if (!url) return json({ error: '模型未返回图片' }, 502)

    return json({
      url,
      model: AGNES_IMAGE_MODEL,
      size,
      ratio,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '图片生成失败'
    return json({ error: message.includes('timeout') ? '图片生成超时' : message || '图片生成失败' }, 502)
  }
}

export async function handleCanvasVideoCreate(request: Request, env: AppEnv) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ error: '请求格式不正确' }, 400)
  }

  const prompt = asString(body.prompt)
  if (!prompt) return json({ error: '请填写提示词' }, 400)

  const modeRaw = asString(body.mode) || 'text'
  const mode = VIDEO_MODES.has(modeRaw) ? modeRaw : 'text'
  const aspectRaw = asString(body.aspectRatio) || asString(body.aspect_ratio) || DEFAULT_VIDEO_ASPECT
  const aspect_ratio = VIDEO_ASPECTS.has(aspectRaw) ? aspectRaw : DEFAULT_VIDEO_ASPECT
  let seconds = asString(body.seconds) || DEFAULT_VIDEO_SECONDS
  const secNum = Number(seconds)
  if (!Number.isFinite(secNum) || secNum < 4 || secNum > 12) seconds = DEFAULT_VIDEO_SECONDS

  const first_frame = asString(body.firstFrame || body.first_frame)
  const last_frame = asString(body.lastFrame || body.last_frame)
  const images = asStringArray(body.images)

  if (mode === 'keyframe' && !first_frame && !last_frame) {
    return json({ error: '关键帧模式需要提供首帧或尾帧图片' }, 400)
  }
  if (mode === 'reference' && !images.length) {
    return json({ error: '参考图模式至少需要一张参考图' }, 400)
  }

  const keyed = await requireKeys(env)
  if ('error' in keyed) return keyed.error

  const payload: Record<string, unknown> = {
    model: AGNES_VIDEO_MODEL,
    prompt,
    mode,
    seconds,
    size: DEFAULT_VIDEO_SIZE,
    aspect_ratio,
    n: 1,
  }
  if (mode === 'keyframe') {
    if (first_frame) payload.first_frame = first_frame
    if (last_frame) payload.last_frame = last_frame
  }
  if (mode === 'reference') {
    payload.images = images.slice(0, 5)
  }

  try {
    const { response, credential } = await agnesFetchWithFailoverTracked(
      env,
      (ep) => `${ep.mediaBase}/videos`,
      {
        method: 'POST',
        timeoutMs: 60_000,
        body: JSON.stringify(payload),
      },
    )

    const data = (await response.json()) as VideoCreateResponse
    if (!response.ok) {
      return json(
        { error: extractErrorMessage(data, '视频任务创建失败') },
        response.status >= 400 && response.status < 600 ? response.status : 502,
      )
    }

    const videoId = asString(data.video_id)
    if (!videoId) return json({ error: '未返回 video_id' }, 502)

    rememberVideoKeyId(videoId, credential.id)

    return json({
      videoId,
      keyId: credential.id,
      taskId: asString(data.task_id) || asString(data.id),
      status: asString(data.status) || 'queued',
      model: AGNES_VIDEO_MODEL,
      size: DEFAULT_VIDEO_SIZE,
      aspectRatio: aspect_ratio,
      seconds,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '视频任务创建失败'
    return json(
      { error: message.includes('timeout') ? '视频任务创建超时' : message || '视频任务创建失败' },
      502,
    )
  }
}

export async function handleCanvasVideoStatus(
  request: Request,
  env: AppEnv,
  videoId: string,
) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  if (!videoId.trim()) return json({ error: '缺少 video_id' }, 400)

  const url = new URL(request.url)
  const keyId = resolveVideoKeyId(videoId, asString(url.searchParams.get('keyId')))
  if (!keyId) {
    return json(
      { error: '缺少 keyId：查询视频结果必须使用创建时同一把密钥' },
      400,
    )
  }

  const keyed = await requireKeys(env)
  if ('error' in keyed) return keyed.error

  try {
    const { response, credential } = await agnesFetchWithFailoverTracked(
      env,
      (ep) => {
        const q = new URL(`${ep.mediaHost}/agnesapi`)
        q.searchParams.set('video_id', videoId)
        q.searchParams.set('model_name', AGNES_VIDEO_MODEL)
        return q.toString()
      },
      {
        method: 'GET',
        timeoutMs: 30_000,
      },
      { preferKeyId: keyId, allowFailover: false },
    )
    const data = (await response.json()) as VideoStatusResponse
    if (!response.ok) {
      return json(
        { error: extractErrorMessage(data, '查询视频状态失败') },
        response.status >= 400 && response.status < 600 ? response.status : 502,
      )
    }

    const status = asString(data.status) || 'queued'
    const mediaUrl =
      asString(data.url) ||
      (data.metadata && typeof data.metadata.url === 'string' ? data.metadata.url : '')

    let errorMsg = ''
    if (data.error && typeof data.error === 'object' && data.error) {
      errorMsg = asString((data.error as { message?: string }).message)
    } else if (typeof data.error === 'string') {
      errorMsg = data.error
    }

    rememberVideoKeyId(videoId, credential.id)

    return json({
      videoId,
      keyId: credential.id,
      status,
      progress: typeof data.progress === 'number' ? data.progress : undefined,
      url: mediaUrl || undefined,
      error: status === 'failed' ? errorMsg || '视频生成失败' : undefined,
      model: AGNES_VIDEO_MODEL,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询视频状态失败'
    return json(
      { error: message.includes('timeout') ? '查询视频状态超时' : message || '查询视频状态失败' },
      502,
    )
  }
}
