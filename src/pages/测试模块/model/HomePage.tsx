import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import styled from 'styled-components'
import {
  fetchCategories,
  getSources,
  searchDramas,
  type Category,
  type DramaListItem,
  type SourceSite,
} from '../utils/server'

const FLOW_STEPS = [
  { key: 'source', label: '1. 站源' },
  { key: 'search', label: '2. 搜索 / 目录' },
  { key: 'detail', label: '3. 详情' },
  { key: 'play', label: '4. 取流播放' },
] as const

function parsePage(raw: string | null) {
  const n = Number(raw || '1')
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
}

export default function HomePage() {
  const sites = getSources()
  const [params, setParams] = useSearchParams()
  const q = params.get('q')?.trim() || ''
  const page = parsePage(params.get('page'))
  const sourceId = params.get('source') || sites[0]?.id || 'hongguo'
  const category = params.get('category') || ''

  const [draft, setDraft] = useState(q)
  const [source, setSource] = useState<SourceSite>(
    () => sites.find((s) => s.id === sourceId) || sites[0]!,
  )
  const [categories, setCategories] = useState<Category[]>([])
  const [list, setList] = useState<DramaListItem[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [browsing, setBrowsing] = useState(!q)

  useEffect(() => {
    setDraft(q)
  }, [q])

  useEffect(() => {
    const next = getSources().find((s) => s.id === sourceId) || getSources()[0]
    if (next) setSource(next)
  }, [sourceId])

  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()
    ;(async () => {
      try {
        const cats = await fetchCategories(sourceId, ac.signal)
        if (!cancelled) setCategories(cats)
      } catch {
        if (!cancelled) setCategories([])
      }
    })()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [sourceId])

  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await searchDramas(sourceId, q, page, category, ac.signal)
        if (cancelled) return
        setList(data.list || [])
        setTotalPages(data.total_pages || 1)
        setBrowsing(!q)
        if (!(data.list || []).length) {
          setError(q ? '没有搜到相关短剧' : '当前分类暂无内容')
        }
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return
        setList([])
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [sourceId, q, page, category])

  function patchParams(patch: Record<string, string | null>) {
    const sp = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') sp.delete(k)
      else sp.set(k, v)
    }
    setParams(sp, { replace: true })
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    patchParams({
      source: source.id,
      q: text || null,
      page: null,
      category: text ? null : category || null,
    })
  }

  function switchSource(site: SourceSite) {
    setSource(site)
    patchParams({
      source: site.id,
      page: null,
      category: null,
      q: q || null,
    })
  }

  function switchCategory(id: string) {
    patchParams({
      source: source.id,
      category: id || null,
      page: null,
      q: null,
    })
    setDraft('')
  }

  function goPage(next: number) {
    patchParams({ page: next <= 1 ? null : String(next) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const activeStep = q || list.length ? 'search' : 'source'

  return (
    <Style>
      <section className="flow">
        <h1>红果 / 剧果 对接流程</h1>
        <p className="sub">
          参考 guoapp：红果走官网 <code>_ROUTER_DATA</code>；剧果走{' '}
          <code>api.huangju.net</code> 访客授权。本页对接 <code>/api/test</code>。
        </p>
        <ol className="steps">
          {FLOW_STEPS.map((step) => (
            <li
              key={step.key}
              className={
                activeStep === step.key || (list.length > 0 && step.key !== 'play') ? 'on' : ''
              }
            >
              {step.label}
            </li>
          ))}
        </ol>
      </section>

      <section className="panel">
        <h2>站源</h2>
        <div className="sources">
          {sites.map((site) => (
            <button
              key={site.id}
              type="button"
              className={source.id === site.id ? 'active' : ''}
              onClick={() => switchSource(site)}
            >
              <strong>{site.name}</strong>
              <span>{site.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>搜索 / 目录</h2>
        <form className="search" onSubmit={onSubmit}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={source.id === 'hongguo' ? '搜索红果剧名' : '搜索剧果剧名（可空=热门）'}
            aria-label="搜索短剧"
          />
          <button type="submit">搜索</button>
        </form>

        {categories.length ? (
          <div className="cats">
            <button
              type="button"
              className={!category && !q ? 'active' : ''}
              onClick={() => switchCategory('')}
            >
              {source.id === 'huangju' ? '热门' : '默认'}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id || cat.name}
                type="button"
                className={category === cat.id && !q ? 'active' : ''}
                onClick={() => switchCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="panel results">
        <div className="head">
          <h2>
            {q ? `「${q}」搜索` : browsing ? `${source.name}目录` : '结果'}
            {loading ? <span className="muted"> 加载中…</span> : null}
          </h2>
          {totalPages > 1 ? (
            <p className="page">
              第 {page} / {totalPages} 页
            </p>
          ) : null}
        </div>

        {error ? <p className="err">{error}</p> : null}

        <div className="grid">
          {list.map((item) => (
            <Link
              key={String(item.id)}
              className="card"
              to={`/test/detail/${encodeURIComponent(String(item.id))}?source=${encodeURIComponent(source.id)}`}
            >
              <div className="cover">
                {item.image_link ? (
                  <img src={item.image_link} alt="" loading="lazy" referrerPolicy="no-referrer" />
                ) : (
                  <span>无封面</span>
                )}
              </div>
              <div className="meta">
                <h3>{item.title}</h3>
                <p>
                  {item.total_num ? `共 ${item.total_num} 集` : item.sub_title || '短剧'}
                  {item.hot_value ? ` · ${item.hot_value}` : ''}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {totalPages > 1 ? (
          <div className="pager">
            <button type="button" disabled={page <= 1 || loading} onClick={() => goPage(page - 1)}>
              上一页
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => goPage(page + 1)}
            >
              下一页
            </button>
          </div>
        ) : null}
      </section>
    </Style>
  )
}

const Style = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;

  h1,
  h2 {
    margin: 0;
  }

  h1 {
    font-size: clamp(22px, 3vw, 28px);
    font-weight: 700;
  }

  h2 {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: rgba(232, 238, 248, 0.75);
    margin-bottom: 12px;
  }

  .sub {
    margin: 10px 0 0;
    font-size: 14px;
    line-height: 1.6;
    color: rgba(232, 238, 248, 0.55);
    max-width: 54em;

    code {
      padding: 1px 6px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.08);
      font-size: 12px;
    }
  }

  .steps {
    list-style: none;
    margin: 18px 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    li {
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      font-size: 12px;
      color: rgba(232, 238, 248, 0.45);

      &.on {
        color: #cfe3ff;
        border-color: rgba(79, 156, 245, 0.45);
        background: rgba(79, 156, 245, 0.12);
      }
    }
  }

  .panel {
    padding: 18px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
  }

  .sources {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;

    button {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      min-width: 150px;
      padding: 12px 14px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: transparent;
      color: inherit;
      cursor: pointer;
      text-align: left;

      strong {
        font-size: 14px;
      }

      span {
        font-size: 12px;
        color: rgba(232, 238, 248, 0.45);
      }

      &.active {
        border-color: rgba(79, 156, 245, 0.55);
        background: rgba(79, 156, 245, 0.12);
      }

      &:hover {
        border-color: rgba(255, 255, 255, 0.28);
      }
    }
  }

  .search {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;

    input {
      flex: 1;
      min-width: 200px;
      height: 42px;
      padding: 0 14px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(0, 0, 0, 0.28);
      color: #fff;
      outline: none;

      &:focus {
        border-color: rgba(79, 156, 245, 0.55);
      }
    }

    button {
      height: 42px;
      padding: 0 18px;
      border: none;
      border-radius: 10px;
      background: #3b82f6;
      color: #fff;
      font-weight: 600;
      cursor: pointer;

      &:hover {
        background: #4f92ff;
      }
    }
  }

  .cats {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;

    button {
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: transparent;
      color: rgba(232, 238, 248, 0.65);
      font-size: 12px;
      cursor: pointer;

      &.active {
        color: #cfe3ff;
        border-color: rgba(79, 156, 245, 0.45);
        background: rgba(79, 156, 245, 0.12);
      }
    }
  }

  .results .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 4px;
  }

  .muted {
    font-weight: 400;
    color: rgba(232, 238, 248, 0.4);
    font-size: 13px;
  }

  .page {
    margin: 0;
    font-size: 12px;
    color: rgba(232, 238, 248, 0.4);
  }

  .err {
    margin: 8px 0 0;
    color: #f07178;
    font-size: 13px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
    gap: 14px;
    margin-top: 14px;
  }

  .card {
    border-radius: 12px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.06);
    transition:
      transform 0.15s ease,
      border-color 0.15s ease;

    &:hover {
      transform: translateY(-2px);
      border-color: rgba(79, 156, 245, 0.4);
    }

    .cover {
      aspect-ratio: 2 / 3;
      background: #151b28;
      display: grid;
      place-items: center;
      color: rgba(255, 255, 255, 0.25);
      font-size: 12px;
      overflow: hidden;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .meta {
      padding: 10px;

      h3 {
        margin: 0;
        font-size: 13px;
        line-height: 1.35;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      p {
        margin: 6px 0 0;
        font-size: 11px;
        color: rgba(232, 238, 248, 0.45);
      }
    }
  }

  .pager {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-top: 20px;

    button {
      height: 36px;
      padding: 0 14px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: transparent;
      color: inherit;
      cursor: pointer;

      &:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }

      &:not(:disabled):hover {
        border-color: rgba(255, 255, 255, 0.35);
      }
    }
  }
`
