import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import styled from 'styled-components'
import Banner from './Banner'
import DramaCard from './DramaCard'
import { HOME_SECTIONS } from '../utils/categories'
import { searchDramas, type DramaListItem } from '../utils/server'

type Section = {
  key: string
  title: string
  path?: string
  items: DramaListItem[]
}

const SECTION_COLS = 6
const SECTION_ROWS = 4
const SECTION_SIZE = SECTION_COLS * SECTION_ROWS
const BANNER_SIZE = 8

export default function HomePage() {
  const [banner, setBanner] = useState<DramaListItem[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const results = await Promise.all(
          HOME_SECTIONS.map(async (cat) => {
            try {
              const data = await searchDramas('', 1, cat.category, ac.signal)
              return { cat, list: data.list || [] }
            } catch {
              return { cat, list: [] as DramaListItem[] }
            }
          }),
        )
        if (cancelled) return

        const real = results[0]?.list.filter((i) => i.image_link) || []
        setBanner(real.slice(0, BANNER_SIZE))

        setSections(
          results.map(({ cat, list }) => ({
            key: cat.key,
            title: `热门${cat.label}`,
            path: cat.path,
            items: list.filter((i) => i.image_link).slice(0, SECTION_SIZE),
          })),
        )

        const total = results.reduce((n, r) => n + r.list.length, 0)
        if (total === 0) setError('目录加载失败，请稍后重试')
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [])

  return (
    <Page>
      {loading && !banner.length ? <Status>加载中…</Status> : null}
      {error ? <Status className="err">{error}</Status> : null}
      <Banner items={banner} eyebrow="正在热播" />

      <div className="container">
        {sections.map((sec) =>
          sec.items.length ? (
            <section key={sec.key} className="block">
              <div className="head">
                <h2>{sec.title}</h2>
                {sec.path ? <Link to={sec.path}>查看更多</Link> : null}
              </div>
              <div className="grid">
                {sec.items.map((item) => (
                  <DramaCard key={`${sec.key}-${item.id}`} item={item} />
                ))}
              </div>
            </section>
          ) : null,
        )}
      </div>
    </Page>
  )
}

const Page = styled.div`
  margin-top: -64px;

  .container {
    position: relative;
    z-index: 3;
    max-width: 90vw;
    margin: -140px auto 0;
    padding: 28px 28px 32px;
    border-radius: 20px 20px 0 0;
    background: linear-gradient(
      180deg,
      rgba(10, 10, 12, 0.42) 0%,
      rgba(10, 10, 12, 0.72) 64px,
      rgba(10, 10, 12, 0.92) 160px,
      #0a0a0c 240px
    );
    backdrop-filter: blur(2px);
  }

  .block {
    margin-bottom: 48px;
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 18px;

    h2 {
      margin: 0;
      font-family: ui-serif, 'Songti SC', 'STSong', 'SimSun', serif;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }

    a {
      font-size: 13px;
      color: #e8a54b;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 20px 16px;
    align-items: start;
  }

  @media (max-width: 1200px) {
    .container {
      margin-top: -100px;
      padding: 24px 20px 28px;
    }

    .grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (max-width: 900px) {
    margin-top: -132px;

    .container {
      max-width: 100%;
      margin-top: -72px;
      padding: 20px 14px 28px;
      border-radius: 16px 16px 0 0;
    }

    .block {
      margin-bottom: 32px;
    }

    .head {
      margin-bottom: 14px;

      h2 {
        font-size: 18px;
      }

      a {
        font-size: 12px;
      }
    }

    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px 10px;
    }
  }

  @media (max-width: 600px) {
    .container {
      margin-top: -56px;
      padding: 16px 12px 24px;
      border-radius: 14px 14px 0 0;
    }
  }
`

const Status = styled.p`
  max-width: 1280px;
  margin: 24px auto;
  padding: 0 20px;
  color: rgba(245, 242, 234, 0.55);
  font-size: 14px;

  &.err {
    color: #e07070;
  }
`
