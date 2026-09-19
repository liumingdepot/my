export type Tab = 'search' | 'category' | 'short' | 'fav'

export type VideoSource = {
  name: string
}

export type PlayEpisode = {
  title: string
  url: string
}

export type PlaySource = {
  title: string
  episodes: PlayEpisode[]
}

export type TypeRef = {
  url?: string
  type_id?: string | number
  name?: string
}

export type VodItem = {
  vod_id: string | number
  vod_name: string
  vod_pic: string
  vod_remarks: string
  vod_blurb: string
  vod_actor: string
  vod_director: string
  vod_area: string
  vod_year: string
  vod_en: string
  type_id: string | number
  type_name: string
  vod_play_url: string
  source: string
  playSources?: PlaySource[]
  typeUrl?: TypeRef[]
}

export type CategoryNode = {
  type_id: number
  type_name: string
  children: { type_id: number; type_name: string }[]
}

export type ProgressKey = {
  source: string
  vod_id: string | number
  sourceIndex: number
  episodeIndex: number
}
