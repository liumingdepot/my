import styled from 'styled-components'

type Props = {
  page: number
  pagecount: number
  onChange: (page: number) => void
}

export default function Pager({ page, pagecount, onChange }: Props) {
  if (pagecount <= 1) return null

  const pages: number[] = []
  const start = Math.max(1, page - 2)
  const end = Math.min(pagecount, page + 2)
  for (let i = start; i <= end; i++) pages.push(i)

  return (
    <Wrap>
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        上一页
      </button>
      {start > 1 && (
        <>
          <button type="button" className={page === 1 ? 'is-active' : ''} onClick={() => onChange(1)}>
            1
          </button>
          {start > 2 && <span>…</span>}
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
      {end < pagecount && (
        <>
          {end < pagecount - 1 && <span>…</span>}
          <button
            type="button"
            className={page === pagecount ? 'is-active' : ''}
            onClick={() => onChange(pagecount)}
          >
            {pagecount}
          </button>
        </>
      )}
      <button type="button" disabled={page >= pagecount} onClick={() => onChange(page + 1)}>
        下一页
      </button>
    </Wrap>
  )
}

const Wrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin: 36px 0 8px;

  button {
    min-width: 36px;
    height: 36px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: #f5f2ea;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s, color 0.2s;

    &:hover:not(:disabled) {
      border-color: rgba(232, 165, 75, 0.45);
      color: #e8a54b;
    }

    &.is-active {
      background: #e8a54b;
      border-color: #e8a54b;
      color: #0a0a0c;
      font-weight: 700;
    }

    &:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
  }

  span {
    display: grid;
    place-items: center;
    color: rgba(245, 242, 234, 0.35);
  }
`
