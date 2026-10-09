import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { api, type MacItem } from '../utils/server'
import DramaCard from './DramaCard'
import { Empty, Grid, Loading, SecHead } from './shared'

const SearchPage = () => {
  const { q = '' } = useParams()
  const query = decodeURIComponent(q)
  const [items, setItems] = useState<MacItem[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!query) return
    let cancelled = false
    setLoading(true)
    setErr('')
    api
      .search(query, 40)
      .then((d) => {
        if (!cancelled) setItems(d.results || [])
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
  }, [query])

  return (
    <div>
      <SecHead>
        <h2>“{query}” 的搜索结果</h2>
      </SecHead>
      {loading ? <Loading /> : null}
      {!loading && err ? <Empty>{err}</Empty> : null}
      {!loading && !err ? (
        items.length ? (
          <Grid>
            {items.map((it) => (
              <DramaCard key={it.series_id} item={it} />
            ))}
          </Grid>
        ) : (
          <Empty>暂无内容</Empty>
        )
      ) : null}
    </div>
  )
}

export default SearchPage
