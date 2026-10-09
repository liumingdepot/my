import { useState } from 'react'
import { favs } from '../utils/history'
import type { MacItem } from '../utils/server'
import DramaCard from './DramaCard'
import { Empty, Grid, Note, SecHead } from './shared'

function coverRaw(cover: string) {
  if (cover.startsWith('/api/test/img')) {
    try {
      return decodeURIComponent(cover.split('url=')[1] || '') || cover
    } catch {
      return cover
    }
  }
  return cover
}

const FavPage = () => {
  const [list] = useState(() => favs.all())

  const items: MacItem[] = list.map((x) => ({
    series_id: x.sid,
    title: x.title,
    cover: coverRaw(x.cover),
    episode_cnt: 0,
    score: '',
    play_cnt: 0,
    hot: '',
    category: x.cat || '',
    intro: '',
  }))

  return (
    <div>
      <SecHead>
        <h2>收藏</h2>
        <div className="acts">
          <Note style={{ alignSelf: 'center' }}>{list.length} 部</Note>
        </div>
      </SecHead>
      {items.length ? (
        <Grid>
          {items.map((it) => (
            <DramaCard key={it.series_id} item={it} />
          ))}
        </Grid>
      ) : (
        <Empty>还没有收藏，去发现页标记喜欢的剧吧</Empty>
      )}
    </div>
  )
}

export default FavPage
