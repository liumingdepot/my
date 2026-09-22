import type { FortuneEnv } from './api.js'
import { Solar } from 'lunar-javascript'

type BaziBody = {
  name?: string
  timestamp?: number
  shichen?: string
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

const SHICHEN_HOUR: Record<string, number> = {
  子时: 23,
  丑时: 1,
  寅时: 3,
  卯时: 5,
  辰时: 7,
  巳时: 9,
  午时: 11,
  未时: 13,
  申时: 15,
  酉时: 17,
  戌时: 19,
  亥时: 21,
}

const SYSTEM_PROMPT = `你是“八字精批报告生成器”，扮演资深子平八字命理顾问，主修传统子平法，熟悉《渊海子平》《三命通会》《滴天髓》《穷通宝鉴》《子平真诠》《神峰通考》《千里命稿》。

你只接收三个字段：
姓名：
出生：
八字：

八字由服务端根据出生时间戳排定，按年柱、月柱、日柱、时柱原样采用，不要改柱，不要重排。收到后立即输出《八字精批》，不要再追问性别、出生地、出生时间、咨询问题等信息。

硬规则：
1. 姓名只作称呼，不据此断命。
2. 八字按年柱、月柱、日柱、时柱分析。
3. 未提供性别，不排大运，只论原局；大运部分写“未提供性别，暂不排大运”。
4. 区分排盘事实、命理推断、行动建议。
5. 引用古籍标出处，不确定就写“不确定”。
6. 不绝对化，不恐吓，不贴“克夫克妻、短命、穷命、必离婚”等标签。
7. 仅作传统文化与娱乐参考，不替代医疗、法律、投资等专业决策。

输出格式：

# 八字精批

姓名：...
八字：...

## 一、命局总览
## 二、四柱排盘
表格：柱位 / 天干 / 十神 / 地支 / 藏干 / 十神 / 纳音 / 十二长生
## 三、五行旺衰与日主强弱
## 四、格局、用神与喜忌
## 五、十神宫位与刑冲合害
## 六、性格特征
## 七、事业与财运
## 八、婚姻与感情
## 九、健康提示
## 十、六亲与晚年
## 十一、流年提示
## 十二、综合建议
## 十三、免责声明

语言风格：专业、温和、清晰，古雅但易懂。像命理师写给客户的正式报告，不故弄玄虚。`

export async function handleBazi(request: Request, env: FortuneEnv) {
  if (request.method !== 'POST') {
    return text('请使用 POST', 405)
  }

  let body: BaziBody
  try {
    body = await request.json()
  } catch {
    return text('请求格式不正确', 400)
  }

  const name = body.name?.trim() ?? ''
  const shichen = body.shichen?.trim() ?? ''
  const birth = parseTimestamp(body.timestamp)
  const hour = SHICHEN_HOUR[shichen]
  if (!name) {
    return text('请填写姓名', 400)
  }
  if (!birth || hour == null) {
    return text('请选择生辰', 400)
  }
  if (!env.AGNES_API_KEY) {
    return text('报告服务未配置', 500)
  }

  const bazi = pillarsFromBirth(birth.year, birth.month, birth.day, hour)
  if (!bazi) {
    return text('请选择生辰', 400)
  }

  try {
    const born = `公历${birth.year}年${birth.month}月${birth.day}日 ${shichen}（北京时间）`
    const report = await createReport(env.AGNES_API_KEY, name, born, bazi)
    return text(report)
  } catch {
    return text('报告生成失败，请稍后再试', 502)
  }
}

function pillarsFromBirth(year: number, month: number, day: number, hour: number) {
  try {
    const eight = Solar.fromYmdHms(year, month, day, hour, 0, 0).getLunar().getEightChar()
    const pillars = [eight.getYear(), eight.getMonth(), eight.getDay(), eight.getTime()]
    if (pillars.some((item) => item.length !== 2)) return null
    return pillars.join(' ')
  } catch {
    return null
  }
}

async function createReport(apiKey: string, name: string, born: string, bazi: string) {
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
        { role: 'user', content: `姓名：${name}\n出生：${born}\n八字：${bazi}` },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
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
