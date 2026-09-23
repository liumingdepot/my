import type { FortuneEnv } from './api.js'
import { nextAgnesApiKey } from './agnesKey.js'

type LotsBody = {
  mode?: string
  label?: string
  payload?: string
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

const MODES = new Set(['stick', 'liuyao', 'coins', 'ask'])

const SYSTEM_PROMPT = `你是「在线抽签 / 六爻」解读师，熟稔《周易》《易经》卦辞爻辞、观音灵签与民间求签传统。

用户会给出一种起卦方式与已经摇出的结果（签号/卦名/爻象等）。你只负责解读，不要重新抽签或改结果。

硬规则：
1. 严格依据用户给出的签号、卦名、爻象来写，禁止另起一卦或改签号。
2. 有「所问」时紧扣问题；无具体所问则作通解，提示趋避。
3. 引典标出处（如《易经》某卦卦辞）；吃不准写「不确定」。禁止恐吓、绝对化与「必死、必破财」等话术。
4. 仅供传统文化与娱乐参考，不替代医疗、法律、投资决策。
5. 文风温和、清晰，像当面解签。

输出结构（Markdown，标题固定）：

# 抽签解读

方式：…
结果：…

## 一、签象 / 卦象提要
## 二、卦辞爻辞要点（或签意）
## 三、所问指引（若无所问则写「通解」）
## 四、宜与忌
## 五、小结建议
## 六、免责声明
`

export async function handleLots(request: Request, env: FortuneEnv) {
  if (request.method !== 'POST') {
    return text('请使用 POST', 405)
  }

  let body: LotsBody
  try {
    body = await request.json()
  } catch {
    return text('请求格式不正确', 400)
  }

  const mode = body.mode?.trim() ?? ''
  const label = body.label?.trim() ?? ''
  const payload = body.payload?.trim() ?? ''
  const question = body.question?.trim() ?? ''
  if (!MODES.has(mode) || !label || !payload) {
    return text('抽签结果不完整', 400)
  }

  const apiKey = await nextAgnesApiKey(env)
  if (!apiKey) {
    return text('报告服务未配置', 500)
  }

  try {
    const report = await createReport(apiKey, label, payload, question)
    return text(report)
  } catch {
    return text('报告生成失败，请稍后再试', 502)
  }
}

async function createReport(apiKey: string, label: string, payload: string, question: string) {
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
          content: `功能：${label}\n${payload}${question ? `\n所问：${question}` : ''}`,
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

function text(message: string, status = 200) {
  return new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
