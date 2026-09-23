export type Song = {
  id: string
  title: string
  artist: string
  cover: string
  album?: string
  duration?: string
  durationSec?: number
  lossless?: boolean
  hasMv?: boolean
}

export type LyricLine = {
  text: string
  time: number
}

export type PlaylistCard = {
  id: string | number
  name: string
  img?: string
  listencnt?: number | string
}

export type ChartItem = {
  sourceid?: string | number
  name?: string
  disname?: string
  pic?: string
  pic5?: string
  pic2?: string
  pubTime?: string
  intro?: string
}

export type ChartGroup = {
  disname?: string
  name?: string
  child?: ChartItem[]
}

export type Artist = {
  id: string
  name: string
  cover: string
  musicNum: number
}

export type TagGroup = {
  name?: string
  data?: Array<{ id?: string | number; name?: string }>
}

export type PlayMode = 'list' | 'single'

export type NavKey = 'recommend' | 'charts' | 'artists' | 'playlists'
