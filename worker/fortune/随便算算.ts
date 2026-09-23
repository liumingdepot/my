import type { FortuneEnv } from './api.js'
import { nextAgnesApiKey } from './agnesKey.js'

type ReportBody = {
  name?: string
  timestamp?: number
  shichen?: string
  question?: string
}

type ChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
  error?: {
    message?: string
  }
}

const SHICHEN = new Set(['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时'])

const SYSTEM_PROMPT = `
你是一位资深子平八字命理顾问，熟读《渊海子平》《三命通会》《滴天髓》《穷通宝鉴》《子平真诠》等传统命理典籍。用户只提供：姓名、八字、咨询问题。你不要再追问性别、出生地、出生时间等信息，直接按用户给出的八字解盘。若八字不完整或格式不清，先请用户补全。
规则：
1. 姓名只作称呼，不据此断命。回答的内容，如果包含日期，请再三推算，日期是否正确。
2. 八字按四柱看：年柱、月柱、日柱、时柱。未给性别和大运时，只论原局，不硬排大运。
3. 分析流程：四柱十神—五行旺衰—格局用神喜忌—刑冲合害与宫位—针对咨询问题解读—建议。
4. 引用古籍要标出处，不确定就说明“不确定”。不绝对化，不恐吓，不贴凶标签。
5. 仅作传统文化与娱乐参考，不替代医疗、法律、投资等专业决策。
`

export async function handleCasual(request: Request, env: FortuneEnv) {
  if (request.method !== 'POST') {
    return text('请使用 POST', 405)
  }

  let body: ReportBody
  try {
    body = await request.json()
  } catch {
    return text('请求格式不正确', 400)
  }

  const name = body.name?.trim() ?? ''
  const shichen = body.shichen?.trim() ?? ''
  const question = body.question?.trim() ?? ''
  const birth = parseTimestamp(body.timestamp)
  if (!name) {
    return text('请填写姓名', 400)
  }
  if (!birth || !SHICHEN.has(shichen)) {
    return text('请填写八字', 400)
  }
  if (!question) {
    return text('请填写咨询问题', 400)
  }
  const apiKey = await nextAgnesApiKey(env)
  if (!apiKey) {
    return text('报告服务未配置', 500)
  }

  const bazi = `${birth.year}年${birth.month}月${birth.day}日 ${shichen}`
  try {
    const report = await createReport(apiKey, name, bazi, question)
    return text(report)
  } catch {
    return text('报告生成失败，请稍后再试', 502)
  }
}

async function createReport(apiKey: string, name: string, bazi: string, question: string) {
  const response = await fetch('https://api.agnes-ai.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'agnes-2.5-flash',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `姓名：${name}\n八字：${bazi}\n咨询问题：${question}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  })

  let data: ChatResponse
  try {
    data = await response.json()
  } catch {
    throw new Error('invalid ai response')
  }

  const content = data.choices?.[0]?.message?.content?.trim()
  if (!response.ok || !content) {
    throw new Error(data.error?.message || 'ai request failed')
  }
  return content
}

function parseTimestamp(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date)
  const pick = (type: string) => Number(parts.find((item) => item.type === type)?.value)
  const year = pick('year')
  const month = pick('month')
  const day = pick('day')
  const nowYear = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(new Date()),
  )
  if (year < 1920 || year > nowYear + 1) return null
  const check = new Date(Date.UTC(year, month - 1, day))
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null
  return { year, month, day }
}

function text(message: string, status = 200) {
  return new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
