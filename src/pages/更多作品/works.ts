export type WorkItem = {
  name: string
  desc: string
  href: string
  tag: string
  tone: 'violet' | 'rose' | 'ink' | 'emerald' | 'sky' | 'cyan' | 'amber'
  glyph: string
  platform: 'PC' | 'PC + 移动'
}

const TONES: WorkItem['tone'][] = ['violet', 'rose', 'ink', 'emerald', 'sky', 'cyan', 'amber']

/** 全部作品（中文），首页最多展示前 6 项 */
export const ALL_WORKS: WorkItem[] = [
  {
    name: '周易',
    desc: '填写生辰与问题，生成一份周易命盘解读。观象于天，仅作传统文化与娱乐参考。',
    href: '/fortune',
    tag: '已上线',
    tone: 'violet',
    glyph: '易',
    platform: 'PC + 移动',
  },
  {
    name: '音乐',
    desc: '搜索、推荐歌单、排行榜与分类标签，支持播放与歌词。数据来自公开接口，仅供学习交流。',
    href: '/music',
    tag: '已上线',
    tone: 'rose',
    glyph: '音',
    platform: 'PC + 移动',
  },
  {
    name: '视频',
    desc: '影视站：首页热播、短剧/电影/电视剧等分类筛选、搜索与播放，数据来自公开接口，仅供学习交流。',
    href: '/video',
    tag: '已上线',
    tone: 'ink',
    glyph: '影',
    platform: 'PC + 移动',
  },
  {
    name: '游戏',
    desc: '游戏模块占位页，路由与入口已打通，内容后续补充。仅供学习交流。',
    href: '/game',
    tag: '占位',
    tone: 'emerald',
    glyph: '游',
    platform: 'PC',
  },
  {
    name: '学习教育',
    desc: '教育模块占位页，路由与入口已打通，内容后续补充。仅供学习交流。',
    href: '/education',
    tag: '占位',
    tone: 'sky',
    glyph: '教',
    platform: 'PC + 移动',
  },
  ...Array.from({ length: 10 }, (_, i) => {
    const n = i + 1
    return {
      name: `占位 ${n}`,
      desc: `作品占位页 ${n}，路由已打通，内容后续补充。仅供学习交流。`,
      href: `/placeholder/${n}`,
      tag: '占位',
      tone: TONES[i % TONES.length],
      glyph: String(n),
      platform: 'PC + 移动' as const,
    }
  }),
]

export const WORKS_HOME_LIMIT = 6
export const WORKS_PATH = '/works'
