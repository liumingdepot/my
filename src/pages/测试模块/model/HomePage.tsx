import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import styled from 'styled-components'
import { searchDramas, type DramaListItem } from '../utils/server'

/** 假分类：同一接口，不同 name；首页默认热门 */
const CATEGORIES = [
  { key: 'hot', label: '热门', name: '热门' },
  { key: 'guzhuang', label: '古装', name: '古装' },
  { key: 'chuanyue', label: '穿越', name: '穿越' },
  { key: 'zhongsheng', label: '重生', name: '重生' },
  { key: 'nixi', label: '逆袭', name: '逆袭' },
  { key: 'zhanshen', label: '战神', name: '战神' },
  { key: 'shenyi', label: '神医', name: '神医' },
  { key: 'haomen', label: '豪门', name: '豪门' },
  { key: 'xuanyi', label: '悬疑', name: '悬疑' },
  { key: 'gaoxiao', label: '搞笑', name: '搞笑' },
  { key: 'yanqing', label: '言情', name: '言情' },
  { key: 'xiandai', label: '现代', name: '现代' },
  { key: 'gudai', label: '古代', name: '古代' },
  { key: 'bazong', label: '霸总', name: '霸总' },
  { key: 'mengbao', label: '萌宝', name: '萌宝' },
  { key: 'zongcai', label: '总裁', name: '总裁' },
  { key: 'xiangcun', label: '乡村', name: '乡村' },
  { key: 'niandai', label: '年代', name: '年代' },
  { key: 'xuanhuan', label: '玄幻', name: '玄幻' },
  { key: 'kehuan', label: '科幻', name: '科幻' },
  { key: 'xiaoyuan', label: '校园', name: '校园' },
] as const

type CatKey = (typeof CATEGORIES)[number]['key']

function resolveCat(key: string | null): (typeof CATEGORIES)[number] {
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES[0]
}

function parsePage(raw: string | null) {
  const n = Number(raw || '1')
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
}

export default function HomePage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const catKey = (params.get('cat') || CATEGORIES[0].key) as CatKey
  const cat = resolveCat(params.get('cat'))
  const page = parsePage(params.get('page'))
  const freeSearch = Boolean(q.trim())
  const queryName = freeSearch ? q.trim() : cat.name

  const [keyword, setKeyword] = useState(q)
  const [list, setList] = useState<DramaListItem[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setKeyword(q)
  }, [q])

  useEffect(() => {
    if (!queryName) return

    let cancelled = false
    const ac = new AbortController()
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await searchDramas(queryName, page, ac.signal)
        if (cancelled) return
        setList(data.list || [])
        setTotalPages(data.total_pages || 1)
      } catch (e) {
        if (cancelled || (e instanceof DOMException && e.name === 'AbortError')) return
        setList([])
        setError(e instanceof Error ? e.message : '采集失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [queryName, page])

  function patch(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === '') sp.delete(k)
      else sp.set(k, v)
    }
    setParams(sp, { replace: true })
  }

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const text = keyword.trim()
    if (!text) {
      patch({ q: null, cat: cat.key, page: null })
      return
    }
    patch({ q: text, cat: null, page: null })
  }

  function selectCat(key: CatKey) {
    setKeyword('')
    patch({ cat: key, q: null, page: null })
  }

  function goPage(next: number) {
    patch({ page: next <= 1 ? null : String(next) })
  }

  return (
    <Style>
      <section className="hero">
        <h1>七猫短剧</h1>
        <p>分类用不同 name 走同一采集接口；也可直接搜剧名。支持 page 分页。</p>
      </section>

      <div className="tabs" role="tablist" aria-label="短剧分类">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={!freeSearch && catKey === c.key}
            className={!freeSearch && catKey === c.key ? 'on' : ''}
            title={`采集 name=${c.name}`}
            onClick={() => selectCat(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <form className="search" onSubmit={onSearch}>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索短剧名称，例如：小无赖"
          aria-label="搜索短剧"
        />
        <button type="submit">搜索</button>
        {freeSearch ? (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setKeyword('')
              patch({ q: null, cat: CATEGORIES[0].key, page: null })
            }}
          >
            清除
          </button>
        ) : null}
      </form>

      <p className="hint">
        {freeSearch ? (
          <>
            搜索「{q}」
            {loading ? ' · 检索中…' : ` · ${list.length} 条`}
            {!loading && totalPages > 1 ? ` · 第 ${page}/${totalPages} 页` : ''}
          </>
        ) : (
          <>
            {cat.label}
            <span className="task"> · 采集 ?name={cat.name}&page={page}</span>
            {loading ? ' · 采集中…' : ` · ${list.length} 条`}
            {!loading && totalPages > 1 ? ` · 第 ${page}/${totalPages} 页` : ''}
          </>
        )}
      </p>

      {error ? <p className="status err">{error}</p> : null}
      {!loading && !error && list.length === 0 ? (
        <p className="status">{freeSearch ? '没有搜到相关短剧' : '该分类暂无内容'}</p>
      ) : null}

      <ul className="list">
        {list.map((item) => (
          <li key={item.id}>
            <Link className="row" to={`/test/${item.id}`}>
              <img className="cover" src={item.image_link} alt="" loading="lazy" />
              <div className="body">
                <h3 className="title">{item.title}</h3>
                <p className="meta">
                  {item.sub_title || '—'}
                  {item.total_num ? ` · ${item.total_num}` : ''}
                  {item.hot_value ? ` · ${item.hot_value}` : ''}
                </p>
              </div>
              <span className="go">查看</span>
            </Link>
          </li>
        ))}
      </ul>

      {totalPages > 1 ? (
        <div className="pager">
          <button type="button" disabled={page <= 1 || loading} onClick={() => goPage(page - 1)}>
            上一页
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => goPage(page + 1)}
          >
            下一页
          </button>
        </div>
      ) : null}
    </Style>
  )
}

const Style = styled.div`
  .hero {
    margin-bottom: 18px;

    h1 {
      margin: 0 0 6px;
      font-size: 22px;
      font-weight: 750;
      letter-spacing: 0.02em;
    }

    p {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }
  }

  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 14px;

    button {
      min-height: 32px;
      padding: 0 12px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 13px;
      cursor: pointer;

      &.on {
        color: #041016;
        background: var(--accent);
        border-color: transparent;
        font-weight: 700;
      }
    }
  }

  .search {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;

    input {
      flex: 1;
      min-height: 40px;
      padding: 0 12px;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: var(--bg-elev);
      color: var(--text);
      font: inherit;
      outline: none;

      &:focus {
        border-color: color-mix(in srgb, var(--accent) 50%, transparent);
      }
    }

    button {
      min-height: 40px;
      padding: 0 14px;
      border: 0;
      border-radius: 10px;
      background: linear-gradient(135deg, #0f766e, #0e7490);
      color: #fff;
      font: inherit;
      font-size: 13px;
      font-weight: 650;
      cursor: pointer;
    }

    .ghost {
      background: transparent;
      border: 1px solid var(--line);
      color: var(--muted);
    }
  }

  .hint {
    margin: 0 0 14px;
    color: var(--muted);
    font-size: 13px;

    .task {
      color: color-mix(in srgb, var(--accent) 75%, var(--muted));
    }
  }

  .status {
    margin: 12px 0;
    color: var(--muted);
    font-size: 13px;

    &.err {
      color: #f07178;
    }
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .row {
    display: grid;
    grid-template-columns: 56px 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: color-mix(in srgb, var(--bg-elev) 70%, transparent);
    color: inherit;
    text-decoration: none;
    transition:
      border-color 0.15s ease,
      background 0.15s ease;

    &:hover {
      border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
      background: var(--bg-elev);

      .title {
        color: var(--accent);
      }
    }

    @media (max-width: 560px) {
      .go {
        display: none;
      }
    }
  }

  .cover {
    width: 56px;
    height: 74px;
    object-fit: cover;
    border-radius: 8px;
    background: var(--bg-elev);
  }

  .body {
    min-width: 0;
  }

  .title {
    margin: 0 0 4px;
    font-size: 14px;
    font-weight: 650;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }

  .go {
    font-size: 12px;
    font-weight: 650;
    color: var(--muted);
    white-space: nowrap;
  }

  .pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-top: 18px;

    button {
      min-height: 36px;
      padding: 0 14px;
      border-radius: 8px;
      border: 1px solid var(--line);
      background: var(--bg-elev);
      color: var(--text);
      font: inherit;
      font-size: 13px;
      cursor: pointer;

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    }

    span {
      font-size: 13px;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }
  }
`
