/** 红果站源分类（与 server/hongguo/hongguoCategories 对齐） */
export const NAV_CATEGORIES = [
  { key: 'real', label: '真人剧', category: '', path: '/hongguo/real' },
  { key: 'comic', label: '漫剧', category: 'comic', path: '/hongguo/comic' },
  { key: 'ai', label: 'AI剧', category: 'ai', path: '/hongguo/ai' },
  { key: 'anime', label: '动漫', category: 'anime', path: '/hongguo/anime' },
] as const

/** 首页热门分区 = 站源分类 */
export const HOME_SECTIONS = NAV_CATEGORIES

/** 分类浏览路由 */
export const ROUTE_CATEGORIES = NAV_CATEGORIES

export type CatKey = (typeof NAV_CATEGORIES)[number]['key']
export type NavKey = 'home' | CatKey | 'browse'

/** 顶栏：首页 + 热门体裁 + 分类（多维筛选页） */
export const NAV_LINKS: { key: NavKey; label: string; path: string }[] = [
  { key: 'home', label: '首页', path: '/hongguo' },
  ...NAV_CATEGORIES.map((c) => ({
    key: c.key as NavKey,
    label: `${c.label}`,
    path: c.path,
  })),
  { key: 'browse', label: '分类', path: '/hongguo/browse' },
]


export function categoryByPath(pathname: string) {
  return NAV_CATEGORIES.find((c) => pathname === c.path || pathname.startsWith(c.path + '/'))
}

export function categoryByKey(key: string | null | undefined) {
  return NAV_CATEGORIES.find((c) => c.key === key)
}

export function resolveNavKey(pathname: string): NavKey {
  if (pathname === '/hongguo/browse' || pathname.startsWith('/hongguo/browse/')) return 'browse'
  const cat = NAV_CATEGORIES.find((c) => pathname === c.path || pathname.startsWith(c.path + '/'))
  if (cat) return cat.key
  return 'home'
}
