import type { ClassNode, NavKey } from './types'

/** 顶栏大类与主源 type_id 对应（量子资源）；短剧走腾讯频道 channel_id */
export const NAV_CATEGORIES: {
  key: Exclude<NavKey, 'home' | 'actor'>
  label: string
  typeId: number
  path: string
}[] = [
  { key: 'short', label: '短剧', typeId: 120188, path: '/video/short' },
  { key: 'movie', label: '电影', typeId: 1, path: '/video/movie' },
  { key: 'tv', label: '电视剧', typeId: 2, path: '/video/tv' },
  { key: 'anime', label: '动漫', typeId: 4, path: '/video/anime' },
  { key: 'variety', label: '综艺', typeId: 3, path: '/video/variety' },
  { key: 'child', label: '少儿', typeId: 100150, path: '/video/child' },
  { key: 'music', label: '音乐', typeId: 100118, path: '/video/music' },
  { key: 'doco', label: '纪录片', typeId: 100105, path: '/video/doco' },
]

/** 精选频道「正在热播」page_id（v.qq.com/channel/choice） */
export const QQ_HOT_PAGE_ID = '100101'

/** 腾讯视频频道 page_id / channel_id（热播 Banner / 首页分区 / 分类列表） */
export const QQ_PAGES: Record<Exclude<NavKey, 'home' | 'actor'>, string> = {
  short: '120188',
  movie: '100173',
  tv: '100113',
  anime: '100119',
  variety: '100109',
  child: '100150',
  music: '100118',
  doco: '100105',
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
