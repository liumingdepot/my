export type WorkCategory = 'all' | 'ai' | 'av' | 'tool' | 'fish'

export type WorkItem = {
  name: string
  desc: string
  href: string
  tag: string
  tone: 'violet' | 'rose' | 'ink' | 'emerald' | 'sky' | 'cyan' | 'amber'
  glyph: string
  platform: 'PC' | 'PC + 移动'
  /** 作品首屏截图，用于卡片封面 */
  image: string
  /** 所属分类；全部(all) 展示全部，不单独写入 */
  categories: Exclude<WorkCategory, 'all'>[]
}

export const WORK_CATEGORIES: { id: WorkCategory; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'ai', label: 'AI学习' },
  { id: 'av', label: '音视频' },
  { id: 'tool', label: '工具' },
  { id: 'fish', label: '摸鱼' },
]

/** 全部作品（中文），首页欢迎页「浏览作品」与 /works 列表共用 */
export const ALL_WORKS: WorkItem[] = [
  {
    name: '无限画布',
    desc: 'AI 短剧无限画布：输入提示词即可生成内容。功能开发中。',
    href: '/canvas',
    tag: '开发中',
    tone: 'violet',
    glyph: '画',
    platform: 'PC',
    image: '/images/works/canvas.webp',
    categories: ['ai'],
  },
  {
    name: '周易',
    desc: '填写生辰与问题，生成一份周易命盘解读。观象于天，仅作传统文化与娱乐参考。',
    href: '/fortune',
    tag: '已上线',
    tone: 'violet',
    glyph: '易',
    platform: 'PC + 移动',
    image: '/images/works/fortune.webp',
    categories: ['ai'],
  },
  {
    name: '音乐',
    desc: '搜索、推荐歌单、排行榜与分类标签，支持播放与歌词。数据来自公开接口，仅供学习交流。',
    href: '/music',
    tag: '已上线',
    tone: 'rose',
    glyph: '音',
    platform: 'PC + 移动',
    image: '/images/works/music.webp',
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
    image: '/images/works/video.webp',
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
    image: '/images/works/short.webp',
    categories: ['av'],
  },
  {
    name: '红果短剧',
    desc: '红果短剧网页版：分类浏览、搜索与全集选集播放，含接口签名与视频解密链路。',
    href: '/hongguo',
    tag: '已上线',
    tone: 'amber',
    glyph: '果',
    platform: 'PC + 移动',
    image: '/images/works/hongguo.webp',
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
    image: '/images/works/game.webp',
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
    image: '/images/works/education.webp',
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
    image: '/images/works/fish.webp',
    categories: ['fish', 'tool'],
  },
  {
    name: '占位项目 01',
    desc: '摸鱼占位页，功能开发中。',
    href: '/ph1/1',
    tag: '占位',
    tone: 'cyan',
    glyph: '一',
    platform: 'PC',
    image: '/images/works/fish.webp',
    categories: ['fish'],
  },
  {
    name: '占位项目 02',
    desc: '摸鱼占位页，功能开发中。',
    href: '/ph1/2',
    tag: '占位',
    tone: 'sky',
    glyph: '二',
    platform: 'PC',
    image: '/images/works/fish.webp',
    categories: ['fish'],
  },
  {
    name: '占位项目 03',
    desc: '摸鱼占位页，功能开发中。',
    href: '/ph1/3',
    tag: '占位',
    tone: 'emerald',
    glyph: '三',
    platform: 'PC',
    image: '/images/works/fish.webp',
    categories: ['fish'],
  },
  {
    name: '占位项目 04',
    desc: '摸鱼占位页，功能开发中。',
    href: '/ph1/4',
    tag: '占位',
    tone: 'amber',
    glyph: '四',
    platform: 'PC',
    image: '/images/works/fish.webp',
    categories: ['fish'],
  },
  {
    name: '占位项目 05',
    desc: '摸鱼占位页，功能开发中。',
    href: '/ph1/5',
    tag: '占位',
    tone: 'violet',
    glyph: '五',
    platform: 'PC',
    image: '/images/works/fish.webp',
    categories: ['fish'],
  },
  {
    name: '占位项目 06',
    desc: '摸鱼占位页，功能开发中。',
    href: '/ph2/1',
    tag: '占位',
    tone: 'rose',
    glyph: '六',
    platform: 'PC',
    image: '/images/works/fish.webp',
    categories: ['fish'],
  },
  {
    name: '占位项目 07',
    desc: '摸鱼占位页，功能开发中。',
    href: '/ph2/2',
    tag: '占位',
    tone: 'ink',
    glyph: '七',
    platform: 'PC',
    image: '/images/works/fish.webp',
    categories: ['fish'],
  },
  {
    name: '占位项目 08',
    desc: '摸鱼占位页，功能开发中。',
    href: '/ph2/3',
    tag: '占位',
    tone: 'cyan',
    glyph: '八',
    platform: 'PC',
    image: '/images/works/fish.webp',
    categories: ['fish'],
  },
  {
    name: '占位项目 09',
    desc: '摸鱼占位页，功能开发中。',
    href: '/ph2/4',
    tag: '占位',
    tone: 'sky',
    glyph: '九',
    platform: 'PC',
    image: '/images/works/fish.webp',
    categories: ['fish'],
  },
  {
    name: '占位项目 10',
    desc: '摸鱼占位页，功能开发中。',
    href: '/ph2/5',
    tag: '占位',
    tone: 'emerald',
    glyph: '十',
    platform: 'PC',
    image: '/images/works/fish.webp',
    categories: ['fish'],
  },
]

export function filterWorksByCategory(category: WorkCategory, works = ALL_WORKS) {
  if (category === 'all') return works
  return works.filter((work) => work.categories.includes(category))
}

export const WORKS_HOME_LIMIT = 6
/** 欢迎页 /；作品集 /works；项目经历 /projects */
export const WORKS_PATH = '/works'
export const PROJECTS_PATH = '/projects'
export const HOME_PATH = '/'

/** 后台「作品管理」维护的项目经历记录，由 /api/works 提供 */
export type ProjectWork = {
  id: string
  title: string
  role: string
  period: string
  description: string
  badge?: string
  company?: string
  platform?: string
  /** 技术栈，逗号分隔 */
  stack?: string
  /** 亮点，换行分隔 */
  highlights?: string
  link?: string
  featured?: boolean
}

/** 把后台存的逗号/顿号分隔技术栈拆成展示用数组 */
export function splitStack(stack?: string) {
  if (!stack?.trim()) return []
  return stack
    .split(/[,，、|/]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

/** 把后台存的换行亮点拆成展示用数组 */
export function splitHighlights(highlights?: string) {
  if (!highlights?.trim()) return []
  return highlights
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
}

/** 项目经历的配色遮罩，按顺序循环 */
export const PROJECT_TONES = ['teal', 'amber', 'sky', 'rose'] as const

/** 拉取后台配置的项目经历；接口不可用时降级为空列表 */
export async function fetchProjectWorks(): Promise<ProjectWork[]> {
  try {
    const response = await fetch('/api/works', { headers: { Accept: 'application/json' } })
    if (!response.ok) return []
    const data = (await response.json()) as { works?: ProjectWork[] }
    return Array.isArray(data.works) ? data.works : []
  } catch {
    return []
  }
}
