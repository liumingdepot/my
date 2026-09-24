/** 假分类：同一七猫接口，不同 name 采集任务 */
export const NAV_CATEGORIES = [
  { key: 'guzhuang', label: '古装', name: '古装', path: '/short/guzhuang' },
  { key: 'chuanyue', label: '穿越', name: '穿越', path: '/short/chuanyue' },
  { key: 'zhongsheng', label: '重生', name: '重生', path: '/short/zhongsheng' },
  { key: 'nixi', label: '逆袭', name: '逆袭', path: '/short/nixi' },
  { key: 'zhanshen', label: '战神', name: '战神', path: '/short/zhanshen' },
  { key: 'shenyi', label: '神医', name: '神医', path: '/short/shenyi' },
  { key: 'haomen', label: '豪门', name: '豪门', path: '/short/haomen' },
  { key: 'xuanyi', label: '悬疑', name: '悬疑', path: '/short/xuanyi' },
  { key: 'gaoxiao', label: '搞笑', name: '搞笑', path: '/short/gaoxiao' },
  { key: 'yanqing', label: '言情', name: '言情', path: '/short/yanqing' },
  { key: 'xiandai', label: '现代', name: '现代', path: '/short/xiandai' },
  { key: 'gudai', label: '古代', name: '古代', path: '/short/gudai' },
  { key: 'bazong', label: '霸总', name: '霸总', path: '/short/bazong' },
  { key: 'mengbao', label: '萌宝', name: '萌宝', path: '/short/mengbao' },
  { key: 'zongcai', label: '总裁', name: '总裁', path: '/short/zongcai' },
  { key: 'xiangcun', label: '乡村', name: '乡村', path: '/short/xiangcun' },
  { key: 'niandai', label: '年代', name: '年代', path: '/short/niandai' },
  { key: 'xuanhuan', label: '玄幻', name: '玄幻', path: '/short/xuanhuan' },
  { key: 'kehuan', label: '科幻', name: '科幻', path: '/short/kehuan' },
  { key: 'xiaoyuan', label: '校园', name: '校园', path: '/short/xiaoyuan' },
] as const

/** 原首页热门列表，现为顶栏「热门」 */
export const HOT_CATEGORY = { key: 'hot', label: '热门', name: '热门', path: '/short/hot' } as const

/** 分类项：热门 + 各题材（顶栏横向一排，同视频页） */
export const CATEGORY_LINKS = [HOT_CATEGORY, ...NAV_CATEGORIES] as const

export type CatKey = (typeof CATEGORY_LINKS)[number]['key']
export type NavKey = 'home' | CatKey

/** PC / 移动端顶栏统一：首页 + 分类（二级面板）；分类项见 CATEGORY_LINKS */
export const NAV_LINKS: { key: NavKey; label: string; path: string }[] = [
  { key: 'home', label: '首页', path: '/short' },
  ...CATEGORY_LINKS.map((c) => ({ key: c.key as NavKey, label: c.label, path: c.path })),
]

export function categoryByPath(pathname: string) {
  return CATEGORY_LINKS.find((c) => pathname === c.path || pathname.startsWith(c.path + '/'))
}

export function categoryByKey(key: string | null | undefined) {
  return CATEGORY_LINKS.find((c) => c.key === key)
}
