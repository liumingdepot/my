/** 红果站源分类（与 server/test/hongguoCategories 对齐） */
export const NAV_CATEGORIES = [
  { key: 'real', label: '真人剧', category: '', path: '/hongguo/real' },
  { key: 'comic', label: '漫剧', category: 'comic', path: '/hongguo/comic' },
  { key: 'ai', label: 'AI剧', category: 'ai', path: '/hongguo/ai' },
  { key: 'anime', label: '动漫', category: 'anime', path: '/hongguo/anime' },
] as const

export type CatKey = (typeof NAV_CATEGORIES)[number]['key']
export type NavKey = 'home' | CatKey

export const NAV_LINKS: { key: NavKey; label: string; path: string }[] = [
  { key: 'home', label: '首页', path: '/hongguo' },
  ...NAV_CATEGORIES.map((c) => ({ key: c.key as NavKey, label: c.label, path: c.path })),
]

export function categoryByPath(pathname: string) {
  return NAV_CATEGORIES.find((c) => pathname === c.path || pathname.startsWith(c.path + '/'))
}

export function categoryByKey(key: string | null | undefined) {
  return NAV_CATEGORIES.find((c) => c.key === key)
}
