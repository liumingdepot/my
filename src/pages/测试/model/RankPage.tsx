import { useEffect, useState } from 'react'
import { api, type MacItem } from '../utils/server'
import DramaCard from './DramaCard'
import { Chips, Empty, Grid, Loading, Note } from './shared'

const BOARDS = [
  { id: 'recommend', name: '推荐榜' },
  { id: 'hot', name: '热播榜' },
  { id: 'new', name: '新品榜' },
]

const RankPage = () => {
  const [board, setBoard] = useState('recommend')
  const [items, setItems] = useState<MacItem[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr('')
    api
      .rank(board, 30)
      .then((d) => {
        if (!cancelled) setItems(d.items || [])
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [board])

  return (
    <div>
      <Chips>
        {BOARDS.map((b) => (
          <div
            key={b.id}
            className={`chip ${board === b.id ? 'on' : ''}`}
            onClick={() => setBoard(b.id)}
          >
            {b.name}
          </div>
        ))}
      </Chips>
      <Note style={{ marginBottom: 14 }}>漫剧榜单 · 数据来自内容服务</Note>
      {loading ? <Loading /> : null}
      {!loading && err ? <Empty>{err}</Empty> : null}
      {!loading && !err ? (
        items.length ? (
          <Grid>
            {items.map((it, i) => (
              <DramaCard key={it.series_id} item={it} rank={i + 1} />
            ))}
          </Grid>
        ) : (
          <Empty>暂无内容</Empty>
        )
      ) : null}
    </div>
  )
}

export default RankPage
