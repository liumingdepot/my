import type { FortuneEnv } from './api.js'
import { nextAgnesApiKey } from './agnesKey.js'
import { Solar } from 'lunar-javascript'

type PersonBody = {
  name?: string
  timestamp?: number
  shichen?: string
}

type HehunBody = {
  male?: PersonBody
  female?: PersonBody
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

const SYSTEM_PROMPT = `你是「合婚配对」报告生成器：资深子平命理合婚顾问，依据《渊海子平》《三命通会》《滴天髓》《神峰通考》《千里命稿》等论合婚。

输入仅六行（不要追问、不要改写）：
男方姓名 / 男方出生 / 男方八字
女方姓名 / 女方出生 / 女方八字
八字均为服务端已排好的四柱（年 月 日 时），一字不改，禁止重排或改柱。

收到后立即输出完整《合婚配对》报告。

硬规则：
1. 先分别简述双方命局要点，再论合婚关系，最后给相处建议；三者不要混写。
2. 从日主、用神喜忌、十神、刑冲合害、纳音等推导；忌空话鸡汤与绝对化恐吓。
3. 引典必标书名篇目；吃不准写「不确定」。禁止「克夫/克妻、必离婚、短命」等标签。
4. 仅供传统文化与娱乐参考，不替代婚姻、医疗、法律决策。
5. 评分可给倾向区间，勿伪造精确百分比或宿命结论。

输出结构（标题与顺序固定，用 Markdown）：

# 合婚配对

男方：姓名 / 八字
女方：姓名 / 八字

## 一、双方命局概览
## 二、日主与五行生克
## 三、用神喜忌对照
## 四、刑冲合害与情感格局
## 五、性格互补与相处难点
## 六、婚姻稳定度与子女缘
## 七、财运与事业互助
## 八、综合匹配倾向
## 九、相处建议
## 十、免责声明

文风：专业、温和、清晰；古雅而不晦涩，像正式交给客户的合婚报告。`

export async function handleHehun(request: Request, env: FortuneEnv) {
  if (request.method !== 'POST') {
    return text('请使用 POST', 405)
  }

  let body: HehunBody
  try {
    body = await request.json()
  } catch {
    return text('请求格式不正确', 400)
  }

  const male = parsePerson(body.male, '男方')
  if (male instanceof Response) return male
  const female = parsePerson(body.female, '女方')
  if (female instanceof Response) return female

  const apiKey = await nextAgnesApiKey(env)
  if (!apiKey) {
    return text('报告服务未配置', 500)
  }

  try {
    const report = await createReport(apiKey, male, female)
    return text(report)
  } catch {
    return text('报告生成失败，请稍后再试', 502)
  }
}

function parsePerson(raw: PersonBody | undefined, label: string) {
  const name = raw?.name?.trim() ?? ''
  const shichen = raw?.shichen?.trim() ?? ''
  const birth = parseTimestamp(raw?.timestamp)
  const hour = SHICHEN_HOUR[shichen]
  if (!name) {
    return text(`请填写${label}姓名`, 400)
  }
  if (!birth || hour == null) {
    return text(`请选择${label}生辰`, 400)
  }
  const bazi = pillarsFromBirth(birth.year, birth.month, birth.day, hour)
  if (!bazi) {
    return text(`请选择${label}生辰`, 400)
  }
  return {
    name,
    shichen,
    born: `公历${birth.year}年${birth.month}月${birth.day}日 ${shichen}（北京时间）`,
    bazi,
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

type PersonParsed = {
  name: string
  shichen: string
  born: string
  bazi: string
}

async function createReport(apiKey: string, male: PersonParsed, female: PersonParsed) {
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
          content: [
            `男方姓名：${male.name}`,
            `男方出生：${male.born}`,
            `男方八字：${male.bazi}`,
            `女方姓名：${female.name}`,
            `女方出生：${female.born}`,
            `女方八字：${female.bazi}`,
          ].join('\n'),
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
