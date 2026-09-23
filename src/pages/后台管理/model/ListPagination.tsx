import styled from 'styled-components'

export const LIST_PAGE_SIZE = 10

type Props = {
  page: number
  pageCount: number
  total: number
  pageSize?: number
  onChange: (page: number) => void
}

export default function ListPagination({
  page,
  pageCount,
  total,
  pageSize = LIST_PAGE_SIZE,
  onChange,
}: Props) {
  if (total === 0) return null

  const pages: number[] = []
  const start = Math.max(1, page - 2)
  const end = Math.min(pageCount, page + 2)
  for (let i = start; i <= end; i++) pages.push(i)

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <Wrap>
      <span className="meta">
        {from}-{to} / {total}
      </span>
      <div className="pager">
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          上一页
        </button>
        {start > 1 && (
          <>
            <button
              type="button"
              className={page === 1 ? 'is-active' : ''}
              onClick={() => onChange(1)}
            >
              1
            </button>
            {start > 2 ? <span className="ellipsis">…</span> : null}
          </>
        )}
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className={p === page ? 'is-active' : ''}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ))}
        {end < pageCount && (
          <>
            {end < pageCount - 1 ? <span className="ellipsis">…</span> : null}
            <button
              type="button"
              className={page === pageCount ? 'is-active' : ''}
              onClick={() => onChange(pageCount)}
            >
              {pageCount}
            </button>
          </>
        )}
        <button type="button" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
          下一页
        </button>
      </div>
    </Wrap>
  )
}

const Wrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  padding: 10px 16px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
  flex-shrink: 0;

  .meta {
    font-size: 13px;
    color: #6b7280;
    white-space: nowrap;
  }

  .pager {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-left: auto;
  }

  button {
    min-width: 32px;
    height: 32px;
    padding: 0 10px;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    background: #fff;
    color: #374151;
    font-size: 13px;
    cursor: pointer;
    line-height: 1;
  }

  button:hover:not(:disabled) {
    border-color: #0f766e;
    color: #0f766e;
  }

  button.is-active {
    background: #0f766e;
    border-color: #0f766e;
    color: #fff;
    font-weight: 600;
  }

  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .ellipsis {
    color: #9ca3af;
    font-size: 13px;
    line-height: 1;
    padding: 0 2px;
  }
`
