import type { ClassNode, NavKey } from './types'

/** 顶栏大类与主源 type_id 对应（量子资源） */
export const NAV_CATEGORIES: {
  key: Exclude<NavKey, 'home' | 'actor'>
  label: string
  typeId: number
  path: string
}[] = [
  { key: 'movie', label: '电影', typeId: 1, path: '/video/movie' },
  { key: 'tv', label: '电视剧', typeId: 2, path: '/video/tv' },
  { key: 'anime', label: '动漫', typeId: 4, path: '/video/anime' },
  { key: 'variety', label: '综艺', typeId: 3, path: '/video/variety' },
]

/** 腾讯视频频道 page_id（热播 Banner / 首页分区） */
export const QQ_PAGES: Record<Exclude<NavKey, 'home' | 'actor'>, string> = {
  movie: '100173',
  tv: '100113',
  anime: '100119',
  variety: '100109',
}

export const NAV_LINKS: { key: NavKey; label: string; path: string }[] = [
  { key: 'home', label: '首页', path: '/video' },
  ...NAV_CATEGORIES.map((c) => ({ key: c.key as NavKey, label: c.label, path: c.path })),
  { key: 'actor', label: '演员', path: '/video/actor' },
]

export function buildClassTree(list: ClassNode[]) {
  const roots = list.filter((c) => c.type_pid === 0)
  return roots.map((root) => ({
    ...root,
    children: list.filter((c) => c.type_pid === root.type_id),
  }))
}

export function childrenOf(list: ClassNode[], parentId: number) {
  return list.filter((c) => c.type_pid === parentId)
}

export function categoryByPath(pathname: string) {
  return NAV_CATEGORIES.find((c) => pathname === c.path || pathname.startsWith(c.path + '/'))
}
