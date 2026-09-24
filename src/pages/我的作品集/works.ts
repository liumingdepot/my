export type WorkCategory = 'all' | 'av' | 'learn' | 'tool' | 'fish' | 'test'

export type WorkItem = {
  name: string
  desc: string
  href: string
  tag: string
  tone: 'violet' | 'rose' | 'ink' | 'emerald' | 'sky' | 'cyan' | 'amber'
  glyph: string
  platform: 'PC' | 'PC + 移动'
  /** 所属分类；精选(all) 展示全部，不单独写入 */
  categories: Exclude<WorkCategory, 'all'>[]
}

export const WORK_CATEGORIES: { id: WorkCategory; label: string }[] = [
  { id: 'all', label: '精选' },
  { id: 'av', label: '音视频' },
  { id: 'learn', label: '学习' },
  { id: 'tool', label: '工具' },
  { id: 'fish', label: '摸鱼' },
  { id: 'test', label: '开发中' },
]

/** 全部作品（中文），首页最多展示前 6 项；测试模块固定最后 */
export const ALL_WORKS: WorkItem[] = [
  {
    name: '周易',
    desc: '填写生辰与问题，生成一份周易命盘解读。观象于天，仅作传统文化与娱乐参考。',
    href: '/fortune',
    tag: '已上线',
    tone: 'violet',
    glyph: '易',
    platform: 'PC + 移动',
    categories: [],
  },
  {
    name: '音乐',
    desc: '搜索、推荐歌单、排行榜与分类标签，支持播放与歌词。数据来自公开接口，仅供学习交流。',
    href: '/music',
    tag: '已上线',
    tone: 'rose',
    glyph: '音',
    platform: 'PC + 移动',
    categories: ['av'],
  },
  {
    name: '视频',
    desc: '影视站：首页热播、电影/电视剧等分类筛选、搜索与播放，数据来自公开接口，仅供学习交流。',
    href: '/video',
    tag: '已上线',
    tone: 'ink',
    glyph: '影',
    platform: 'PC + 移动',
    categories: ['av'],
  },
  {
    name: '短剧',
    desc: '七猫短剧：热门首页、都市/古装等分类浏览、搜索与分集播放。数据来自公开接口，仅供学习交流。',
    href: '/short',
    tag: '已上线',
    tone: 'amber',
    glyph: '剧',
    platform: 'PC + 移动',
    categories: ['av'],
  },
  {
    name: 'FC游戏',
    desc: '经典 FC 游戏在线玩：热门推荐与详情页，支持网页端游玩。仅供学习交流。',
    href: '/game',
    tag: '已上线',
    tone: 'emerald',
    glyph: '游',
    platform: 'PC',
    categories: ['fish'],
  },
  {
    name: '学习教育',
    desc: '课程视频学习站：按学段/教材筛选、搜索与在线播放。仅供学习交流。',
    href: '/education',
    tag: '已上线',
    tone: 'sky',
    glyph: '教',
    platform: 'PC + 移动',
    categories: ['av', 'learn'],
  },
  {
    name: '测试模块',
    desc: '七猫短剧 API 测试页：常用分类采集与搜索试播。',
    href: '/test',
    tag: '测试',
    tone: 'amber',
    glyph: '测',
    platform: 'PC + 移动',
    categories: ['test'],
  },
]

export function filterWorksByCategory(category: WorkCategory, works = ALL_WORKS) {
  if (category === 'all') return works
  return works.filter((work) => work.categories.includes(category))
}

export const WORKS_HOME_LIMIT = 6
export const WORKS_PATH = '/works'
