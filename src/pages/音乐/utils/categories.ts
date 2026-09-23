import type { NavKey } from './types'

export const NAV_LINKS: { key: NavKey; label: string; path: string }[] = [
  { key: 'recommend', label: '推荐', path: '/music' },
  { key: 'charts', label: '排行榜', path: '/music/charts' },
  { key: 'artists', label: '歌手', path: '/music/artists' },
  { key: 'playlists', label: '歌单', path: '/music/playlists' },
]

export const ARTIST_LETTERS = [
  '热门',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  '#',
]

export const ARTIST_CATEGORIES: { id: number; label: string }[] = [
  { id: 0, label: '全部' },
  { id: 1, label: '华语男' },
  { id: 2, label: '华语女' },
  { id: 3, label: '华语组合' },
  { id: 4, label: '日韩男' },
  { id: 5, label: '日韩女' },
  { id: 6, label: '日韩组合' },
  { id: 7, label: '欧美男' },
  { id: 8, label: '欧美女' },
  { id: 9, label: '欧美组合' },
  { id: 10, label: '其他' },
]

export function resolveNav(pathname: string): NavKey {
  if (pathname.startsWith('/music/charts')) return 'charts'
  if (pathname.startsWith('/music/artists')) return 'artists'
  if (pathname.startsWith('/music/playlists')) return 'playlists'
  if (pathname.startsWith('/music/search')) return 'recommend'
  return 'recommend'
}
