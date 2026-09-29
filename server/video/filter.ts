/**
 * 采集源（量子等）常混入伦理/AV 片源，后台统一关键词过滤。
 * 裸词「韩国」会误伤韩剧，只用「韩国三级 / 韩国伦理」等组合。
 */

/** 片名 / 分类 / 标签用（子串，规范化后比对） */
const BLOCK_IN_TITLE = [
  // 片种
  '伦理片',
  '伦理电影',
  '三级片',
  '限制级',
  '成人片',
  '情色片',
  '色情片',
  '黄片',
  '黄游',
  '里番',
  '工口',
  '福利片',
  '福利姬',
  '十八禁',
  '18禁',
  '理论片',
  // 地区组合（避免误杀正常韩剧/日剧；不用裸词「韩国」）
  '韩国三级',
  '韩三级',
  '韩国伦理',
  '韩伦理',
  '日本三级',
  '日三级',
  '日本伦理',
  '日伦理',
  '港台三级',
  '香港三级',
  '亚洲伦理',
  '欧美三级',
  '欧美伦理',
  // AV
  '日本av',
  '国产av',
  '亚洲av',
  '无码',
  '有码av',
  '步兵区',
  '骑兵区',
  'av女优',
  '女优',
  '番号',
  // 明确色情题材
  '乱伦',
  '迷奸',
  '强奷',
  '援交',
  '约炮',
  '口交',
  '肛交',
  '内射',
  '潮吹',
  '肉便器',
  '痴汉',
  '里番动漫',
  '里番动画',
  'h动漫',
  'h动画',
  '工口动漫',
  '色情动漫',
  '成人动漫',
  '成人动画',
  '情色电影',
  '艳星',
  '裸聊',
  '色站',
  '儿童色情',
  // 片名/分类高频短词
  '伦理',
  '三级',
  '成人',
  '情色',
  '色情',
] as const

/**
 * 简介专用：不含「伦理/成人」等易在正剧文案出现的短词，
 * 只拦明显片种/AV 用语。
 */
const BLOCK_IN_BLURB = [
  '伦理片',
  '三级片',
  '情色片',
  '色情片',
  '成人片',
  '限制级',
  '黄片',
  '里番',
  '福利片',
  '十八禁',
  '18禁',
  '韩国三级',
  '韩国伦理',
  '日本三级',
  '日本伦理',
  '日本av',
  '国产av',
  '无码',
  'av女优',
  '女优',
  '番号',
  '乱伦',
  '迷奸',
  '援交',
  '约炮',
  '口交',
  '肛交',
  '内射',
  '肉便器',
  '色情动漫',
  '成人动漫',
  '儿童色情',
] as const

/** 英文缩写：整词匹配，避免 Avatar / travel 误伤 */
const BLOCK_WORDS = ['av', 'jav', 'nsfw', 'porn', 'porno', 'xxx', 'hentai', 'r18', 'r-18'] as const

const BLOCK_TYPE_NAMES = new Set(
  [
    '伦理片',
    '伦理',
    '福利',
    '福利片',
    '情色',
    '情色片',
    '色情',
    '成人',
    '成人片',
    '三级片',
    '三级',
    '限制级',
    '写真',
    '里番',
    'av',
    '日本av',
    '理论片',
  ].map((s) => s.toLowerCase()),
)

const WORD_RE = new RegExp(
  `(?:^|[^a-z0-9])(?:${BLOCK_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?:[^a-z0-9]|$)`,
  'i',
)

function normalizeText(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[\s\-_/|·•.,，。!！?？:：;；"'“”‘’()（）\[\]【】{}]/g, '')
}

function hasSubstringHit(raw: string, keywords: readonly string[]) {
  const compact = normalizeText(raw)
  if (!compact) return false
  return keywords.some((kw) => compact.includes(normalizeText(kw)))
}

export function textHasBlockedKeyword(raw: string): boolean {
  const text = String(raw || '').trim()
  if (!text) return false
  if (WORD_RE.test(text)) return true
  return hasSubstringHit(text, BLOCK_IN_TITLE)
}

export function isBlockedTypeName(typeName: string): boolean {
  const name = String(typeName || '').trim()
  if (!name) return false
  if (BLOCK_TYPE_NAMES.has(name.toLowerCase())) return true
  return textHasBlockedKeyword(name)
}

export type VodFilterFields = {
  vod_name?: string
  type_name?: string
  vod_class?: string
  vod_blurb?: string
  vod_content?: string
  vod_remarks?: string
  vod_area?: string
  vod_en?: string
}

/** 单条影片是否应拦截（标题/分类严拦，简介只拦强特征） */
export function isBlockedVod(item: VodFilterFields): boolean {
  if (isBlockedTypeName(String(item.type_name || ''))) return true
  const primary = [item.vod_name, item.type_name, item.vod_class, item.vod_remarks, item.vod_en]
    .map((v) => String(v || ''))
    .join(' ')
  if (textHasBlockedKeyword(primary)) return true
  const blurb = `${item.vod_blurb || ''} ${item.vod_content || ''}`
  if (!blurb.trim()) return false
  if (WORD_RE.test(blurb)) return true
  return hasSubstringHit(blurb, BLOCK_IN_BLURB)
}

/** 搜索词本身是否成人向（直接空结果，不打上游） */
export function isBlockedSearchQuery(q: string): boolean {
  return textHasBlockedKeyword(q)
}

export function filterVodList<T extends VodFilterFields>(list: T[]): T[] {
  return list.filter((item) => !isBlockedVod(item))
}

export function filterClasses<T extends { type_name?: string }>(list: T[]): T[] {
  return list.filter((item) => !isBlockedTypeName(String(item.type_name || '')))
}
