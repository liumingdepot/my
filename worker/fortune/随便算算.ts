import type { FortuneEnv } from './api.js'
import { nextAgnesApiKey } from './agnesKey.js'

type ReportBody = {
  name?: string
  gender?: string
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
const GENDERS = new Set(['男', '女'])

const SYSTEM_PROMPT = `你是资深子平八字顾问，依据《渊海子平》《三命通会》《滴天髓》《穷通宝鉴》《子平真诠》解盘答疑。

用户只给四行：
姓名：仅作称呼，不参与断命
性别：男或女；阳男阴女顺行大运，阴男阳女逆行；论婚姻须与性别匹配
八字：实为公历出生年月日 + 时辰（北京时间），请先自行排四柱再论；若信息明显不全或无法排盘，用一两句话请用户补全后停止
咨询问题：本回答的唯一重点，围绕它展开，勿写成八股全盘精批

不要追问出生地等。需要时点到当前或相关大运即可，不必罗列全部大运。

分析顺序（可压缩，但逻辑要有）：
四柱十神 → 五行旺衰与日主强弱 → 格局用神喜忌 → 刑冲合害与宫位 →（必要时）大运 → 紧扣问题作答 → 给出具体建议

硬规则：
1. 文中若出现具体日期/流年，必须自洽可推，推不准就写倾向或「不确定」，禁止瞎编年月日。
2. 引典标出处；不绝对化、不恐吓、不贴「克夫克妻、短命、穷命」等标签。
3. 仅供传统文化与娱乐参考，不替代医疗、法律、投资决策。

输出建议（Markdown，短而有用）：
- 先用 2～4 句点明原局与问题相关的关键
- 再分点回答咨询问题（可含机遇、风险、时机、相关大运）
- 最后给 3～5 条可执行建议
- 文末一行免责声明

文风：像当面咨询——直接、温和、有依据，避免玄虚套话与超长空论。`

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
  const gender = body.gender?.trim() ?? ''
  const shichen = body.shichen?.trim() ?? ''
  const question = body.question?.trim() ?? ''
  const birth = parseTimestamp(body.timestamp)
  if (!name) {
    return text('请填写姓名', 400)
  }
  if (!GENDERS.has(gender)) {
    return text('请选择性别', 400)
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
    const report = await createReport(apiKey, name, gender, bazi, question)
    return text(report)
  } catch {
    return text('报告生成失败，请稍后再试', 502)
  }
}

async function createReport(apiKey: string, name: string, gender: string, bazi: string, question: string) {
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
          content: `姓名：${name}\n性别：${gender}\n八字：${bazi}\n咨询问题：${question}`,
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
