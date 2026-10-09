export type WorkCategory = 'all' | 'ai' | 'av' | 'tool' | 'fish' | 'test'

export type WorkItem = {
  name: string
  desc: string
  href: string
  tag: string
  tone: 'violet' | 'rose' | 'ink' | 'emerald' | 'sky' | 'cyan' | 'amber'
  glyph: string
  platform: 'PC' | 'PC + 移动'
  /** 所属分类；全部(all) 展示全部，不单独写入 */
  categories: Exclude<WorkCategory, 'all'>[]
}

export const WORK_CATEGORIES: { id: WorkCategory; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'ai', label: 'AI学习' },
  { id: 'av', label: '音视频' },
  { id: 'tool', label: '工具' },
  { id: 'fish', label: '摸鱼' },
  { id: 'test', label: '开发中' },
]

/** 全部作品（中文），首页最多展示前 6 项；测试模块固定最后 */
export const ALL_WORKS: WorkItem[] = [
  {
    name: '无限画布',
    desc: 'AI 短剧无限画布：输入提示词即可生成内容。功能开发中。',
    href: '/canvas',
    tag: '开发中',
    tone: 'violet',
    glyph: '画',
    platform: 'PC',
    categories: ['ai', 'test'],
  },
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
    name: '红果短剧',
    desc: '红果站源短剧：首页热播、真人/漫剧/AI/动漫分类、搜索与分集播放。',
    href: '/hongguo',
    tag: '已上线',
    tone: 'amber',
    glyph: '果',
    platform: 'PC + 移动',
    categories: ['av'],
  },
  {
    name: '游戏',
    desc: '经典 FC / 街机在线玩：按平台与类型浏览、详情页网页端游玩。仅供学习交流。',
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
    categories: ['av'],
  },
  {
    name: '摸鱼助手',
    desc: '铭摸鱼：模拟 Windows 故障/升级与 Mac 升级全屏画面，老板来了也不慌。仅供娱乐。',
    href: '/fish',
    tag: '已上线',
    tone: 'cyan',
    glyph: '鱼',
    platform: 'PC + 移动',
    categories: ['fish', 'tool'],
  },
  {
    name: '测试',
    desc: 'hongguo-mac 风格短剧测试：发现/榜单/搜索/选集播放，本机收藏与历史。',
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
