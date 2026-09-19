export type Song = {
  id: string
  title: string
  artist: string
  cover: string
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

export type ChartGroup = {
  disname?: string
  name?: string
  child?: Array<{
    sourceid?: string | number
    name?: string
    pic5?: string
    pic2?: string
  }>
}

export type TagGroup = {
  name?: string
  data?: Array<{ id?: string | number; name?: string }>
}

export type PlayMode = 'list' | 'single'
