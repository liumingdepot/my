import type { FortuneEnv } from './api.js'
import { nextAgnesApiKey } from './agnesKey.js'
import { Solar } from 'lunar-javascript'

type LiunianBody = {
  name?: string
  gender?: string
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

const GENDERS = new Set(['男', '女'])

const SYSTEM_PROMPT = `你是「流年运势」报告生成器：资深子平命理顾问，依据《渊海子平》《三命通会》《滴天髓》《穷通宝鉴》《子平真诠》《神峰通考》《千里命稿》论流年。

输入仅五行（不要追问、不要改写）：
姓名：称呼用，不参与断命
性别：男或女，用于定大运顺逆（阳男阴女顺行，阴男阳女逆行）
出生：公历生辰说明
八字：服务端已排好的四柱（年 月 日 时），一字不改，禁止重排或改柱
流年：服务端给定的公历年份与该年干支，以该年为论断重心

收到后立即输出完整《流年运势》，不问出生地、咨询意向。

硬规则：
1. 先据八字与性别定日主强弱、用神喜忌、当前大运，再专论该流年干支对命局的影响。
2. 流年解读须覆盖事业、财运、感情、健康、人际关系等要点；可略提前后各一年作对照，勿编造精确日期事件。
3. 引典必标书名篇目；吃不准写「不确定」，禁止绝对化与恐吓，禁止「克夫/克妻、短命、穷命、必离婚」等标签。
4. 仅供传统文化与娱乐参考，不替代医疗、法律、投资决策。
5. 每节写实、有据，忌空话堆砌。

输出结构（标题与顺序固定，用 Markdown）：

# 流年运势

姓名：…
性别：…
八字：…
流年：…年（干支）

## 一、命局与大运概览
## 二、流年干支总论
## 三、事业与学业
## 四、财运与机遇
## 五、感情与人际
## 六、健康提示
## 七、逐季要点
（春夏秋冬各一段倾向即可）
## 八、关键与开运建议
## 九、免责声明

文风：专业、温和、清晰；古雅而不晦涩，像正式交给客户的流年报告。`

export async function handleLiunian(request: Request, env: FortuneEnv) {
  if (request.method !== 'POST') {
    return text('请使用 POST', 405)
  }

  let body: LiunianBody
  try {
    body = await request.json()
  } catch {
    return text('请求格式不正确', 400)
  }

  const name = body.name?.trim() ?? ''
  const gender = body.gender?.trim() ?? ''
  const shichen = body.shichen?.trim() ?? ''
  const birth = parseTimestamp(body.timestamp)
  const hour = SHICHEN_HOUR[shichen]
  if (!name) {
    return text('请填写姓名', 400)
  }
  if (!GENDERS.has(gender)) {
    return text('请选择性别', 400)
  }
  if (!birth || hour == null) {
    return text('请选择生辰', 400)
  }
  const apiKey = await nextAgnesApiKey(env)
  if (!apiKey) {
    return text('报告服务未配置', 500)
  }

  const bazi = pillarsFromBirth(birth.year, birth.month, birth.day, hour)
  if (!bazi) {
    return text('请选择生辰', 400)
  }

  const liunianYear = currentShanghaiYear()
  const liunianGanZhi = yearGanZhi(liunianYear)

  try {
    const born = `公历${birth.year}年${birth.month}月${birth.day}日 ${shichen}（北京时间）`
    const liunian = `${liunianYear}年（${liunianGanZhi}）`
    const report = await createReport(apiKey, name, gender, born, bazi, liunian)
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

function currentShanghaiYear() {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(new Date()),
  )
}

function yearGanZhi(year: number) {
  try {
    return Solar.fromYmdHms(year, 6, 15, 12, 0, 0).getLunar().getEightChar().getYear()
  } catch {
    return '未知'
  }
}

async function createReport(
  apiKey: string,
  name: string,
  gender: string,
  born: string,
  bazi: string,
  liunian: string,
) {
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
          content: `姓名：${name}\n性别：${gender}\n出生：${born}\n八字：${bazi}\n流年：${liunian}`,
        },
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
