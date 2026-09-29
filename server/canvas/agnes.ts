import type { AgnesCredential } from '../admin/agnesKeys.js'
import { resolveAgnesEndpoints } from '../admin/agnesKeys.js'
import {
  hasAgnesCredentials,
  loadAgnesCredentials,
  rotateAgnesCredentials,
} from '../fortune/agnesKey.js'
import type { AppEnv } from '../utils/env.js'

export const AGNES_TEXT_MODEL = 'agnes-2.5-flash'
export const AGNES_IMAGE_MODEL = 'agnes-image-2.5-flash'
export const AGNES_VIDEO_MODEL = 'agnes-video-2.5-flash'

export const DEFAULT_IMAGE_SIZE = '1K'
export const DEFAULT_IMAGE_RATIO = '9:16'
export const DEFAULT_VIDEO_SIZE = '720P'
export const DEFAULT_VIDEO_ASPECT = '9:16'
export const DEFAULT_VIDEO_SECONDS = '5'

export type AgnesEndpoints = ReturnType<typeof resolveAgnesEndpoints>

export async function agnesFetch(
  url: string,
  apiKey: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 120_000, ...rest } = init
  return fetch(url, {
    ...rest,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(rest.headers || {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
  })
}

/**
 * 多凭证故障切换：优先数据库密钥，按每条记录的 Base URL 请求。
 * 返回实际成功的凭证，便于视频查询等必须绑同一 key 的场景。
 */
export async function agnesFetchWithFailoverTracked(
  env: AppEnv,
  buildUrl: (endpoints: AgnesEndpoints, cred: AgnesCredential) => string,
  init: RequestInit & { timeoutMs?: number } = {},
  options?: { preferKeyId?: string; /** 指定 key 时是否仍允许切到其他 key */ allowFailover?: boolean },
): Promise<{ response: Response; credential: AgnesCredential }> {
  const all = await loadAgnesCredentials(env)
  if (!all.length) {
    throw new Error('未配置 AGNES_API_KEY')
  }

  let credentials: AgnesCredential[]
  const preferKeyId = options?.preferKeyId?.trim()
  if (preferKeyId) {
    const preferred = all.find((c) => c.id === preferKeyId)
    if (!preferred) {
      throw new Error(`指定的 AGNES 密钥不存在或已禁用：${preferKeyId}`)
    }
    credentials =
      options?.allowFailover === false
        ? [preferred]
        : [preferred, ...all.filter((c) => c.id !== preferred.id)]
  } else {
    credentials = rotateAgnesCredentials(all)
  }

  let lastResponse: Response | null = null
  let lastMessage = ''
  let lastCred = credentials[0]!

  for (let i = 0; i < credentials.length; i++) {
    const cred = credentials[i]!
    lastCred = cred
    const endpoints = resolveAgnesEndpoints(cred.baseUrl)
    const url = buildUrl(endpoints, cred)
    const response = await agnesFetch(url, cred.apiKey, init)
    if (response.ok) return { response, credential: cred }

    lastResponse = response
    const data = await response.clone().json().catch(() => null)
    lastMessage = extractErrorMessage(data, `HTTP ${response.status}`)
    // 指定 key 且禁止 failover：直接返回失败，不换 key
    if (preferKeyId && options?.allowFailover === false) {
      break
    }
    if (i < credentials.length - 1) {
      console.warn(
        `[agnes] key ${i + 1}/${credentials.length} failed, try next:`,
        lastMessage.slice(0, 160),
      )
      continue
    }
  }

  if (lastResponse && lastMessage) {
    try {
      const data = (await lastResponse.clone().json().catch(() => ({}))) as Record<
        string,
        unknown
      >
      return {
        response: Response.json(
          {
            ...data,
            detail: `${lastMessage}（已尝试 ${credentials.length} 个密钥）`,
            error:
              typeof data.error === 'object' && data.error
                ? {
                    ...(data.error as object),
                    message: `${lastMessage}（已尝试 ${credentials.length} 个密钥）`,
                  }
                : `${lastMessage}（已尝试 ${credentials.length} 个密钥）`,
          },
          { status: lastResponse.status },
        ),
        credential: lastCred,
      }
    } catch {
      /* fallthrough */
    }
  }

  return { response: lastResponse!, credential: lastCred }
}

/**
 * 多凭证故障切换：优先数据库密钥，按每条记录的 Base URL 请求。
 */
export async function agnesFetchWithFailover(
  env: AppEnv,
  buildUrl: (endpoints: AgnesEndpoints, cred: AgnesCredential) => string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { response } = await agnesFetchWithFailoverTracked(env, buildUrl, init)
  return response
}

export async function ensureAgnesReady(env: AppEnv) {
  return hasAgnesCredentials(env)
}

export function extractErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback
  const obj = data as Record<string, unknown>
  if (typeof obj.detail === 'string' && obj.detail.trim()) return obj.detail
  if (typeof obj.error === 'string' && obj.error.trim()) return obj.error
  if (obj.error && typeof obj.error === 'object') {
    const msg = (obj.error as { message?: unknown }).message
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  if (typeof obj.message === 'string' && obj.message.trim()) return obj.message
  return fallback
}
