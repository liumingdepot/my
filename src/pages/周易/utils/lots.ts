/** 六爻 / 灵签 本地起卦逻辑：前端随机得出结果，再交给后台解读 */

export type LotMode = 'stick' | 'liuyao' | 'coins' | 'ask'

export type YaoValue = 6 | 7 | 8 | 9

export type DrawResult = {
  mode: LotMode
  label: string
  summary: string
  detail: string
  /** 发给后台的结构化原文 */
  payload: string
}

const HEXAGRAM_NAMES = [
  '坤为地',
  '山地剥',
  '水地比',
  '风地观',
  '雷地豫',
  '火地晋',
  '泽地萃',
  '天地否',
  '地山谦',
  '艮为山',
  '水山蹇',
  '风山渐',
  '雷山小过',
  '火山旅',
  '泽山咸',
  '天山遁',
  '地水师',
  '山水蒙',
  '坎为水',
  '风水涣',
  '雷水解',
  '火水未济',
  '泽水困',
  '天水讼',
  '地风升',
  '山风蛊',
  '水风井',
  '巽为风',
  '雷风恒',
  '火风鼎',
  '泽风大过',
  '天风姤',
  '地雷复',
  '山雷颐',
  '水雷屯',
  '风雷益',
  '震为雷',
  '火雷噬嗑',
  '泽雷随',
  '天雷无妄',
  '地火明夷',
  '山火贲',
  '水火既济',
  '风火家人',
  '雷火丰',
  '离为火',
  '泽火革',
  '天火同人',
  '地泽临',
  '山泽损',
  '水泽节',
  '风泽中孚',
  '雷泽归妹',
  '火泽睽',
  '兑为泽',
  '天泽履',
  '地天泰',
  '山天大畜',
  '水天需',
  '风天小畜',
  '雷天大壮',
  '火天大有',
  '泽天夬',
  '乾为天',
] as const

const YAO_LABEL: Record<YaoValue, string> = {
  6: '老阴 ×',
  7: '少阳 —',
  8: '少阴 - -',
  9: '老阳 ○',
}

function randomInt(max: number) {
  return Math.floor(Math.random() * max)
}

function tossYao(): YaoValue {
  // 三钱法：字=2，背=3；总和 6/7/8/9
  const sum = [0, 1, 2].reduce((total) => total + (Math.random() < 0.5 ? 2 : 3), 0)
  return sum as YaoValue
}

function isYang(value: YaoValue) {
  return value === 7 || value === 9
}

function changed(value: YaoValue): YaoValue {
  if (value === 6) return 7
  if (value === 9) return 8
  return value
}

/** 自下而上六爻 → 0..63 索引（阳为 1） */
function binaryIndex(yaos: YaoValue[]) {
  return yaos.reduce((acc, value, index) => acc + (isYang(value) ? 1 << index : 0), 0)
}

function hexagramName(yaos: YaoValue[]) {
  return HEXAGRAM_NAMES[binaryIndex(yaos)] ?? '未知'
}

function formatYaos(yaos: YaoValue[]) {
  return [...yaos]
    .reverse()
    .map((value, index) => `第${6 - index}爻：${YAO_LABEL[value]}`)
    .join('\n')
}

function drawStick(): DrawResult {
  const no = randomInt(100) + 1
  const ranks = ['上上签', '上签', '中上签', '中签', '中下签', '下签'] as const
  const rank = ranks[randomInt(ranks.length)]!
  const summary = `第 ${no} 签 · ${rank}`
  const detail = `签号：${no}\n签等：${rank}`
  return {
    mode: 'stick',
    label: '在线抽签',
    summary,
    detail,
    payload: `方式：观音灵签（在线抽签）\n${detail}\n说明：签诗与判词请依签号签等解读，并提示仅供参考。`,
  }
}

function drawLiuyao(): DrawResult {
  const yaos = Array.from({ length: 6 }, () => {
    const yang = Math.random() < 0.5
    return (yang ? 7 : 8) as YaoValue
  })
  const name = hexagramName(yaos)
  const summary = name
  const detail = `本卦：${name}\n\n${formatYaos(yaos)}`
  return {
    mode: 'liuyao',
    label: '随机摇个六爻卦',
    summary,
    detail,
    payload: `方式：随机六爻（无变爻）\n${detail}`,
  }
}

function drawCoins(): DrawResult {
  const yaos = Array.from({ length: 6 }, () => tossYao())
  const primary = hexagramName(yaos)
  const changing = yaos
    .map((value, index) => (value === 6 || value === 9 ? index + 1 : 0))
    .filter(Boolean)
  const changedYaos = yaos.map(changed)
  const secondary = changing.length ? hexagramName(changedYaos) : null
  const summary = secondary ? `${primary} → ${secondary}` : primary
  const detail = [
    `本卦：${primary}`,
    secondary ? `之卦：${secondary}` : '变爻：无',
    changing.length ? `动爻：第 ${changing.join('、')} 爻` : '',
    '',
    formatYaos(yaos),
  ]
    .filter(Boolean)
    .join('\n')
  return {
    mode: 'coins',
    label: '掷铜钱起卦',
    summary,
    detail,
    payload: `方式：三钱法六爻\n${detail}`,
  }
}

function drawAskStick(question: string): DrawResult {
  const base = drawStick()
  const q = question.trim() || '未写具体所问，请作通解'
  return {
    ...base,
    mode: 'ask',
    label: '抽签问事',
    payload: `方式：抽签问事\n所问：${q}\n${base.detail}\n说明：紧扣所问解读签意，给出趋避建议。`,
  }
}

export function drawLot(mode: LotMode, question = ''): DrawResult {
  if (mode === 'stick') return drawStick()
  if (mode === 'liuyao') return drawLiuyao()
  if (mode === 'coins') return drawCoins()
  return drawAskStick(question)
}

export const LOT_ACTIONS: Array<{
  mode: LotMode
  title: string
  hint: string
  needQuestion?: boolean
}> = [
  { mode: 'stick', title: '在线抽签', hint: '摇出一签，观象解惑' },
  { mode: 'liuyao', title: '随机摇个六爻卦', hint: '一卦定局，直示吉凶' },
  { mode: 'coins', title: '掷铜钱起卦', hint: '三钱六爻，本卦之卦' },
  { mode: 'ask', title: '抽签问事', hint: '先写下所问，再求一签', needQuestion: true },
]
