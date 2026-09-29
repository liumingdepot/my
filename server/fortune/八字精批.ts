import type { FortuneEnv } from './api.js'
import { agnesErrorMessage, hasAgnesCredentials, withAgnesKeyFailover } from './agnesKey.js'
import type { AgnesCredential } from '../admin/agnesKeys.js'
import { Solar } from 'lunar-javascript'

type BaziBody = {
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

const SYSTEM_PROMPT = `你是「八字精批」报告生成器：资深子平命理顾问，依据《渊海子平》《三命通会》《滴天髓》《穷通宝鉴》《子平真诠》《神峰通考》《千里命稿》论命。

输入仅四行（不要追问、不要改写）：
姓名：称呼用，不参与断命
性别：男或女，用于定大运顺逆（阳男阴女顺行，阴男阳女逆行）
出生：公历生辰说明
八字：服务端已排好的四柱（年 月 日 时），一字不改，禁止重排或改柱

收到后立即输出完整《八字精批》，不问出生地、咨询意向。

硬规则：
1. 按性别与年干阴阳排大运：起运岁数、每步大运干支及大致年龄段写清楚；婚姻感情解读须与性别匹配（男看妻星妻宫，女看夫星夫宫）。
2. 先摆排盘事实，再写推断，最后给可执行建议；三者不要混写。
3. 引典必标书名篇目；吃不准写「不确定」，禁止绝对化与恐吓，禁止「克夫/克妻、短命、穷命、必离婚」等标签。
4. 仅供传统文化与娱乐参考，不替代医疗、法律、投资决策。
5. 每节写实、有据，忌空话堆砌；性格/事业/感情从用神喜忌、十神宫位与大运推导，不泛泛鸡汤。

输出结构（标题与顺序固定，用 Markdown）：

# 八字精批

姓名：…
性别：…
八字：…

## 一、命局总览
（日主、气势、喜用一句话总括）
## 二、四柱排盘
表格列：柱位 | 天干 | 十神 | 地支 | 藏干 | 十神 | 纳音 | 十二长生
## 三、五行旺衰与日主强弱
## 四、格局、用神与喜忌
## 五、十神宫位与刑冲合害
## 六、大运走势
（起运、顺逆、各步大运与年龄段）
## 七、性格特征
## 八、事业与财运
## 九、婚姻与感情
## 十、健康提示
## 十一、六亲与晚年
## 十二、流年提示
（近 1～3 年倾向即可，勿编造精确日期事件）
## 十三、综合建议
## 十四、免责声明

文风：专业、温和、清晰；古雅而不晦涩，像正式交给客户的报告。`

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
  if (!(await hasAgnesCredentials(env))) {
    return text('报告服务未配置', 500)
  }

  const bazi = pillarsFromBirth(birth.year, birth.month, birth.day, hour)
  if (!bazi) {
    return text('请选择生辰', 400)
  }

  try {
    const born = `公历${birth.year}年${birth.month}月${birth.day}日 ${shichen}（北京时间）`
    const report = await withAgnesKeyFailover(env, (cred) =>
      createReport(cred, name, gender, born, bazi),
    )
    return text(report)
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    console.error('[bazi]', msg)
    return text(msg && msg !== 'ai request failed' ? msg : '报告生成失败，请稍后再试', 502)
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

async function createReport(
  cred: AgnesCredential,
  name: string,
  gender: string,
  born: string,
  bazi: string,
) {
  const base = cred.baseUrl.replace(/\/$/, '')
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cred.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'agnes-2.5-flash',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `姓名：${name}\n性别：${gender}\n出生：${born}\n八字：${bazi}` },
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
    throw new Error(agnesErrorMessage(data))
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
