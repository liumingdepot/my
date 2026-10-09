import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router'
import { api, type MacItem } from '../utils/server'
import type { LayoutOutlet } from './Layout'
import DramaCard from './DramaCard'
import { Chips, Empty, GhostBtn, Grid, Loading, SecHead } from './shared'

const DiscoverPage = () => {
  const { genre } = useOutletContext<LayoutOutlet>()
  const nav = useNavigate()
  const [themes, setThemes] = useState<string[]>([])
  const [theme, setTheme] = useState('')
  const [hot, setHot] = useState<MacItem[]>([])
  const [fresh, setFresh] = useState<MacItem[]>([])
  const [themeItems, setThemeItems] = useState<MacItem[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const f = await api.filters(genre)
        if (cancelled) return
        const row = (f.rows || []).find((r) => r.type === 'category_dim_theme')
        setThemes((row?.items || []).map((t) => t.name))
        setTheme('')
      } catch {
        if (!cancelled) setThemes([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [genre])

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      if (theme) {
        const d = await api.browse(`genre=${genre}&theme=${encodeURIComponent(theme)}&limit=36`)
        setThemeItems(d.items || [])
        setHot([])
        setFresh([])
      } else {
        let hotList: MacItem[] = []
        if (genre === 'comic_series') {
          hotList = (await api.rank('hot', 12)).items || []
        } else {
          const f = await api.filters(genre)
          const sorts = (f.rows || []).find((r) => r.type === 'sort')?.items || []
          const hotSort = sorts.find((s) => (s.name || '').includes('热'))
          const p = new URLSearchParams({ genre, limit: '12' })
          if (hotSort) p.set('sort', hotSort.name)
          hotList = (await api.browse(p.toString())).items || []
        }
        const latest = (await api.latest(genre, 12)).items || []
        setHot(hotList)
        setFresh(latest)
        setThemeItems([])
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [genre, theme])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onGenre = (e: Event) => {
      const g = (e as CustomEvent<string>).detail
      if (g) setTheme('')
    }
    window.addEventListener('test-genre', onGenre)
    return () => window.removeEventListener('test-genre', onGenre)
  }, [])

  return (
    <div>
      <Chips>
        <div className={`chip ${theme === '' ? 'on' : ''}`} onClick={() => setTheme('')}>
          全部
        </div>
        {themes.map((t) => (
          <div
            key={t}
            className={`chip ${theme === t ? 'on' : ''}`}
            onClick={() => setTheme(t)}
          >
            {t}
          </div>
        ))}
      </Chips>

      {loading ? <Loading /> : null}
      {!loading && err ? (
        <Empty>
          {err}
          <br />
          <br />
          <GhostBtn type="button" onClick={() => void load()}>
            重试
          </GhostBtn>
        </Empty>
      ) : null}

      {!loading && !err && theme ? (
        <>
          <SecHead>
            <h2>{theme}</h2>
          </SecHead>
          {themeItems.length ? (
            <Grid>
              {themeItems.map((it) => (
                <DramaCard key={it.series_id} item={it} />
              ))}
            </Grid>
          ) : (
            <Empty>暂无内容</Empty>
          )}
        </>
      ) : null}

      {!loading && !err && !theme ? (
        <>
          <SecHead>
            <h2>正在热播</h2>
            <div className="acts">
              <GhostBtn type="button" onClick={() => nav('/test/rank')}>
                查看完整榜单
              </GhostBtn>
            </div>
          </SecHead>
          {hot.length ? (
            <Grid>
              {hot.map((it, i) => (
                <DramaCard key={it.series_id} item={it} rank={i + 1} />
              ))}
            </Grid>
          ) : (
            <Empty>暂无内容</Empty>
          )}
          <SecHead>
            <h2>新剧</h2>
            <div className="acts">
              <GhostBtn type="button" onClick={() => void load()}>
                刷新片单
              </GhostBtn>
            </div>
          </SecHead>
          {fresh.length ? (
            <Grid>
              {fresh.map((it) => (
                <DramaCard key={it.series_id} item={it} />
              ))}
            </Grid>
          ) : (
            <Empty>暂无内容</Empty>
          )}
        </>
      ) : null}
    </div>
  )
}

export default DiscoverPage
